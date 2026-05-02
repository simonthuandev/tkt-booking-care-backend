import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AppointmentStatus, CancelledBy } from '@prisma/client';
import {
  CreateAppointmentDto,
  CancelAppointmentDto,
  UpdateAppointmentStatusDto,
  QueryMyAppointmentsDto,
  QueryDoctorAppointmentsDto,
  QueryAdminAppointmentsDto,
} from './dto/appointment.dto';

// ─── State machine ────────────────────────────────────────────
//
//  pending ──(doctor/admin)──► confirmed
//  confirmed ──(doctor/admin)──► processing
//  processing ──(doctor/admin)──► completed | no_show
//
//  pending | confirmed ──(user)──► cancelled
//  pending | confirmed | processing ──(admin)──► cancelled
//  confirmed ──(doctor)──► cancelled   (bác sĩ có thể huỷ trước khi khám)

const DOCTOR_ALLOWED_TRANSITIONS: Partial<
  Record<AppointmentStatus, AppointmentStatus[]>
> = {
  [AppointmentStatus.pending]: [AppointmentStatus.confirmed],
  [AppointmentStatus.confirmed]: [
    AppointmentStatus.processing,
    AppointmentStatus.cancelled,
  ],
  [AppointmentStatus.processing]: [
    AppointmentStatus.completed,
    AppointmentStatus.no_show,
  ],
};

const USER_CANCELLABLE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.pending,
  AppointmentStatus.confirmed,
];

const ADMIN_CANCELLABLE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.pending,
  AppointmentStatus.confirmed,
  AppointmentStatus.processing,
];

// ─── Select shapes ─────────────────────────────────────────────

/**
 * Select tối giản cho listing — đủ để hiển thị card.
 */
