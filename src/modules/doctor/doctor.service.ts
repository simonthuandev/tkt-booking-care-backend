import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { AuthProvider, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateDoctorDto,
  UpdateDoctorDto,
  UpdateDoctorSelfDto,
  QueryDoctorDto,
} from './dto/doctor.dto';

const BCRYPT_SALT_ROUNDS = 12;

// ─── Select shapes tái sử dụng ───────────────────────────────

/** Select shape cho listing card — gọn, đủ để hiển thị */
const DOCTOR_CARD_SELECT = {
  id: true,
  slug: true,
  bio: true,
  experience: true,
  consultationFee: true,
  rating: true,
  totalReviews: true,
  isVerified: true,
  isActive: true,
  user: {
    select: {
      firstName: true,
      lastName: true,
      avatar: true,
      email: true,
    },
  },
  specialties: {
    select: {
      isPrimary: true,
      specialty: {
        select: { id: true, name: true, slug: true },
      },
    },
    orderBy: { isPrimary: 'desc' as const },
  },
  hospitals: {
    where: { isActive: true },
    select: {
      workingDays: true,
      startTime: true,
      endTime: true,
      hospital: {
        select: { id: true, name: true, slug: true, city: true },
      },
    },
  },
} as const;

/** Select shape cho detail page — đầy đủ hơn */
const DOCTOR_DETAIL_SELECT = {
  ...DOCTOR_CARD_SELECT,
  licenseNumber: true,
  createdAt: true,
  updatedAt: true,
  // 5 review gần nhất visible
  reviews: {
    where: { isVisible: true },
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      patientProfile: { select: { fullName: true } },
    },
    orderBy: { createdAt: 'desc' as const },
    take: 5,
  },
} as const;

