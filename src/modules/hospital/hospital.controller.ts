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
import { HospitalService } from './hospital.service';
import {
  CreateHospitalDto,
  UpdateHospitalDto,
  QueryHospitalDto,
} from './dto/hospital.dto';
import { Public, Roles } from '@modules/auth/decorators';
import { UserRole } from '@modules/auth/interfaces/auth.interface';

// ─────────────────────────────────────────────────────────────
//  PUBLIC Controller  →  /api/v1/hospitals
// ─────────────────────────────────────────────────────────────

@Public()
@Controller('hospitals')
export class HospitalPublicController {
  constructor(private readonly hospitalService: HospitalService) {}

  /**
   * GET /api/v1/hospitals?search=&city=&type=&page=&limit=
   * Danh sách bệnh viện với pagination + filter.
   */
  @Get()
  async findAll(@Query() query: QueryHospitalDto) {
    const result = await this.hospitalService.findAll(query);
    return {
      message: 'Lấy danh sách bệnh viện thành công',
      ...result, // spread để giữ cấu trúc { data, meta }
    };
  }

  /**
   * GET /api/v1/hospitals/cities
   * Danh sách thành phố để dùng cho dropdown filter.
   * ⚠️ Phải khai báo TRƯỚC :slug để tránh conflict route.
   */
  @Get('cities')
  async getCities() {
    const data = await this.hospitalService.getCities();
    return {
      message: 'Lấy danh sách thành phố thành công',
      data,
    };
  }

  /**
   * GET /api/v1/hospitals/:slug
   * Chi tiết bệnh viện + bác sĩ + 5 review gần nhất.
   */
  @Get(':slug')
  async findOne(@Param('slug') slug: string) {
    const data = await this.hospitalService.findBySlug(slug);
    return {
      message: 'Lấy thông tin bệnh viện thành công',
      data,
    };
  }
}

// ─────────────────────────────────────────────────────────────
//  ADMIN Controller  →  /api/v1/admin/hospitals
// ─────────────────────────────────────────────────────────────

@Roles(UserRole.ADMIN)
@Controller('admin/hospitals')
export class HospitalAdminController {
  constructor(private readonly hospitalService: HospitalService) {}

  /**
   * GET /api/v1/admin/hospitals?search=&city=&type=&isActive=&page=&limit=
   * Admin xem tất cả — kể cả inactive, có pagination.
   */
  @Get()
  async findAll(@Query() query: QueryHospitalDto) {
    const result = await this.hospitalService.adminFindAll(query);
    return {
      message: 'Lấy danh sách bệnh viện thành công',
      ...result,
    };
  }

  /**
   * POST /api/v1/admin/hospitals
   * Tạo bệnh viện mới.
   */
  @Post()
  async create(@Body() dto: CreateHospitalDto) {
    const data = await this.hospitalService.create(dto);
    return {
      message: 'Tạo bệnh viện thành công',
      data,
    };
  }

  /**
   * PATCH /api/v1/admin/hospitals/:id
   * Cập nhật thông tin bệnh viện.
   */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateHospitalDto) {
    const data = await this.hospitalService.update(id, dto);
    return {
      message: 'Cập nhật bệnh viện thành công',
      data,
    };
  }

  /**
   * DELETE /api/v1/admin/hospitals/:id
   * Soft delete — set isActive = false.
   * Từ chối nếu còn bác sĩ active hoặc lịch hẹn chưa hoàn tất.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    const data = await this.hospitalService.remove(id);
    return {
      message: 'Đã vô hiệu hóa bệnh viện thành công',
      data,
    };
  }
}
