import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Roles } from '@modules/auth/decorators';
import { UserRole } from '@modules/auth/interfaces/auth.interface';
import { AdminService } from './admin.service';
import {
  QueryAdminReportsDto,
  QueryAdminUsersDto,
  UpdateUserBanDto,
  UpdateUserRoleDto,
} from './dto/admin.dto';

@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminAggregateController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  async getStats() {
    const data = await this.adminService.getStats();
    return {
      message: 'Lấy thống kê dashboard thành công',
      data,
    };
  }

  @Get('reports')
  async getReports(@Query() query: QueryAdminReportsDto) {
    const data = await this.adminService.getReports(query);
    return {
      message: 'Lấy báo cáo tổng hợp thành công',
      data,
    };
  }
}

@Roles(UserRole.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async findAll(@Query() query: QueryAdminUsersDto) {
    const result = await this.adminService.findAllUsers(query);
    return {
      message: 'Lấy danh sách người dùng thành công',
      ...result,
    };
  }

  @Patch(':id/role')
  async updateRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    const data = await this.adminService.updateUserRole(id, dto);
    return {
      message: 'Cập nhật quyền người dùng thành công',
      data,
    };
  }

  @Patch(':id/ban')
  async updateBanStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserBanDto,
  ) {
    const data = await this.adminService.updateUserBanStatus(id, dto);
    return {
      message: dto.isActive
        ? 'Đã mở khóa tài khoản thành công'
        : 'Đã khóa tài khoản thành công',
      data,
    };
  }
}

