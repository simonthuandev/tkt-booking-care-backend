import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import {
  CreateReviewDto,
  UpdateReviewVisibilityDto,
  QueryReviewDto,
  QueryAdminReviewDto,
} from './dto/review.dto';
import { Public, Roles, CurrentUser } from '@modules/auth/decorators';
import { UserRole, AuthUser } from '@modules/auth/interfaces/auth.interface';
import { QueryMyMedicalRecordsDto } from '@modules/medical-record/dto/medical-record.dto';

// ─────────────────────────────────────────────────────────────
//  PUBLIC Controller  →  GET /api/v1/reviews
//  Ai cũng xem được review visible — không cần đăng nhập.
// ─────────────────────────────────────────────────────────────

@Public()
@Controller('reviews')
export class ReviewPublicController {
  constructor(private readonly reviewService: ReviewService) {}

  /**
   * GET /api/v1/reviews?doctorId=&hospitalId=&page=&limit=
   * Danh sách review visible — phải truyền doctorId hoặc hospitalId.
   */
  @Get()
  async findAll(@Query() query: QueryReviewDto) {
    const result = await this.reviewService.findAll(query);
    return {
      message: 'Lấy danh sách đánh giá thành công',
      ...result,
    };
  }
}

// ─────────────────────────────────────────────────────────────
//  USER Controller
//  - POST /api/v1/reviews                   (tạo review)
//  - GET  /api/v1/users/me/reviews          (xem của mình)
// ─────────────────────────────────────────────────────────────

@Roles(UserRole.USER)
@Controller('reviews')
export class ReviewUserController {
  constructor(private readonly reviewService: ReviewService) {}

  /**
   * POST /api/v1/reviews
   * User tạo review sau khi appointment = completed.
   * 1 appointment chỉ được review 1 lần.
   */
  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReviewDto,
  ) {
    const data = await this.reviewService.create(user.id, dto);
    return {
      message: 'Đánh giá thành công',
      data,
    };
  }
}

// ─────────────────────────────────────────────────────────────
//  USER-ME Controller  →  /api/v1/users/me/reviews
//  Prefix khác nên tách riêng.
// ─────────────────────────────────────────────────────────────

@Roles(UserRole.USER)
@Controller('users/me/reviews')
export class ReviewUserMeController {
  constructor(private readonly reviewService: ReviewService) {}

  /**
   * GET /api/v1/users/me/reviews?page=&limit=
   * User xem tất cả review họ đã viết.
   */
  @Get()
  async findMyReviews(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryMyMedicalRecordsDto,
  ) {
    const result = await this.reviewService.findByUser(user.id, query);
    return {
      message: 'Lấy danh sách đánh giá của bạn thành công',
      ...result,
    };
  }
}

// ─────────────────────────────────────────────────────────────
//  ADMIN Controller  →  /api/v1/admin/reviews
// ─────────────────────────────────────────────────────────────

@Roles(UserRole.ADMIN)
@Controller('admin/reviews')
export class ReviewAdminController {
  constructor(private readonly reviewService: ReviewService) {}

  /**
   * GET /api/v1/admin/reviews?doctorId=&hospitalId=&isVisible=&rating=&page=&limit=
   * Admin xem tất cả review — kể cả đã ẩn.
   */
  @Get()
  async findAll(@Query() query: QueryAdminReviewDto) {
    const result = await this.reviewService.adminFindAll(query);
    return {
      message: 'Lấy danh sách đánh giá thành công',
      ...result,
    };
  }

  /**
   * GET /api/v1/admin/reviews/:id
   * Admin xem chi tiết 1 review.
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.reviewService.adminFindById(id);
    return {
      message: 'Lấy thông tin đánh giá thành công',
      data,
    };
  }

  /**
   * PATCH /api/v1/admin/reviews/:id/visibility
   * Admin ẩn hoặc hiện review — trigger recalc cached rating.
   */
  @Patch(':id/visibility')
  @HttpCode(HttpStatus.OK)
  async updateVisibility(
    @Param('id') id: string,
    @Body() dto: UpdateReviewVisibilityDto,
  ) {
    const data = await this.reviewService.updateVisibility(id, dto);
    return {
      message: dto.isVisible
        ? 'Đã hiện đánh giá thành công'
        : 'Đã ẩn đánh giá thành công',
      data,
    };
  }
}