const APPOINTMENT_LIST_SELECT = {
  id: true,
  status: true,
  reason: true,
  cancelReason: true,
  cancelledBy: true,
  createdAt: true,
  updatedAt: true,
  timeSlot: {
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
    },
  },
  doctor: {
    select: {
      id: true,
      slug: true,
      consultationFee: true,
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
  hospital: {
    select: { id: true, name: true, slug: true, address: true, city: true },
  },
  patientProfile: {
    select: { id: true, fullName: true, dob: true, gender: true, phoneNumber: true },
  },
} as const;

/**
 * Select đầy đủ cho detail page.
 */
const APPOINTMENT_DETAIL_SELECT = {
  ...APPOINTMENT_LIST_SELECT,
  medicalRecord: {
    select: {
      id: true,
      diagnosis: true,
      prescription: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  review: {
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
    },
  },
} as const;

@Injectable()
export class AppointmentService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ───────────────────────────────────────────────

  private getPagination(page = 1, limit = 10) {
    return { take: limit, skip: (page - 1) * limit };
  }

  /**
   * Parse "YYYY-MM-DD" → Date UTC 00:00:00.
   */
  private parseDate(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  /**
   * Kiểm tra appointment tồn tại, throw 404 nếu không.
   */
  private async getAppointmentOrThrow(id: string) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        timeSlot: { select: { id: true, date: true, startTime: true } },
        patientProfile: { select: { userId: true, fullName: true } },
        doctor: { select: { id: true, userId: true } },
      },
    });

    if (!appt) {
      throw new NotFoundException(`Không tìm thấy lịch hẹn với id "${id}"`);
    }

    return appt;
  }

  /**
   * Khi appointment bị cancelled → trả lại slot (isBooked = false).
   * Khi appointment hoàn thành → giữ nguyên slot đã booked.
   */
  private async releaseTimeSlot(timeSlotId: string): Promise<void> {
    await this.prisma.timeSlot.update({
      where: { id: timeSlotId },
      data: { isBooked: false },
    });
  }

  // ─── User APIs ─────────────────────────────────────────────

  /**
   * POST /appointments
   * User đặt lịch khám.
   *
   * Logic (atomic transaction):
   *  1. Verify patientProfile thuộc về user
   *  2. Fetch timeSlot + lock (select for update)
   *  3. Kiểm tra slot chưa bị đặt / bị block
   *  4. Tạo Appointment
   *  5. Cập nhật TimeSlot.isBooked = true
   */
  async create(userId: string, dto: CreateAppointmentDto) {
    // Verify patient profile ownership
    const profile = await this.prisma.patientProfile.findUnique({
      where: { id: dto.patientProfileId },
      select: { id: true, userId: true },
    });

    if (!profile) {
      throw new NotFoundException('Không tìm thấy hồ sơ bệnh nhân');
    }

    if (profile.userId !== userId) {
      throw new ForbiddenException(
        'Hồ sơ bệnh nhân này không thuộc về tài khoản của bạn',
      );
    }

    // Transaction để tránh race condition khi 2 người cùng chọn 1 slot
    return this.prisma.$transaction(async (tx) => {
      // Lock slot bằng findUnique trong transaction
      const slot = await tx.timeSlot.findUnique({
        where: { id: dto.timeSlotId },
        select: {
          id: true,
          doctorId: true,
          hospitalId: true,
          date: true,
          startTime: true,
          endTime: true,
          isBooked: true,
          isBlocked: true,
        },
      });

      if (!slot) {
        throw new NotFoundException('Không tìm thấy khung giờ khám');
      }

      if (slot.isBlocked) {
        throw new BadRequestException(
          'Khung giờ này đã bị khoá, vui lòng chọn khung giờ khác',
        );
      }

      if (slot.isBooked) {
        throw new ConflictException(
          'Khung giờ này đã được đặt, vui lòng chọn khung giờ khác',
        );
      }

      // Kiểm tra slot không phải trong quá khứ
      const slotDate = new Date(slot.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (slotDate < today) {
        throw new BadRequestException(
          'Không thể đặt lịch cho ngày đã qua',
        );
      }

      // Kiểm tra user không có lịch hẹn ACTIVE khác với cùng bác sĩ trong cùng ngày
      // (tránh spam đặt trùng)
      const duplicateCheck = await tx.appointment.findFirst({
        where: {
          patientProfileId: dto.patientProfileId,
          doctorId: slot.doctorId,
          status: {
            in: [
              AppointmentStatus.pending,
              AppointmentStatus.confirmed,
              AppointmentStatus.processing,
            ],
          },
          timeSlot: {
            date: { equals: slot.date },
          },
        },
        select: { id: true },
      });

      if (duplicateCheck) {
        throw new ConflictException(
          'Bạn đã có lịch hẹn với bác sĩ này trong ngày hôm đó',
        );
      }

      // Tạo appointment + lock slot — 2 thao tác trong cùng transaction
      const [appointment] = await Promise.all([
        tx.appointment.create({
          data: {
            patientProfileId: dto.patientProfileId,
            doctorId: slot.doctorId,
            hospitalId: slot.hospitalId,
            timeSlotId: dto.timeSlotId,
            reason: dto.reason,
            status: AppointmentStatus.pending,
          },
          select: APPOINTMENT_DETAIL_SELECT,
        }),
        tx.timeSlot.update({
          where: { id: dto.timeSlotId },
          data: { isBooked: true },
        }),
      ]);

      return appointment;
    });
  }

  /**
   * GET /users/me/appointments?status&page&limit
   * User xem danh sách lịch hẹn của mình.
   */
  async findMyAppointments(userId: string, query: QueryMyAppointmentsDto) {
    const { status, page, limit } = query;
    const { take, skip } = this.getPagination(page, limit);

    // Lấy tất cả patientProfileId của user
    const profiles = await this.prisma.patientProfile.findMany({
      where: { userId },
      select: { id: true },
    });
    const profileIds = profiles.map((p) => p.id);

    const where = {
      patientProfileId: { in: profileIds },
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        select: APPOINTMENT_LIST_SELECT,
        orderBy: [
          // Sắp xếp: pending/confirmed lên đầu, sau đó theo ngày khám gần nhất
          { createdAt: 'desc' },
        ],
        take,
        skip,
      }),
      this.prisma.appointment.count({ where }),
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
   * GET /users/me/appointments/:id
   * User xem chi tiết 1 lịch hẹn — có ownership check.
   */
  async findMyAppointmentById(userId: string, appointmentId: string) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        ...APPOINTMENT_DETAIL_SELECT,
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

    if (!appt) {
      throw new NotFoundException('Không tìm thấy lịch hẹn');
    }

    // Ownership: patientProfile phải thuộc về user này
    if (appt.patientProfile.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xem lịch hẹn này');
    }

    // Ẩn userId khỏi response
    const { patientProfile: { userId: _uid, ...profileData }, ...rest } = appt;
    return { ...rest, patientProfile: profileData };
  }

  /**
   * POST /appointments/:id/cancel
   * User huỷ lịch hẹn của mình.
   * Chỉ được huỷ khi status = pending hoặc confirmed.
   */
  async cancelByUser(
    userId: string,
    appointmentId: string,
    dto: CancelAppointmentDto,
  ) {
    const appt = await this.getAppointmentOrThrow(appointmentId);

    // Ownership check
    if (appt.patientProfile.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền huỷ lịch hẹn này');
    }

    if (!USER_CANCELLABLE_STATUSES.includes(appt.status)) {
      throw new BadRequestException(
        `Không thể huỷ lịch hẹn ở trạng thái "${appt.status}". Chỉ có thể huỷ khi đang chờ xác nhận hoặc đã xác nhận.`,
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.cancelled,
          cancelReason: dto.cancelReason,
          cancelledBy: CancelledBy.patient,
        },
        select: APPOINTMENT_DETAIL_SELECT,
      }),
      // Trả lại slot
      this.prisma.timeSlot.update({
        where: { id: appt.timeSlotId },
        data: { isBooked: false },
      }),
    ]);

    return updated;
  }

  // ─── Doctor APIs ───────────────────────────────────────────

  /**
   * GET /doctors/me/appointments?date&status&page&limit
   * Bác sĩ xem danh sách lịch hẹn của mình.
   */
  async findDoctorAppointments(
    userId: string,
    query: QueryDoctorAppointmentsDto,
  ) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!doctor) {
      throw new NotFoundException('Không tìm thấy hồ sơ bác sĩ');
    }

    const { date, status, page, limit } = query;
    const { take, skip } = this.getPagination(page, limit);

    const where = {
      doctorId: doctor.id,
      ...(status && { status }),
      ...(date && {
        timeSlot: {
          date: { equals: this.parseDate(date) },
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        select: APPOINTMENT_LIST_SELECT,
        orderBy: [
          { timeSlot: { date: 'asc' } },
          { timeSlot: { startTime: 'asc' } },
        ],
        take,
        skip,
      }),
      this.prisma.appointment.count({ where }),
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
   * PATCH /appointments/:id/status  (Doctor)
   * Bác sĩ cập nhật trạng thái lịch hẹn.
   *
   * Transition hợp lệ:
   *   pending → confirmed
   *   confirmed → processing | cancelled
   *   processing → completed | no_show
   */
  async updateStatusByDoctor(
    userId: string,
    appointmentId: string,
    dto: UpdateAppointmentStatusDto,
  ) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!doctor) {
      throw new NotFoundException('Không tìm thấy hồ sơ bác sĩ');
    }

    const appt = await this.getAppointmentOrThrow(appointmentId);

    // Ownership check — chỉ được cập nhật lịch hẹn của mình
    if (appt.doctorId !== doctor.id) {
      throw new ForbiddenException('Bạn không có quyền cập nhật lịch hẹn này');
    }

    const allowedNext = DOCTOR_ALLOWED_TRANSITIONS[appt.status] ?? [];
    if (!allowedNext.includes(dto.status)) {
      throw new BadRequestException(
        `Không thể chuyển từ trạng thái "${appt.status}" sang "${dto.status}"`,
      );
    }

    // Nếu bác sĩ cancel → trả lại slot
    const shouldReleaseSlot = dto.status === AppointmentStatus.cancelled;

    const updates: Parameters<typeof this.prisma.appointment.update>[0]['data'] = {
      status: dto.status,
    };

    if (shouldReleaseSlot) {
      updates.cancelledBy = CancelledBy.doctor;
    }

    if (shouldReleaseSlot) {
      const [updated] = await this.prisma.$transaction([
        this.prisma.appointment.update({
          where: { id: appointmentId },
          data: updates,
          select: APPOINTMENT_DETAIL_SELECT,
        }),
        this.prisma.timeSlot.update({
          where: { id: appt.timeSlotId },
          data: { isBooked: false },
        }),
      ]);
      return updated;
    }

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: updates,
      select: APPOINTMENT_DETAIL_SELECT,
    });
  }

  // ─── Admin APIs ────────────────────────────────────────────

  /**
   * GET /admin/appointments?status&doctorId&hospitalId&fromDate&toDate&search&page&limit
   * Admin xem tất cả lịch hẹn — filter đa chiều.
   */
  async adminFindAll(query: QueryAdminAppointmentsDto) {
    const {
      search,
      status,
      doctorId,
      hospitalId,
      fromDate,
      toDate,
      page,
      limit,
    } = query;
    const { take, skip } = this.getPagination(page, limit);

    const where: any = {
      ...(status && { status }),
      ...(doctorId && { doctorId }),
      ...(hospitalId && { hospitalId }),
      // Filter theo ngày tạo appointment
      ...((fromDate || toDate) && {
        createdAt: {
          ...(fromDate && { gte: this.parseDate(fromDate) }),
          ...(toDate && {
            // Lấy hết ngày toDate (23:59:59)
            lte: new Date(this.parseDate(toDate).getTime() + 86399999),
          }),
        },
      }),
      // Tìm theo tên bệnh nhân hoặc tên bác sĩ
      ...(search && {
        OR: [
          {
            patientProfile: {
              fullName: { contains: search, mode: 'insensitive' as const },
            },
          },
          {
            doctor: {
              user: {
                OR: [
                  {
                    firstName: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    lastName: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              },
            },
          },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        select: APPOINTMENT_LIST_SELECT,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.appointment.count({ where }),
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
   * GET /admin/appointments/:id
   * Admin xem chi tiết bất kỳ lịch hẹn.
   */
  async adminFindById(id: string) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id },
      select: APPOINTMENT_DETAIL_SELECT,
    });

    if (!appt) {
      throw new NotFoundException(`Không tìm thấy lịch hẹn với id "${id}"`);
    }

    return appt;
  }

  /**
   * PATCH /admin/appointments/:id/status
   * Admin cập nhật trạng thái — linh hoạt hơn Doctor.
   *
   * Admin KHÔNG được backward (completed → pending).
   * Admin CÓ THỂ cancel ở bất kỳ trạng thái nào chưa kết thúc.
   */
  async updateStatusByAdmin(
    appointmentId: string,
    dto: UpdateAppointmentStatusDto,
  ) {
    const appt = await this.getAppointmentOrThrow(appointmentId);

    // Không cho thay đổi lịch đã kết thúc (completed, cancelled, no_show)
    const TERMINAL_STATUSES: AppointmentStatus[] = [
      AppointmentStatus.completed,
      AppointmentStatus.cancelled,
      AppointmentStatus.no_show,
    ];

    if (TERMINAL_STATUSES.includes(appt.status)) {
      throw new BadRequestException(
        `Không thể thay đổi trạng thái lịch hẹn đã ở trạng thái "${appt.status}"`,
      );
    }

    const shouldReleaseSlot = dto.status === AppointmentStatus.cancelled;

    if (shouldReleaseSlot) {
      const [updated] = await this.prisma.$transaction([
        this.prisma.appointment.update({
          where: { id: appointmentId },
          data: {
            status: dto.status,
            cancelledBy: CancelledBy.admin,
          },
          select: APPOINTMENT_DETAIL_SELECT,
        }),
        this.prisma.timeSlot.update({
          where: { id: appt.timeSlotId },
          data: { isBooked: false },
        }),
      ]);
      return updated;
    }

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: dto.status },
      select: APPOINTMENT_DETAIL_SELECT,
    });
  }

  /**
   * PATCH /admin/appointments/:id/cancel
   * Admin huỷ lịch hẹn — tường minh hơn /status với cancelReason.
   */
  async cancelByAdmin(
    appointmentId: string,
    dto: CancelAppointmentDto,
  ) {
    const appt = await this.getAppointmentOrThrow(appointmentId);

    if (!ADMIN_CANCELLABLE_STATUSES.includes(appt.status)) {
      throw new BadRequestException(
        `Không thể huỷ lịch hẹn ở trạng thái "${appt.status}"`,
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.cancelled,
          cancelReason: dto.cancelReason,
          cancelledBy: CancelledBy.admin,
        },
        select: APPOINTMENT_DETAIL_SELECT,
      }),
      this.prisma.timeSlot.update({
        where: { id: appt.timeSlotId },
        data: { isBooked: false },
      }),
    ]);

    return updated;
  }

  // ─── Internal helpers ──────────────────────────────────────

  /**
   * Dùng nội bộ bởi ReviewService để verify appointment = completed
   * và chưa có review.
   */
  async verifyCompletedForReview(
    appointmentId: string,
    userId: string,
  ) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        status: true,
        doctorId: true,
        hospitalId: true,
        patientProfile: { select: { userId: true } },
        review: { select: { id: true } },
      },
    });

    if (!appt) {
      throw new NotFoundException('Không tìm thấy lịch hẹn');
    }

    if (appt.patientProfile.userId !== userId) {
      throw new ForbiddenException('Lịch hẹn này không thuộc về bạn');
    }

    if (appt.status !== AppointmentStatus.completed) {
      throw new BadRequestException(
        'Chỉ có thể đánh giá sau khi hoàn thành khám bệnh',
      );
    }

    if (appt.review) {
      throw new ConflictException('Bạn đã đánh giá lịch hẹn này rồi');
    }

    return appt;
  }
}
