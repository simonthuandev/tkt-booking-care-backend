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
  CreateReviewDto,
  UpdateReviewVisibilityDto,
  QueryReviewDto,
  QueryAdminReviewDto,
} from './dto/review.dto';

// ─── Select shapes ─────────────────────────────────────────────

const REVIEW_SELECT = {
  id: true,
  rating: true,
  comment: true,
  isVisible: true,
  createdAt: true,
  patientProfile: {
    select: {
      id: true,
      fullName: true,
    },
  },
  doctor: {
    select: {
      id: true,
      slug: true,
      user: {
        select: { firstName: true, lastName: true, avatar: true },
      },
    },
  },
  hospital: {
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
    },
  },
  appointment: {
    select: {
      id: true,
      timeSlot: {
        select: { date: true, startTime: true },
      },
    },
  },
} as const;

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ───────────────────────────────────────────────

  private getPagination(page = 1, limit = 10) {
    return { take: limit, skip: (page - 1) * limit };
  }

  /**
   * Tính lại rating trung bình + totalReviews cho Doctor.
   * Gọi sau mỗi lần tạo review hoặc thay đổi visibility.
   */
  private async recalcDoctorRating(doctorId: string): Promise<void> {
    const result = await this.prisma.review.aggregate({
      where: { doctorId, isVisible: true },
      _avg: { rating: true },
      _count: { id: true },
    });

    await this.prisma.doctor.update({
      where: { id: doctorId },
      data: {
        rating: Math.round((result._avg.rating ?? 0) * 10) / 10, // 1 chữ số thập phân
        totalReviews: result._count.id,
      },
    });
  }

  /**
   * Tính lại rating trung bình + totalReviews cho Hospital.
   * Gọi sau mỗi lần tạo review hoặc thay đổi visibility.
   */
  private async recalcHospitalRating(hospitalId: string): Promise<void> {
    const result = await this.prisma.review.aggregate({
      where: { hospitalId, isVisible: true },
      _avg: { rating: true },
      _count: { id: true },
    });

    await this.prisma.hospital.update({
      where: { id: hospitalId },
      data: {
        rating: Math.round((result._avg.rating ?? 0) * 10) / 10,
        totalReviews: result._count.id,
      },
    });
  }

  // ─── User APIs ─────────────────────────────────────────────

  /**
   * POST /reviews
   * User tạo review sau khi appointment = completed.
   *
   * Điều kiện:
   *  1. Appointment phải ở trạng thái completed
   *  2. Appointment phải thuộc về user đang đăng nhập
   *  3. Chưa có review nào cho appointment này
   */
  async create(userId: string, dto: CreateReviewDto) {
    // Lấy appointment + kiểm tra điều kiện
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointmentId },
      select: {
        id: true,
        status: true,
        doctorId: true,
        hospitalId: true,
        patientProfileId: true,
        patientProfile: { select: { userId: true } },
        review: { select: { id: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Không tìm thấy lịch hẹn');
    }

    // Ownership: appointment phải thuộc về user này
    if (appointment.patientProfile.userId !== userId) {
      throw new ForbiddenException('Lịch hẹn này không thuộc về bạn');
    }

    // Chỉ review khi appointment đã hoàn thành
    if (appointment.status !== AppointmentStatus.completed) {
      throw new BadRequestException(
        'Chỉ có thể đánh giá sau khi hoàn thành buổi khám',
      );
    }

    // 1 appointment chỉ có 1 review
    if (appointment.review) {
      throw new ConflictException('Bạn đã đánh giá lịch hẹn này rồi');
    }

    // Tạo review trong transaction + cập nhật cached rating
    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          appointmentId: dto.appointmentId,
          patientProfileId: appointment.patientProfileId,
          doctorId: appointment.doctorId,
          hospitalId: appointment.hospitalId,
          rating: dto.rating,
          comment: dto.comment,
          isVisible: true,
        },
        select: REVIEW_SELECT,
      });

      return created;
    });

    // Cập nhật cached rating sau transaction (nếu fail thì chỉ cache sai, không rollback review)
    await Promise.all([
      this.recalcDoctorRating(appointment.doctorId),
      this.recalcHospitalRating(appointment.hospitalId),
    ]);

    return review;
  }

  /**
   * GET /reviews?doctorId&hospitalId&page&limit
   * Lấy danh sách review visible — public.
   * Phải truyền ít nhất 1 trong 2: doctorId hoặc hospitalId.
   */
  async findAll(query: QueryReviewDto) {
    const { doctorId, hospitalId, page, limit } = query;

    if (!doctorId && !hospitalId) {
      throw new BadRequestException(
        'Phải truyền ít nhất doctorId hoặc hospitalId',
      );
    }

    const { take, skip } = this.getPagination(page, limit);

    const where = {
      isVisible: true,
      ...(doctorId && { doctorId }),
      ...(hospitalId && { hospitalId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        select: REVIEW_SELECT,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.review.count({ where }),
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
   * GET /users/me/reviews
   * User xem tất cả review họ đã viết.
   */
  async findByUser(userId: string, query: { page?: number; limit?: number }) {
    const { page = 1, limit = 10 } = query;
    const { take, skip } = this.getPagination(page, limit);

    // Lấy tất cả patientProfileId của user
    const profiles = await this.prisma.patientProfile.findMany({
      where: { userId },
      select: { id: true },
    });
    const profileIds = profiles.map((p) => p.id);

    const where = { patientProfileId: { in: profileIds } };

    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        select: REVIEW_SELECT,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  // ─── Admin APIs ────────────────────────────────────────────

  /**
   * GET /admin/reviews?doctorId&hospitalId&patientProfileId&isVisible&rating&page&limit
   * Admin xem tất cả review — kể cả đã ẩn.
   */
  async adminFindAll(query: QueryAdminReviewDto) {
    const {
      doctorId,
      hospitalId,
      patientProfileId,
      isVisible,
      rating,
      page,
      limit,
    } = query;
    const { take, skip } = this.getPagination(page, limit);

    const where = {
      ...(doctorId && { doctorId }),
      ...(hospitalId && { hospitalId }),
      ...(patientProfileId && { patientProfileId }),
      ...(isVisible !== undefined && { isVisible }),
      ...(rating !== undefined && { rating }),
    };

    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        select: REVIEW_SELECT,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.review.count({ where }),
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
   * GET /admin/reviews/:id
   * Admin xem chi tiết 1 review.
   */
  async adminFindById(id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      select: REVIEW_SELECT,
    });

    if (!review) {
      throw new NotFoundException(`Không tìm thấy review với id "${id}"`);
    }

    return review;
  }

  /**
   * PATCH /admin/reviews/:id/visibility
   * Admin ẩn hoặc hiện 1 review.
   * Trigger cập nhật lại cached rating sau mỗi thay đổi.
   */
  async updateVisibility(id: string, dto: UpdateReviewVisibilityDto) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      select: {
        id: true,
        isVisible: true,
        doctorId: true,
        hospitalId: true,
      },
    });

    if (!review) {
      throw new NotFoundException(`Không tìm thấy review với id "${id}"`);
    }

    // Không cập nhật nếu trạng thái không thay đổi
    if (review.isVisible === dto.isVisible) {
      throw new BadRequestException(
        `Review này đã ở trạng thái ${dto.isVisible ? 'hiển thị' : 'ẩn'} rồi`,
      );
    }

    const updated = await this.prisma.review.update({
      where: { id },
      data: { isVisible: dto.isVisible },
      select: REVIEW_SELECT,
    });

    // Cập nhật lại cached rating sau khi thay đổi visibility
    await Promise.all([
      this.recalcDoctorRating(review.doctorId),
      this.recalcHospitalRating(review.hospitalId),
    ]);

    return updated;
  }
}
