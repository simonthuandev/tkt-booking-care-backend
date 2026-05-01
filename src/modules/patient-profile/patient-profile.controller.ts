import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PatientProfileService } from './patient-profile.service';
import {
  CreatePatientProfileDto,
  UpdatePatientProfileDto,
} from './dto/patient-profile.dto';
import { Roles, CurrentUser } from '@modules/auth/decorators';
import { UserRole, AuthUser } from '@modules/auth/interfaces/auth.interface';

// ─────────────────────────────────────────────────────────────
//  USER Controller  →  /api/v1/users/me/patient-profiles
//  Chỉ role 'user' — ownership enforced trên từng endpoint.
//  Doctor và Admin KHÔNG dùng controller này.
// ─────────────────────────────────────────────────────────────

@Roles(UserRole.USER)
@Controller('users/me/patient-profiles')
export class PatientProfileController {
  constructor(private readonly patientProfileService: PatientProfileService) {}

  /**
   * GET /api/v1/users/me/patient-profiles
   * Lấy tất cả hồ sơ bệnh nhân của user — profile default đứng đầu.
   */
  @Get()
  async findAll(@CurrentUser() user: AuthUser) {
    const data = await this.patientProfileService.findAllByUser(user.id);
    return {
      message: 'Lấy danh sách hồ sơ bệnh nhân thành công',
      data,
    };
  }

  /**
   * GET /api/v1/users/me/patient-profiles/:id
   * Xem chi tiết 1 hồ sơ — ownership check.
   */
  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const data = await this.patientProfileService.findOne(id, user.id);
    return {
      message: 'Lấy thông tin hồ sơ bệnh nhân thành công',
      data,
    };
  }

  /**
   * POST /api/v1/users/me/patient-profiles
   * Tạo hồ sơ mới (tối đa 5 hồ sơ / tài khoản).
   * Hồ sơ đầu tiên tự động trở thành mặc định.
   */
  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePatientProfileDto,
  ) {
    const data = await this.patientProfileService.create(user.id, dto);
    return {
      message: 'Tạo hồ sơ bệnh nhân thành công',
      data,
    };
  }

  /**
   * PATCH /api/v1/users/me/patient-profiles/:id
   * Cập nhật hồ sơ — ownership check.
   * ⚠️ Khai báo TRƯỚC /:id/default để tránh NestJS match nhầm
   */
  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePatientProfileDto,
  ) {
    const data = await this.patientProfileService.update(id, user.id, dto);
    return {
      message: 'Cập nhật hồ sơ bệnh nhân thành công',
      data,
    };
  }

  /**
   * PATCH /api/v1/users/me/patient-profiles/:id/default
   * Đặt hồ sơ làm mặc định — dùng transaction, chỉ 1 profile là default.
   */
  @Patch(':id/default')
  async setDefault(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const data = await this.patientProfileService.setDefault(id, user.id);
    return {
      message: 'Đã đặt hồ sơ mặc định thành công',
      data,
    };
  }

  /**
   * DELETE /api/v1/users/me/patient-profiles/:id
   * Xóa hồ sơ — ownership check.
   * Từ chối nếu: còn lịch hẹn active, hoặc là hồ sơ duy nhất.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const data = await this.patientProfileService.remove(id, user.id);
    return {
      message: 'Đã xóa hồ sơ bệnh nhân thành công',
      data,
    };
  }
}
