import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NewsService } from './news.service';
import {
  CreateNewsDto,
  UpdateNewsDto,
  PublishNewsDto,
  QueryNewsDto,
  QueryAdminNewsDto,
} from './dto/news.dto';
import { Public, Roles, CurrentUser } from '@modules/auth/decorators';
import { UserRole, AuthUser } from '@modules/auth/interfaces/auth.interface';

// ─────────────────────────────────────────────────────────────
//  PUBLIC Controller  →  /api/v1/news
//  Ai cũng đọc được — không cần đăng nhập.
// ─────────────────────────────────────────────────────────────

@Public()
@Controller('news')
export class NewsPublicController {
  constructor(private readonly newsService: NewsService) {}

  /**
   * GET /api/v1/news?category=&search=&page=&limit=
   * Danh sách bài viết đã published, sort theo publishedAt desc.
   */
  @Get()
  async findAll(@Query() query: QueryNewsDto) {
    const result = await this.newsService.findAll(query);
    return {
      message: 'Lấy danh sách bài viết thành công',
      ...result,
    };
  }

  /**
   * GET /api/v1/news/categories
   * Danh sách category có bài viết published — dùng cho dropdown filter.
   * ⚠️ Khai báo TRƯỚC /:slug để tránh NestJS match "categories" vào param.
   */
  @Get('categories')
  async getCategories() {
    const data = await this.newsService.getCategories();
    return {
      message: 'Lấy danh sách danh mục thành công',
      data,
    };
  }

  /**
   * GET /api/v1/news/:slug
   * Chi tiết 1 bài viết đã published.
   */
  @Get(':slug')
  async findOne(@Param('slug') slug: string) {
    const data = await this.newsService.findBySlug(slug);
    return {
      message: 'Lấy thông tin bài viết thành công',
      data,
    };
  }
}

// ─────────────────────────────────────────────────────────────
//  ADMIN Controller  →  /api/v1/admin/news
// ─────────────────────────────────────────────────────────────

@Roles(UserRole.ADMIN)
@Controller('admin/news')
export class NewsAdminController {
  constructor(private readonly newsService: NewsService) {}

  /**
   * GET /api/v1/admin/news?search=&category=&isPublished=&page=&limit=
   * Admin xem tất cả bài viết — kể cả bản nháp.
   */
  @Get()
  async findAll(@Query() query: QueryAdminNewsDto) {
    const result = await this.newsService.adminFindAll(query);
    return {
      message: 'Lấy danh sách bài viết thành công',
      ...result,
    };
  }

  /**
   * GET /api/v1/admin/news/:id
   * Admin xem chi tiết 1 bài viết (kể cả bản nháp).
   * ⚠️ Dùng :id thay vì :slug để admin tra cứu chính xác hơn.
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.newsService.adminFindById(id);
    return {
      message: 'Lấy thông tin bài viết thành công',
      data,
    };
  }

  /**
   * POST /api/v1/admin/news
   * Admin tạo bài viết mới.
   * - Nếu không truyền slug → tự sinh từ title
   * - Nếu isPublished = true → tự set publishedAt = now()
   */
  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateNewsDto,
  ) {
    const data = await this.newsService.create(user.id, dto);
    return {
      message: 'Tạo bài viết thành công',
      data,
    };
  }

  /**
   * PATCH /api/v1/admin/news/:id
   * Admin cập nhật nội dung bài viết.
   * Không thay đổi trạng thái publish ở đây — dùng /publish riêng.
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateNewsDto,
  ) {
    const data = await this.newsService.update(id, dto);
    return {
      message: 'Cập nhật bài viết thành công',
      data,
    };
  }

  /**
   * DELETE /api/v1/admin/news/:id
   * Xóa cứng bài viết.
   * Chỉ cho phép xóa bản nháp — bài đã publish phải unpublish trước.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    const data = await this.newsService.remove(id);
    return {
      message: 'Xóa bài viết thành công',
      data,
    };
  }

  /**
   * PATCH /api/v1/admin/news/:id/publish
   * Admin publish hoặc unpublish bài viết.
   * Body: { isPublished: true | false }
   *
   * ⚠️ Khai báo TRƯỚC /:id để tránh conflict route với PATCH /:id
   * — không cần vì prefix khác (:id/publish vs :id), NestJS match đúng.
   */
  @Patch(':id/publish')
  @HttpCode(HttpStatus.OK)
  async togglePublish(
    @Param('id') id: string,
    @Body() dto: PublishNewsDto,
  ) {
    const data = await this.newsService.togglePublish(id, dto);
    return {
      message: dto.isPublished
        ? 'Đã xuất bản bài viết thành công'
        : 'Đã hủy xuất bản bài viết thành công',
      data,
    };
  }
}
