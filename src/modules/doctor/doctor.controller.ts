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
import { DoctorService } from './doctor.service';
import {
  CreateDoctorDto,
  UpdateDoctorDto,
  UpdateDoctorSelfDto,
  QueryDoctorDto,
} from './dto/doctor.dto';
import { Public, Roles, CurrentUser } from '@modules/auth/decorators';
import { UserRole, AuthUser } from '@modules/auth/interfaces/auth.interface';

// ─────────────────────────────────────────────────────────────
//  PUBLIC Controller  →  /api/v1/doctors
// ─────────────────────────────────────────────────────────────

@Public()
@Controller('doctors')
export class DoctorPublicController {
  constructor(private readonly doctorService: DoctorService) {}

  /**
   * GET /api/v1/doctors?search=&specialtyId=&hospitalId=&city=&page=&limit=
   * Danh sách bác sĩ với filter + pagination — public.
   */
  @Get()
  async findAll(@Query() query: QueryDoctorDto) {
    const result = await this.doctorService.findAll(query);
    return {
      message: 'Lấy danh sách bác sĩ thành công',
      ...result,
    };
  }

  /**
   * GET /api/v1/doctors/:slug
   * Chi tiết bác sĩ + specialties + hospitals + reviews.
   */
  @Get(':slug')
  async findOne(@Param('slug') slug: string) {
    const data = await this.doctorService.findBySlug(slug);
    return {
      message: 'Lấy thông tin bác sĩ thành công',
      data,
    };
  }
}

// ─────────────────────────────────────────────────────────────
//  DOCTOR-SELF Controller  →  /api/v1/doctors/me
//  Bác sĩ xem và cập nhật profile của chính mình.
//  ⚠️ Khai báo TRƯỚC DoctorPublicController trong module
//     để tránh NestJS match "me" vào :slug
// ─────────────────────────────────────────────────────────────

@Roles(UserRole.DOCTOR)
@Controller('doctors/me')
export class DoctorSelfController {
  constructor(private readonly doctorService: DoctorService) {}

  /**
   * GET /api/v1/doctors/me/profile
   * Bác sĩ xem full profile của mình (có licenseNumber, v.v.)
   */
  @Get('profile')
  async getMyProfile(@CurrentUser() user: AuthUser) {
    const data = await this.doctorService.getMyProfile(user.id);
    return {
      message: 'Lấy thông tin cá nhân thành công',
      data,
    };
  }

  /**
   * PATCH /api/v1/doctors/me/profile
   * Bác sĩ chỉ được cập nhật: firstName, lastName, avatar, bio.
   */
  @Patch('profile')
  async updateMyProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateDoctorSelfDto,
  ) {
    const data = await this.doctorService.updateMyProfile(user.id, dto);
    return {
      message: 'Cập nhật thông tin cá nhân thành công',
      data,
    };
  }
}

// ─────────────────────────────────────────────────────────────
//  ADMIN Controller  →  /api/v1/admin/doctors
// ─────────────────────────────────────────────────────────────

@Roles(UserRole.ADMIN)
@Controller('admin/doctors')
export class DoctorAdminController {
  constructor(private readonly doctorService: DoctorService) {}

  /**
   * GET /api/v1/admin/doctors
   * Admin xem tất cả — kể cả inactive, chưa verified.
   */
  @Get()
  async findAll(@Query() query: QueryDoctorDto) {
    const result = await this.doctorService.adminFindAll(query);
    return {
      message: 'Lấy danh sách bác sĩ thành công',
      ...result,
    };
  }

  /**
   * GET /api/v1/admin/doctors/:id
   * Admin xem chi tiết bác sĩ theo ID.
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.doctorService.findById(id);
    return {
      message: 'Lấy thông tin bác sĩ thành công',
      data,
    };
  }

  /**
   * POST /api/v1/admin/doctors
   * Tạo User (role=doctor) + Doctor profile + link Specialty + Hospital.
   * Tất cả trong 1 transaction.
   */
  @Post()
  async create(@Body() dto: CreateDoctorDto) {
    const data = await this.doctorService.create(dto);
    return {
      message: 'Tạo bác sĩ thành công',
      data,
    };
  }

  /**
   * PATCH /api/v1/admin/doctors/:id
   * Cập nhật doctor profile + user + relations.
   * Nếu truyền specialtyIds/hospitals → thay thế toàn bộ.
   */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateDoctorDto) {
    const data = await this.doctorService.update(id, dto);
    return {
      message: 'Cập nhật thông tin bác sĩ thành công',
      data,
    };
  }

  /**
   * DELETE /api/v1/admin/doctors/:id
   * Soft delete — set isActive = false cho Doctor + User.
   * Từ chối nếu còn lịch hẹn chưa hoàn tất.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    const data = await this.doctorService.remove(id);
    return {
      message: 'Đã vô hiệu hóa bác sĩ thành công',
      data,
    };
  }
}
