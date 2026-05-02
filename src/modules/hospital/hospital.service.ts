import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateHospitalDto,
  UpdateHospitalDto,
  QueryHospitalDto,
} from './dto/hospital.dto';

@Injectable()
export class HospitalService {
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

  private async assertNameUnique(
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.hospital.findUnique({
      where: { name },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Tên bệnh viện "${name}" đã tồn tại`);
    }
  }

  private async assertSlugUnique(
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.hospital.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Slug "${slug}" đã được sử dụng`);
    }
  }

  /** Tính offset từ page + limit */
  private getPagination(page = 1, limit = 10) {
    const take = limit;
    const skip = (page - 1) * limit;
    return { take, skip };
  }

  // ─── Public APIs ───────────────────────────────────────────

  /**
   * GET /hospitals?city=&type=&search=&page=&limit=
   * Danh sách bệnh viện — public, có pagination.
   */
  async findAll(query: QueryHospitalDto) {
    const { search, city, type, page, limit } = query;
    const { take, skip } = this.getPagination(page, limit);

    const where = {
      isActive: true,
      ...(search && {
        name: { contains: search, mode: 'insensitive' as const },
      }),
      ...(city && {
        city: { contains: city, mode: 'insensitive' as const },
      }),
      ...(type && { type }),
    };

    const [data, total] = await Promise.all([
      this.prisma.hospital.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          address: true,
          city: true,
          type: true,
          avatar: true,
          description: true,
          rating: true,
          totalReviews: true,
          isActive: true,
          _count: {
            select: {
              // Chỉ đếm bác sĩ đang active + verified
              doctors: {
                where: {
                  doctor: { isActive: true, isVerified: true },
                },
              },
            },
          },
        },
        orderBy: [{ rating: 'desc' }, { name: 'asc' }],
        take,
        skip,
      }),
      this.prisma.hospital.count({ where }),
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
   * GET /hospitals/:slug
   * Chi tiết bệnh viện + danh sách bác sĩ + reviews gần đây.
   */
  async findBySlug(slug: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        address: true,
        city: true,
        type: true,
        avatar: true,
        description: true,
        rating: true,
        totalReviews: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,

        // Bác sĩ làm việc tại bệnh viện này
        doctors: {
          where: {
            isActive: true,
            doctor: { isActive: true, isVerified: true },
          },
          select: {
            workingDays: true,
            startTime: true,
            endTime: true,
            doctor: {
              select: {
                id: true,
                slug: true,
                bio: true,
                experience: true,
                consultationFee: true,
                rating: true,
                totalReviews: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    avatar: true,
                  },
                },
                // Chuyên khoa chính của bác sĩ
                specialties: {
                  where: { isPrimary: true },
                  select: {
                    specialty: {
                      select: { id: true, name: true, slug: true },
                    },
                  },
                },
              },
            },
          },
          orderBy: { doctor: { rating: 'desc' } },
        },

        // 5 review mới nhất (visible)
        reviews: {
          where: { isVisible: true },
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            patientProfile: {
              select: { fullName: true },
            },
            doctor: {
              select: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!hospital) {
      throw new NotFoundException(`Không tìm thấy bệnh viện "${slug}"`);
    }

    if (!hospital.isActive) {
      throw new NotFoundException(`Bệnh viện này hiện không hoạt động`);
    }

    return hospital;
  }

  /**
   * Lấy danh sách thành phố có bệnh viện — dùng cho filter dropdown.
   * GET /hospitals/cities
   */
  async getCities(): Promise<string[]> {
    const result = await this.prisma.hospital.findMany({
      where: { isActive: true },
      select: { city: true },
      distinct: ['city'],
      orderBy: { city: 'asc' },
    });
    return result.map((r) => r.city);
  }

  // ─── Admin APIs ────────────────────────────────────────────

  /**
   * GET /admin/hospitals?search=&city=&type=&isActive=&page=&limit=
   * Admin xem tất cả — kể cả inactive.
   */
  async adminFindAll(query: QueryHospitalDto) {
    const { search, city, type, isActive, page, limit } = query;
    const { take, skip } = this.getPagination(page, limit);

    const where = {
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        name: { contains: search, mode: 'insensitive' as const },
      }),
      ...(city && {
        city: { contains: city, mode: 'insensitive' as const },
      }),
      ...(type && { type }),
    };

    const [data, total] = await Promise.all([
      this.prisma.hospital.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          address: true,
          city: true,
          type: true,
          avatar: true,
          rating: true,
          totalReviews: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              doctors: true, // tổng bác sĩ (không lọc)
              appointments: true, // tổng lịch hẹn
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.hospital.count({ where }),
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
   * POST /admin/hospitals
   */
  async create(dto: CreateHospitalDto) {
    const slug = dto.slug ?? this.toSlug(dto.name);

    await this.assertNameUnique(dto.name);
    await this.assertSlugUnique(slug);

    return this.prisma.hospital.create({
      data: {
        name: dto.name,
        slug,
        address: dto.address,
        city: dto.city,
        type: dto.type,
        avatar: dto.avatar,
        description: dto.description,
      },
    });
  }

  /**
   * PATCH /admin/hospitals/:id
   */
  async update(id: string, dto: UpdateHospitalDto) {
    await this.findById(id);

    if (dto.name) await this.assertNameUnique(dto.name, id);

    const slug = dto.slug ?? (dto.name ? this.toSlug(dto.name) : undefined);
    if (slug) await this.assertSlugUnique(slug, id);

    return this.prisma.hospital.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(slug && { slug }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.avatar !== undefined && { avatar: dto.avatar }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  /**
   * DELETE /admin/hospitals/:id
   * Soft delete — set isActive = false.
   * Không cho xóa nếu còn bác sĩ đang active hoặc appointment pending/confirmed.
   */
  async remove(id: string) {
    await this.findById(id);

    // Kiểm tra bác sĩ đang làm việc
    const activeDoctorCount = await this.prisma.doctorHospital.count({
      where: {
        hospitalId: id,
        isActive: true,
        doctor: { isActive: true },
      },
    });

    if (activeDoctorCount > 0) {
      throw new ConflictException(
        `Không thể vô hiệu hóa bệnh viện đang có ${activeDoctorCount} bác sĩ hoạt động`,
      );
    }

    // Kiểm tra lịch hẹn chưa xử lý xong
    const pendingAppointmentCount = await this.prisma.appointment.count({
      where: {
        hospitalId: id,
        status: { in: ['pending', 'confirmed', 'processing'] },
      },
    });

    if (pendingAppointmentCount > 0) {
      throw new ConflictException(
        `Không thể vô hiệu hóa bệnh viện đang có ${pendingAppointmentCount} lịch hẹn chưa hoàn tất`,
      );
    }

    return this.prisma.hospital.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─── Internal helpers ──────────────────────────────────────

  async findById(id: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id },
    });
    if (!hospital) {
      throw new NotFoundException(`Không tìm thấy bệnh viện với id "${id}"`);
    }
    return hospital;
  }
}
