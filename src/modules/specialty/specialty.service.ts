import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateSpecialtyDto, UpdateSpecialtyDto, QuerySpecialtyDto } from "./dto/specialty.dto";

@Injectable()
export class SpecialtyService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ───────────────────────────────────────────────

  /**
   * Sinh slug từ tên tiếng Việt.
   * VD: "Tim mạch" → "tim-mach"
   */
  private toSlug(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  /**
   * Kiểm tra slug đã tồn tại chưa, bỏ qua record có excludeId (dùng khi update).
   */
  private async assertSlugUnique(slug: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.specialty.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Slug "${slug}" đã được sử dụng`);
    }
  }

  /**
   * Kiểm tra tên đã tồn tại chưa, bỏ qua record có excludeId (dùng khi update).
   */
  private async assertNameUnique(name: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.specialty.findUnique({
      where: { name },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Tên chuyên khoa "${name}" đã tồn tại`);
    }
  }

  // ─── Public APIs ───────────────────────────────────────────

  /**
   * GET /specialties
   * Trả về danh sách chuyên khoa (mặc định chỉ active).
   * Kèm _count bác sĩ để frontend hiển thị "X bác sĩ".
   */
  async findAll(query: QuerySpecialtyDto) {
    const { search, isActive } = query;

    return this.prisma.specialty.findMany({
      where: {
        // Mặc định isActive = true nếu không truyền
        isActive: isActive !== undefined ? isActive : true,
        ...(search && {
          name: {
            contains: search,
            mode: 'insensitive', // case-insensitive search
          },
        }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        icon: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            // Chỉ đếm bác sĩ đang active và đã verified
            doctors: {
              where: {
                doctor: {
                  isActive: true,
                  isVerified: true,
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * GET /specialties/:slug
   * Trả về chi tiết specialty + danh sách bác sĩ thuộc chuyên khoa.
   */
  async findBySlug(slug: string) {
    const specialty = await this.prisma.specialty.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        icon: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        doctors: {
          where: {
            doctor: {
              isActive: true,
              isVerified: true,
            },
          },
          select: {
            isPrimary: true,
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
                hospitals: {
                  where: { isActive: true },
                  select: {
                    hospital: {
                      select: {
                        id: true,
                        name: true,
                        slug: true,
                        city: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: [
            { isPrimary: 'desc' },
          ],
        },
      },
    });

    if (!specialty) {
      throw new NotFoundException(`Không tìm thấy chuyên khoa "${slug}"`);
    }

    return specialty;
  }

  // ─── Admin APIs ────────────────────────────────────────────

  /**
   * GET /admin/specialties
   * Admin xem tất cả specialty kể cả inactive + filter linh hoạt.
   */
  async adminFindAll(query: QuerySpecialtyDto) {
    const { search, isActive } = query;

    return this.prisma.specialty.findMany({
      where: {
        // Admin không filter isActive mặc định
        ...(isActive !== undefined && { isActive }),
        ...(search && {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        icon: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { doctors: true }, // Admin xem tổng số bác sĩ, không lọc
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * POST /admin/specialties
   */
  async create(dto: CreateSpecialtyDto) {
    const slug = dto.slug ?? this.toSlug(dto.name);

    await this.assertNameUnique(dto.name);
    await this.assertSlugUnique(slug);

    return this.prisma.specialty.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        icon: dto.icon,
      },
    });
  }

  /**
   * PATCH /admin/specialties/:id
   */
  async update(id: string, dto: UpdateSpecialtyDto) {
    // Kiểm tra tồn tại
    await this.findById(id);

    if (dto.name) await this.assertNameUnique(dto.name, id);

    const slug = dto.slug ?? (dto.name ? this.toSlug(dto.name) : undefined);
    if (slug) await this.assertSlugUnique(slug, id);

    return this.prisma.specialty.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(slug && { slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  /**
   * DELETE /admin/specialties/:id
   * Soft delete: chỉ set isActive = false.
   * Không xóa thật để tránh mất dữ liệu lịch sử.
   */
  async remove(id: string) {
    await this.findById(id);

    // Kiểm tra có bác sĩ đang active không
    const activeDoctorCount = await this.prisma.doctorSpecialty.count({
      where: {
        specialtyId: id,
        doctor: { isActive: true },
      },
    });

    if (activeDoctorCount > 0) {
      throw new ConflictException(
        `Không thể xóa chuyên khoa đang có ${activeDoctorCount} bác sĩ hoạt động`,
      );
    }

    return this.prisma.specialty.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─── Internal helpers ──────────────────────────────────────

  /**
   * Tìm theo id — dùng nội bộ, throw 404 nếu không tìm thấy.
   */
  async findById(id: string) {
    const specialty = await this.prisma.specialty.findUnique({
      where: { id },
    });

    if (!specialty) {
      throw new NotFoundException(`Không tìm thấy chuyên khoa với id "${id}"`);
    }

    return specialty;
  }
}
