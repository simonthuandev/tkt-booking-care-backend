import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreatePatientProfileDto,
  UpdatePatientProfileDto,
} from './dto/patient-profile.dto';

// Số lượng hồ sơ tối đa 1 user có thể tạo
const MAX_PROFILES_PER_USER = 5;

@Injectable()
export class PatientProfileService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ───────────────────────────────────────────────

  /**
   * Kiểm tra profile tồn tại VÀ thuộc về userId.
   * Throw 404 nếu không tìm thấy, 403 nếu không phải của mình.
   */
  private async assertOwnership(profileId: string, userId: string) {
    const profile = await this.prisma.patientProfile.findUnique({
      where: { id: profileId },
      select: { id: true, userId: true, isDefault: true },
    });

    if (!profile) {
      throw new NotFoundException(`Không tìm thấy hồ sơ bệnh nhân`);
    }

    if (profile.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền thao tác hồ sơ này');
    }

    return profile;
  }

  // ─── User APIs ─────────────────────────────────────────────

  /**
   * GET /users/me/patient-profiles
   * Lấy tất cả hồ sơ của user hiện tại.
   * Profile mặc định (isDefault=true) luôn đứng đầu.
   */
  async findAllByUser(userId: string) {
    return this.prisma.patientProfile.findMany({
      where: { userId },
      select: {
        id: true,
        fullName: true,
        dob: true,
        gender: true,
        phoneNumber: true,
        address: true,
        relationship: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { isDefault: 'desc' }, // profile mặc định lên đầu
        { createdAt: 'asc' },
      ],
    });
  }

  /**
   * GET /users/me/patient-profiles/:id
   * Xem chi tiết 1 hồ sơ — có ownership check.
   */
  async findOne(profileId: string, userId: string) {
    await this.assertOwnership(profileId, userId);

    return this.prisma.patientProfile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        fullName: true,
        dob: true,
        gender: true,
        phoneNumber: true,
        address: true,
        relationship: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * POST /users/me/patient-profiles
   * Tạo hồ sơ mới.
   *
   * Logic:
   *  - Giới hạn tối đa MAX_PROFILES_PER_USER hồ sơ / user
   *  - Nếu là hồ sơ đầu tiên → tự động set isDefault = true
   *  - Nếu user đã có profile 'self' → không cho tạo thêm loại 'self'
   */
  async create(userId: string, dto: CreatePatientProfileDto) {
    // Kiểm tra giới hạn số lượng hồ sơ
    const existingCount = await this.prisma.patientProfile.count({
      where: { userId },
    });

    if (existingCount >= MAX_PROFILES_PER_USER) {
      throw new BadRequestException(
        `Mỗi tài khoản chỉ được tạo tối đa ${MAX_PROFILES_PER_USER} hồ sơ bệnh nhân`,
      );
    }

    // Không cho tạo 2 hồ sơ loại 'self'
    if (dto.relationship === 'self' || !dto.relationship) {
      const hasSelf = await this.prisma.patientProfile.findFirst({
        where: { userId, relationship: 'self' },
        select: { id: true },
      });

      if (hasSelf) {
        throw new ConflictException(
          'Bạn đã có hồ sơ cá nhân (self). Chỉ được phép 1 hồ sơ loại này.',
        );
      }
    }

    // Hồ sơ đầu tiên → tự động thành default
    const isFirstProfile = existingCount === 0;

    return this.prisma.patientProfile.create({
      data: {
        userId,
        fullName: dto.fullName,
        dob: dto.dob ? new Date(dto.dob) : undefined,
        gender: dto.gender,
        phoneNumber: dto.phoneNumber,
        address: dto.address,
        relationship: dto.relationship ?? 'self',
        isDefault: isFirstProfile,
      },
    });
  }

  /**
   * PATCH /users/me/patient-profiles/:id
   * Cập nhật hồ sơ — có ownership check.
   */
  async update(profileId: string, userId: string, dto: UpdatePatientProfileDto) {
    await this.assertOwnership(profileId, userId);

    // Không cho đổi relationship thành 'self' nếu đã có hồ sơ 'self' khác
    if (dto.relationship === 'self') {
      const existingSelf = await this.prisma.patientProfile.findFirst({
        where: {
          userId,
          relationship: 'self',
          id: { not: profileId }, // loại trừ chính nó
        },
        select: { id: true },
      });

      if (existingSelf) {
        throw new ConflictException(
          'Bạn đã có hồ sơ cá nhân (self). Không thể đổi thêm hồ sơ khác thành loại này.',
        );
      }
    }

    return this.prisma.patientProfile.update({
      where: { id: profileId },
      data: {
        ...(dto.fullName && { fullName: dto.fullName }),
        ...(dto.dob !== undefined && { dob: dto.dob ? new Date(dto.dob) : null }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.relationship !== undefined && { relationship: dto.relationship }),
      },
    });
  }

  /**
   * DELETE /users/me/patient-profiles/:id
   * Xóa hồ sơ — có ownership check.
   *
   * Không cho xóa nếu:
   *  - Hồ sơ đang có appointment pending/confirmed/processing
   *  - Đây là hồ sơ default DUY NHẤT (phải giữ ít nhất 1)
   */
  async remove(profileId: string, userId: string) {
    const profile = await this.assertOwnership(profileId, userId);

    // Kiểm tra lịch hẹn đang active
    const activeAppointments = await this.prisma.appointment.count({
      where: {
        patientProfileId: profileId,
        status: { in: ['pending', 'confirmed', 'processing'] },
      },
    });

    if (activeAppointments > 0) {
      throw new ConflictException(
        `Không thể xóa hồ sơ đang có ${activeAppointments} lịch hẹn chưa hoàn tất`,
      );
    }

    // Nếu đây là profile default → cần chuyển default sang profile khác trước khi xóa
    if (profile.isDefault) {
      const otherProfile = await this.prisma.patientProfile.findFirst({
        where: { userId, id: { not: profileId } },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

      if (otherProfile) {
        // Có profile khác → chuyển default sang nó rồi mới xóa
        await this.prisma.$transaction([
          this.prisma.patientProfile.update({
            where: { id: otherProfile.id },
            data: { isDefault: true },
          }),
          this.prisma.patientProfile.delete({ where: { id: profileId } }),
        ]);
      } else {
        // Không có profile khác → đây là profile cuối cùng, không cho xóa
        throw new BadRequestException(
          'Không thể xóa hồ sơ duy nhất. Vui lòng tạo hồ sơ khác trước.',
        );
      }
    } else {
      // Profile không phải default → xóa trực tiếp
      await this.prisma.patientProfile.delete({ where: { id: profileId } });
    }

    return { id: profileId, deleted: true };
  }

  /**
   * PATCH /users/me/patient-profiles/:id/default
   * Đặt 1 hồ sơ làm mặc định.
   *
   * Dùng transaction để:
   *  1. Unset tất cả profile hiện đang là default của user
   *  2. Set profile được chọn thành default
   * → Đảm bảo LUÔN chỉ có đúng 1 profile default tại 1 thời điểm.
   */
  async setDefault(profileId: string, userId: string) {
    await this.assertOwnership(profileId, userId);

    await this.prisma.$transaction([
      // Bước 1: Unset tất cả default của user này
      this.prisma.patientProfile.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      // Bước 2: Set profile được chọn thành default
      this.prisma.patientProfile.update({
        where: { id: profileId },
        data: { isDefault: true },
      }),
    ]);

    return this.prisma.patientProfile.findUnique({
      where: { id: profileId },
    });
  }

  // ─── Internal helpers ──────────────────────────────────────

  /**
   * Dùng nội bộ bởi AppointmentService để verify profile tồn tại
   * và thuộc về userId trước khi đặt lịch.
   */
  async verifyOwnership(profileId: string, userId: string) {
    const profile = await this.prisma.patientProfile.findUnique({
      where: { id: profileId },
      select: { id: true, userId: true, fullName: true },
    });

    if (!profile) {
      throw new NotFoundException('Không tìm thấy hồ sơ bệnh nhân');
    }

    if (profile.userId !== userId) {
      throw new ForbiddenException('Hồ sơ bệnh nhân không thuộc về tài khoản này');
    }

    return profile;
  }
}
