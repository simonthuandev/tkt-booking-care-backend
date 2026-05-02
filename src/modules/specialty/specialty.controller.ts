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
import { SpecialtyService } from './specialty.service';
import {
  CreateSpecialtyDto,
  UpdateSpecialtyDto,
  QuerySpecialtyDto,
} from './dto/specialty.dto';
import { Public, Roles } from '@modules/auth/decorators';
import { UserRole } from '@modules/auth/interfaces/auth.interface';

// ─────────────────────────────────────────────────────────────
//  PUBLIC Controller  →  GET /api/v1/specialties
// ─────────────────────────────────────────────────────────────

@Public()
@Controller('specialties')
export class SpecialtyPublicController {
  constructor(private readonly specialtyService: SpecialtyService) {}

  /**
   * GET /api/v1/specialties?search=tim&isActive=true
   * Danh sách chuyên khoa — public, không cần token.
   */
  @Get()
  async findAll(@Query() query: QuerySpecialtyDto) {
    const data = await this.specialtyService.findAll(query);
    return {
      message: 'Lấy danh sách chuyên khoa thành công',
      data,
    };
  }

  /**
   * GET /api/v1/specialties/:slug
   * Chi tiết 1 chuyên khoa + danh sách bác sĩ thuộc chuyên khoa.
   */
  @Get(':slug')
  async findOne(@Param('slug') slug: string) {
    const data = await this.specialtyService.findBySlug(slug);
    return {
      message: 'Lấy thông tin chuyên khoa thành công',
      data,
    };
  }
}

// ─────────────────────────────────────────────────────────────
//  ADMIN Controller  →  GET /api/v1/admin/specialties
// ─────────────────────────────────────────────────────────────

@Roles(UserRole.ADMIN)
@Controller('admin/specialties')
export class SpecialtyAdminController {
  constructor(private readonly specialtyService: SpecialtyService) {}

  /**
   * GET /api/v1/admin/specialties?search=&isActive=
   * Admin xem tất cả — kể cả inactive.
   */
  @Get()
  async findAll(@Query() query: QuerySpecialtyDto) {
    const data = await this.specialtyService.adminFindAll(query);
    return {
      message: 'Lấy danh sách chuyên khoa thành công',
      data,
    };
  }

  /**
   * POST /api/v1/admin/specialties
   * Tạo chuyên khoa mới.
   */
  @Post()
  async create(@Body() dto: CreateSpecialtyDto) {
    const data = await this.specialtyService.create(dto);
    return {
      message: 'Tạo chuyên khoa thành công',
      data,
    };
  }

  /**
   * PATCH /api/v1/admin/specialties/:id
   * Cập nhật thông tin chuyên khoa.
   */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateSpecialtyDto) {
    const data = await this.specialtyService.update(id, dto);
    return {
      message: 'Cập nhật chuyên khoa thành công',
      data,
    };
  }

  /**
   * DELETE /api/v1/admin/specialties/:id
   * Soft delete — set isActive = false.
   * Từ chối nếu còn bác sĩ đang active trong chuyên khoa.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    const data = await this.specialtyService.remove(id);
    return {
      message: 'Đã vô hiệu hóa chuyên khoa thành công',
      data,
    };
  }
}