@Injectable()
export class DoctorService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ───────────────────────────────────────────────

  private toSlug(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  /** Sinh doctor slug: ten-bac-si-XXXX */
  private generateDoctorSlug(firstName: string, lastName: string): string {
    const fullName = `${lastName} ${firstName}`;
    const base = this.toSlug(fullName);
    const suffix = Math.random().toString(36).substring(2, 6);
    return `${base}-${suffix}`;
  }

  private async assertSlugUnique(slug: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.doctor.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Slug "${slug}" đã được sử dụng`);
    }
  }

  private async assertEmailUnique(email: string, excludeUserId?: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing && existing.id !== excludeUserId) {
      throw new ConflictException(`Email "${email}" đã được sử dụng`);
    }
  }

  /**
   * Validate specialtyIds và hospitalIds tồn tại trong DB.
   * Throw BadRequest nếu bất kỳ ID nào không tìm thấy.
   */
  private async validateSpecialtyIds(ids: string[]): Promise<void> {
    const found = await this.prisma.specialty.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      throw new BadRequestException('Một hoặc nhiều chuyên khoa không tồn tại hoặc không active');
    }
  }

  private async validateHospitalIds(ids: string[]): Promise<void> {
    const found = await this.prisma.hospital.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      throw new BadRequestException('Một hoặc nhiều bệnh viện không tồn tại hoặc không active');
    }
  }

  private getPagination(page = 1, limit = 10) {
    return { take: limit, skip: (page - 1) * limit };
  }

  // ─── Public APIs ───────────────────────────────────────────

  /**
   * GET /doctors?search=&specialtyId=&hospitalId=&city=&page=&limit=
   */
  async findAll(query: QueryDoctorDto) {
    const { search, specialtyId, hospitalId, city, page, limit } = query;
    const { take, skip } = this.getPagination(page, limit);

    const where = {
      isActive: true,
      isVerified: true,
      // Tìm theo tên bác sĩ (trong bảng User)
      ...(search && {
        user: {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        },
      }),
      // Filter theo chuyên khoa
      ...(specialtyId && {
        specialties: { some: { specialtyId } },
      }),
      // Filter theo bệnh viện
      ...(hospitalId && {
        hospitals: { some: { hospitalId, isActive: true } },
      }),
      // Filter theo thành phố (qua bệnh viện)
      ...(city && {
        hospitals: {
          some: {
            isActive: true,
            hospital: { city: { contains: city, mode: 'insensitive' as const } },
          },
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.doctor.findMany({
        where,
        select: DOCTOR_CARD_SELECT,
        orderBy: [{ rating: 'desc' }, { totalReviews: 'desc' }],
        take,
        skip,
      }),
      this.prisma.doctor.count({ where }),
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
   * GET /doctors/:slug
   * Chi tiết bác sĩ + specialties + hospitals + 5 review gần nhất.
   */
  async findBySlug(slug: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { slug },
      select: DOCTOR_DETAIL_SELECT,
    });

    if (!doctor) {
      throw new NotFoundException(`Không tìm thấy bác sĩ "${slug}"`);
    }

    if (!doctor.isActive || !doctor.isVerified) {
      throw new NotFoundException('Bác sĩ này hiện không hoạt động');
    }

    return doctor;
  }

  // ─── Doctor-self APIs ──────────────────────────────────────

  /**
   * GET /doctors/me/profile
   * Bác sĩ xem profile của chính mình (có thêm licenseNumber, v.v.)
   */
  async getMyProfile(userId: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId },
      select: {
        ...DOCTOR_DETAIL_SELECT,
        licenseNumber: true,
      },
    });

    if (!doctor) {
      throw new NotFoundException('Không tìm thấy hồ sơ bác sĩ');
    }

    return doctor;
  }

  /**
   * PATCH /doctors/me/profile
   * Bác sĩ chỉ được đổi: firstName, lastName, avatar, bio.
   */
  async updateMyProfile(userId: string, dto: UpdateDoctorSelfDto) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!doctor) {
      throw new NotFoundException('Không tìm thấy hồ sơ bác sĩ');
    }

    // Cập nhật 2 bảng trong transaction
    await this.prisma.$transaction([
      // User fields
      this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(dto.firstName && { firstName: dto.firstName }),
          ...(dto.lastName && { lastName: dto.lastName }),
          ...(dto.avatar !== undefined && { avatar: dto.avatar }),
        },
      }),
      // Doctor fields
      this.prisma.doctor.update({
        where: { userId },
        data: {
          ...(dto.bio !== undefined && { bio: dto.bio }),
        },
      }),
    ]);

    return this.getMyProfile(userId);
  }

  // ─── Admin APIs ────────────────────────────────────────────

  /**
   * GET /admin/doctors?search=&specialtyId=&hospitalId=&isActive=&isVerified=&page=&limit=
   */
  async adminFindAll(query: QueryDoctorDto & { isActive?: boolean; isVerified?: boolean }) {
    const { search, specialtyId, hospitalId, city, page, limit } = query;
    const isActive = (query as any).isActive;
    const isVerified = (query as any).isVerified;
    const { take, skip } = this.getPagination(page, limit);

    const where = {
      ...(isActive !== undefined && { isActive }),
      ...(isVerified !== undefined && { isVerified }),
      ...(search && {
        user: {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        },
      }),
      ...(specialtyId && {
        specialties: { some: { specialtyId } },
      }),
      ...(hospitalId && {
        hospitals: { some: { hospitalId } },
      }),
      ...(city && {
        hospitals: {
          some: {
            hospital: { city: { contains: city, mode: 'insensitive' as const } },
          },
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.doctor.findMany({
        where,
        select: {
          id: true,
          slug: true,
          experience: true,
          consultationFee: true,
          rating: true,
          totalReviews: true,
          licenseNumber: true,
          isVerified: true,
          isActive: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
              isActive: true,
            },
          },
          specialties: {
            select: {
              isPrimary: true,
              specialty: { select: { id: true, name: true } },
            },
          },
          hospitals: {
            select: {
              hospital: { select: { id: true, name: true, city: true } },
              isActive: true,
            },
          },
          _count: {
            select: { appointments: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.doctor.count({ where }),
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
   * POST /admin/doctors
   * Admin tạo User (role=doctor) + Doctor profile + link Specialty + Hospital.
   * Toàn bộ trong 1 transaction để đảm bảo atomicity.
   */
  async create(dto: CreateDoctorDto) {
    await this.assertEmailUnique(dto.email);

    const hospitalIds = dto.hospitals.map((h) => h.hospitalId);
    await Promise.all([
      this.validateSpecialtyIds(dto.specialtyIds),
      this.validateHospitalIds(hospitalIds),
    ]);

    const slug = dto.slug ?? this.generateDoctorSlug(dto.firstName, dto.lastName);
    await this.assertSlugUnique(slug);

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    // Transaction: tạo tất cả hoặc không tạo gì
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Tạo User
      const user = await tx.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          avatar: dto.avatar,
          role: UserRole.doctor,
          provider: AuthProvider.local,
          isEmailVerified: true, // admin tạo → không cần verify email
        },
      });

      // 2. Tạo Doctor profile
      const doctor = await tx.doctor.create({
        data: {
          userId: user.id,
          slug,
          bio: dto.bio,
          experience: dto.experience ?? 0,
          licenseNumber: dto.licenseNumber,
          consultationFee: dto.consultationFee ?? 0,
          isVerified: true, // admin tạo → tự động verified
        },
      });

      // 3. Link Specialties — specialtyIds[0] là primary
      await tx.doctorSpecialty.createMany({
        data: dto.specialtyIds.map((specialtyId, index) => ({
          doctorId: doctor.id,
          specialtyId,
          isPrimary: index === 0,
        })),
      });

      // 4. Link Hospitals
      await tx.doctorHospital.createMany({
        data: dto.hospitals.map((h) => ({
          doctorId: doctor.id,
          hospitalId: h.hospitalId,
          workingDays: h.workingDays,
          startTime: h.startTime,
          endTime: h.endTime,
          isActive: true,
        })),
      });

      return doctor;
    });

    // Trả về full profile sau khi tạo
    return this.findById(result.id);
  }

  /**
   * PATCH /admin/doctors/:id
   * Cập nhật doctor profile + user info + relations.
   */
  async update(id: string, dto: UpdateDoctorDto) {
    const doctor = await this.findById(id);
    const userId = (doctor as any).user?.id ?? await this.getUserIdByDoctorId(id);

    if (dto.slug) await this.assertSlugUnique(dto.slug, id);

    if (dto.specialtyIds) {
      await this.validateSpecialtyIds(dto.specialtyIds);
    }
    if (dto.hospitals) {
      await this.validateHospitalIds(dto.hospitals.map((h) => h.hospitalId));
    }

    await this.prisma.$transaction(async (tx) => {
      // Cập nhật User
      if (dto.firstName || dto.lastName || dto.avatar !== undefined || dto.isUserActive !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(dto.firstName && { firstName: dto.firstName }),
            ...(dto.lastName && { lastName: dto.lastName }),
            ...(dto.avatar !== undefined && { avatar: dto.avatar }),
            ...(dto.isUserActive !== undefined && { isActive: dto.isUserActive }),
          },
        });
      }

      // Cập nhật Doctor profile
      await tx.doctor.update({
        where: { id },
        data: {
          ...(dto.slug && { slug: dto.slug }),
          ...(dto.bio !== undefined && { bio: dto.bio }),
          ...(dto.experience !== undefined && { experience: dto.experience }),
          ...(dto.licenseNumber !== undefined && { licenseNumber: dto.licenseNumber }),
          ...(dto.consultationFee !== undefined && { consultationFee: dto.consultationFee }),
          ...(dto.isVerified !== undefined && { isVerified: dto.isVerified }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });

      // Thay thế toàn bộ specialties nếu có truyền
      if (dto.specialtyIds) {
        await tx.doctorSpecialty.deleteMany({ where: { doctorId: id } });
        await tx.doctorSpecialty.createMany({
          data: dto.specialtyIds.map((specialtyId, index) => ({
            doctorId: id,
            specialtyId,
            isPrimary: index === 0,
          })),
        });
      }

      // Thay thế toàn bộ hospitals nếu có truyền
      if (dto.hospitals) {
        await tx.doctorHospital.deleteMany({ where: { doctorId: id } });
        await tx.doctorHospital.createMany({
          data: dto.hospitals.map((h) => ({
            doctorId: id,
            hospitalId: h.hospitalId,
            workingDays: h.workingDays,
            startTime: h.startTime,
            endTime: h.endTime,
            isActive: true,
          })),
        });
      }
    });

    return this.findById(id);
  }

  /**
   * DELETE /admin/doctors/:id
   * Soft delete — set isActive = false cho cả Doctor và User.
   * Từ chối nếu còn lịch hẹn pending/confirmed/processing.
   */
  async remove(id: string) {
    await this.findById(id);

    const pendingCount = await this.prisma.appointment.count({
      where: {
        doctorId: id,
        status: { in: ['pending', 'confirmed', 'processing'] },
      },
    });

    if (pendingCount > 0) {
      throw new ConflictException(
        `Không thể vô hiệu hóa bác sĩ đang có ${pendingCount} lịch hẹn chưa hoàn tất`,
      );
    }

    const userId = await this.getUserIdByDoctorId(id);

    await this.prisma.$transaction([
      this.prisma.doctor.update({
        where: { id },
        data: { isActive: false },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      }),
    ]);

    return { id, isActive: false };
  }

  // ─── Internal helpers ──────────────────────────────────────

  async findById(id: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
      select: {
        ...DOCTOR_DETAIL_SELECT,
        licenseNumber: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            isActive: true,
          },
        },
      },
    });

    if (!doctor) {
      throw new NotFoundException(`Không tìm thấy bác sĩ với id "${id}"`);
    }

    return doctor;
  }

  private async getUserIdByDoctorId(doctorId: string): Promise<string> {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { userId: true },
    });
    if (!doctor) throw new NotFoundException('Không tìm thấy bác sĩ');
    return doctor.userId;
  }
}
