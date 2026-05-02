import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AppointmentStatus } from '@prisma/client';
import {
  CreateMedicalRecordDto,
  UpdateMedicalRecordDto,
  QueryMyMedicalRecordsDto,
  QueryAdminMedicalRecordsDto,
} from './dto/medical-record.dto';

// ─── Select shapes ─────────────────────────────────────────────

const MEDICAL_RECORD_SELECT = {
  id: true,
  diagnosis: true,
  prescription: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  appointment: {
    select: {
      id: true,
      status: true,
      reason: true,
      timeSlot: {
        select: { date: true, startTime: true, endTime: true },
      },
      hospital: {
        select: { id: true, name: true, slug: true, city: true },
      },
    },
  },
  patientProfile: {
    select: {
      id: true,
      fullName: true,
      dob: true,
      gender: true,
      phoneNumber: true,
    },
  },
  doctor: {
    select: {
      id: true,
      slug: true,
      user: {
        select: { firstName: true, lastName: true, avatar: true },
      },
      specialties: {
        where: { isPrimary: true },
        select: {
          specialty: { select: { id: true, name: true, slug: true } },
        },
        take: 1,
      },
    },
  },
} as const;

@Injectable()
export class MedicalRecordService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ───────────────────────────────────────────────

  private getPagination(page = 1, limit = 10) {
    return { take: limit, skip: (page - 1) * limit };
  }

  /**
   * Tìm record theo id, throw 404 nếu không thấy.
   */
  private async findRecordOrThrow(id: string) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
      include: {
        doctor: { select: { id: true, userId: true } },
        patientProfile: { select: { userId: true } },
      },
    });

    if (!record) {
      throw new NotFoundException(
        `Không tìm thấy hồ sơ bệnh án với id "${id}"`,
      );
    }

    return record;
  }

  // ─── Doctor APIs ───────────────────────────────────────────

  /**
   * POST /medical-records
   * Bác sĩ tạo hồ sơ bệnh án sau khi appointment = completed.
   *
   * Điều kiện:
   *  1. Appointment phải ở trạng thái completed
   *  2. Appointment phải thuộc về bác sĩ đang đăng nhập
   *  3. Chưa có medical record nào cho appointment này
   */
  async create(userId: string, dto: CreateMedicalRecordDto) {
    // Lấy doctor profile từ userId
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!doctor) {
      throw new NotFoundException('Không tìm thấy hồ sơ bác sĩ');
    }

    // Lấy appointment + kiểm tra trạng thái
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointmentId },
      select: {
        id: true,
        status: true,
        doctorId: true,
        patientProfileId: true,
        medicalRecord: { select: { id: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Không tìm thấy lịch hẹn');
    }

    // Ownership: chỉ bác sĩ của lịch hẹn đó mới được tạo
    if (appointment.doctorId !== doctor.id) {
      throw new ForbiddenException(
        'Bạn không có quyền tạo hồ sơ bệnh án cho lịch hẹn này',
      );
    }

    // Chỉ tạo khi appointment đã completed
    if (appointment.status !== AppointmentStatus.completed) {
      throw new BadRequestException(
        'Chỉ có thể tạo hồ sơ bệnh án sau khi buổi khám hoàn thành',
      );
    }

    // 1 appointment chỉ có 1 medical record
    if (appointment.medicalRecord) {
      throw new ConflictException(
        'Lịch hẹn này đã có hồ sơ bệnh án. Dùng PATCH để cập nhật.',
      );
    }

    const record = await this.prisma.medicalRecord.create({
      data: {
        appointmentId: dto.appointmentId,
        patientProfileId: appointment.patientProfileId,
        doctorId: doctor.id,
        diagnosis: dto.diagnosis,
        prescription: dto.prescription,
        notes: dto.notes,
      },
      select: MEDICAL_RECORD_SELECT,
    });

    return record;
  }

  /**
   * PATCH /medical-records/:id
   * Bác sĩ cập nhật hồ sơ bệnh án của mình.
   * Ownership check: chỉ bác sĩ tạo record mới được sửa.
   */
  async update(userId: string, recordId: string, dto: UpdateMedicalRecordDto) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!doctor) {
      throw new NotFoundException('Không tìm thấy hồ sơ bác sĩ');
    }

    const record = await this.findRecordOrThrow(recordId);

    if (record.doctor.userId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền chỉnh sửa hồ sơ bệnh án này',
      );
    }

    return this.prisma.medicalRecord.update({
      where: { id: recordId },
      data: {
        ...(dto.diagnosis !== undefined && { diagnosis: dto.diagnosis }),
        ...(dto.prescription !== undefined && {
          prescription: dto.prescription,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      select: MEDICAL_RECORD_SELECT,
    });
  }

  /**
   * GET /doctors/me/medical-records?page&limit
   * Bác sĩ xem tất cả hồ sơ bệnh án mình đã tạo.
   */
  async findByDoctor(userId: string, query: QueryMyMedicalRecordsDto) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!doctor) {
      throw new NotFoundException('Không tìm thấy hồ sơ bác sĩ');
    }

    const { page, limit } = query;
    const { take, skip } = this.getPagination(page, limit);

    const where = { doctorId: doctor.id };

    const [data, total] = await Promise.all([
      this.prisma.medicalRecord.findMany({
        where,
        select: MEDICAL_RECORD_SELECT,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.medicalRecord.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: page ?? 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  // ─── User APIs ─────────────────────────────────────────────

  /**
   * GET /users/me/medical-records?page&limit
   * User xem tất cả hồ sơ bệnh án của các profile thuộc về mình.
   */
  async findByUser(userId: string, query: QueryMyMedicalRecordsDto) {
    const { page, limit } = query;
    const { take, skip } = this.getPagination(page, limit);

    // Lấy tất cả patientProfileId của user này
    const profiles = await this.prisma.patientProfile.findMany({
      where: { userId },
      select: { id: true },
    });
    const profileIds = profiles.map((p) => p.id);

    const where = { patientProfileId: { in: profileIds } };

    const [data, total] = await Promise.all([
      this.prisma.medicalRecord.findMany({
        where,
        select: MEDICAL_RECORD_SELECT,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.medicalRecord.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: page ?? 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * GET /users/me/medical-records/:id
   * User xem chi tiết 1 hồ sơ — ownership check qua patientProfile.
   */
  async findOneByUser(userId: string, recordId: string) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id: recordId },
      select: {
        ...MEDICAL_RECORD_SELECT,
        patientProfile: {
          select: {
            id: true,
            fullName: true,
            dob: true,
            gender: true,
            phoneNumber: true,
            userId: true, // để check ownership
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('Không tìm thấy hồ sơ bệnh án');
    }

    if (record.patientProfile.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xem hồ sơ bệnh án này');
    }

    // Ẩn userId khỏi response
    const { patientProfile: { userId: _uid, ...profileData }, ...rest } =
      record;
    return { ...rest, patientProfile: profileData };
  }

  // ─── Admin APIs ────────────────────────────────────────────

  /**
   * GET /admin/medical-records?patientProfileId&doctorId&page&limit
   * Admin xem tất cả hồ sơ bệnh án — filter đa chiều.
   */
  async adminFindAll(query: QueryAdminMedicalRecordsDto) {
    const { patientProfileId, doctorId, page, limit } = query;
    const { take, skip } = this.getPagination(page, limit);

    const where = {
      ...(patientProfileId && { patientProfileId }),
      ...(doctorId && { doctorId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.medicalRecord.findMany({
        where,
        select: MEDICAL_RECORD_SELECT,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.medicalRecord.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: page ?? 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * GET /admin/medical-records/:id
   * Admin xem chi tiết bất kỳ hồ sơ bệnh án.
   */
  async adminFindById(id: string) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
      select: MEDICAL_RECORD_SELECT,
    });

    if (!record) {
      throw new NotFoundException(
        `Không tìm thấy hồ sơ bệnh án với id "${id}"`,
      );
    }

    return record;
  }
}
