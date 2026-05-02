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
import { AppointmentService } from './appointment.service';
import {
  CreateAppointmentDto,
  CancelAppointmentDto,
  UpdateAppointmentStatusDto,
  QueryMyAppointmentsDto,
  QueryDoctorAppointmentsDto,
  QueryAdminAppointmentsDto,
} from './dto/appointment.dto';
import { Roles, CurrentUser } from '@modules/auth/decorators';
import { UserRole, AuthUser } from '@modules/auth/interfaces/auth.interface';

// ─────────────────────────────────────────────────────────────
//  USER Controller
//  - POST   /api/v1/appointments              (đặt lịch)
//  - GET    /api/v1/users/me/appointments     (danh sách)
//  - GET    /api/v1/users/me/appointments/:id (chi tiết)
//  - POST   /api/v1/appointments/:id/cancel   (huỷ lịch)
// ─────────────────────────────────────────────────────────────

@Roles(UserRole.USER)
@Controller('appointments')
export class AppointmentUserController {
  constructor(private readonly appointmentService: AppointmentService) {}

  /**
   * POST /api/v1/appointments
   * Đặt lịch khám — chỉ role USER.
   */
  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAppointmentDto,
  ) {
    const data = await this.appointmentService.create(user.id, dto);
    return {
      message: 'Đặt lịch khám thành công',
      data,
    };
  }

  /**
   * POST /api/v1/appointments/:id/cancel
   * User huỷ lịch hẹn của mình.
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelAppointmentDto,
  ) {
    const data = await this.appointmentService.cancelByUser(user.id, id, dto);
    return {
      message: 'Huỷ lịch hẹn thành công',
      data,
    };
  }
}

// ─────────────────────────────────────────────────────────────
//  USER-ME Controller (GET danh sách + chi tiết)
//  Đặt riêng vì prefix khác: /users/me/appointments
// ─────────────────────────────────────────────────────────────

@Roles(UserRole.USER)
@Controller('users/me/appointments')
export class AppointmentUserMeController {
  constructor(private readonly appointmentService: AppointmentService) {}

  /**
   * GET /api/v1/users/me/appointments?status=&page=&limit=
   * Danh sách lịch hẹn của user hiện tại.
   */
  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryMyAppointmentsDto,
  ) {
    const result = await this.appointmentService.findMyAppointments(
      user.id,
      query,
    );
    return {
      message: 'Lấy danh sách lịch hẹn thành công',
      ...result,
    };
  }

  /**
   * GET /api/v1/users/me/appointments/:id
   * Chi tiết lịch hẹn — ownership check.
   */
  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const data = await this.appointmentService.findMyAppointmentById(
      user.id,
      id,
    );
    return {
      message: 'Lấy thông tin lịch hẹn thành công',
      data,
    };
  }
}

// ─────────────────────────────────────────────────────────────
//  DOCTOR Controller
//  - GET   /api/v1/doctors/me/appointments
//  - PATCH /api/v1/appointments/:id/status
// ─────────────────────────────────────────────────────────────

@Roles(UserRole.DOCTOR)
@Controller('doctors/me/appointments')
export class AppointmentDoctorMeController {
  constructor(private readonly appointmentService: AppointmentService) {}

  /**
   * GET /api/v1/doctors/me/appointments?date=&status=&page=&limit=
   * Bác sĩ xem danh sách lịch hẹn của mình.
   */
  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryDoctorAppointmentsDto,
  ) {
    const result = await this.appointmentService.findDoctorAppointments(
      user.id,
      query,
    );
    return {
      message: 'Lấy danh sách lịch hẹn thành công',
      ...result,
    };
  }
}

/**
 * Controller riêng cho PATCH status — dùng prefix /appointments
 * để URL tự nhiên hơn: PATCH /appointments/:id/status
 */
@Roles(UserRole.DOCTOR)
@Controller('appointments')
export class AppointmentDoctorStatusController {
  constructor(private readonly appointmentService: AppointmentService) {}

  /**
   * PATCH /api/v1/appointments/:id/status
   * Bác sĩ thay đổi trạng thái lịch hẹn.
   */
  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    const data = await this.appointmentService.updateStatusByDoctor(
      user.id,
      id,
      dto,
    );
    return {
      message: 'Cập nhật trạng thái lịch hẹn thành công',
      data,
    };
  }
}

// ─────────────────────────────────────────────────────────────
//  ADMIN Controller  →  /api/v1/admin/appointments
// ─────────────────────────────────────────────────────────────

@Roles(UserRole.ADMIN)
@Controller('admin/appointments')
export class AppointmentAdminController {
  constructor(private readonly appointmentService: AppointmentService) {}

  /**
   * GET /api/v1/admin/appointments
   * Admin xem tất cả lịch hẹn — filter đa chiều.
   */
  @Get()
  async findAll(@Query() query: QueryAdminAppointmentsDto) {
    const result = await this.appointmentService.adminFindAll(query);
    return {
      message: 'Lấy danh sách lịch hẹn thành công',
      ...result,
    };
  }

  /**
   * GET /api/v1/admin/appointments/:id
   * Admin xem chi tiết bất kỳ lịch hẹn.
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.appointmentService.adminFindById(id);
    return {
      message: 'Lấy thông tin lịch hẹn thành công',
      data,
    };
  }

  /**
   * PATCH /api/v1/admin/appointments/:id/status
   * Admin cập nhật trạng thái lịch hẹn.
   */
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    const data = await this.appointmentService.updateStatusByAdmin(id, dto);
    return {
      message: 'Cập nhật trạng thái lịch hẹn thành công',
      data,
    };
  }

  /**
   * PATCH /api/v1/admin/appointments/:id/cancel
   * Admin huỷ lịch hẹn — có thêm cancelReason.
   */
  @Patch(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelAppointmentDto,
  ) {
    const data = await this.appointmentService.cancelByAdmin(id, dto);
    return {
      message: 'Huỷ lịch hẹn thành công',
      data,
    };
  }
}
