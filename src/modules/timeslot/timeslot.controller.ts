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
import { TimeSlotService } from './timeslot.service';
import {
  GenerateTimeSlotsDto,
  BlockTimeSlotDto,
  QueryTimeSlotsDto,
  AdminQueryTimeSlotsDto,
} from "./dto/timeslot.dto";
import { Public, Roles, CurrentUser } from '@modules/auth/decorators';
import { UserRole, AuthUser } from '@modules/auth/interfaces/auth.interface';

// ─────────────────────────────────────────────────────────────
//  PUBLIC Controller  →  /api/v1/timeslots
//  Ai cũng xem được slot trống — cần thiết để đặt lịch
// ─────────────────────────────────────────────────────────────

@Public()
@Controller('timeslots')
export class TimeSlotPublicController {
  constructor(private readonly timeSlotService: TimeSlotService) {}

  /**
   * GET /api/v1/timeslots?doctorId=&date=&hospitalId=
   * Slots còn trống của bác sĩ — group theo ngày.
   * Frontend dùng để hiển thị lịch cho bệnh nhân chọn.
   */
  @Get()
  async findAvailable(@Query() query: QueryTimeSlotsDto) {
    const data = await this.timeSlotService.findAvailable(query);
    return {
      message: 'Lấy danh sách slot khả dụng thành công',
      data,
    };
  }
}

// ─────────────────────────────────────────────────────────────
//  DOCTOR-SELF Controller  →  /api/v1/doctors/me
//  Bác sĩ xem lịch của mình + tự khóa slot (xin nghỉ)
// ─────────────────────────────────────────────────────────────

@Roles(UserRole.DOCTOR)
@Controller('doctors/me')
export class TimeSlotDoctorController {
  constructor(private readonly timeSlotService: TimeSlotService) {}

  /**
   * GET /api/v1/doctors/me/schedule
   * Bác sĩ xem lịch làm việc cố định (DoctorHospital).
   */
  @Get('schedule')
  async getSchedule(@CurrentUser() user: AuthUser) {
    const data = await this.timeSlotService.getDoctorSchedule(user.id);
    return {
      message: 'Lấy lịch làm việc thành công',
      data,
    };
  }

  /**
   * GET /api/v1/doctors/me/timeslots?date=&hospitalId=&isBooked=&fromDate=&toDate=
   * Bác sĩ xem tất cả slot của mình (kể cả đã đặt, đã khóa).
   */
  @Get('timeslots')
  async getMySlots(
    @CurrentUser() user: AuthUser,
    @Query() query: AdminQueryTimeSlotsDto,
  ) {
    const data = await this.timeSlotService.getDoctorSlots(user.id, query);
    return {
      message: 'Lấy danh sách slot thành công',
      data,
    };
  }

  /**
   * PATCH /api/v1/doctors/me/timeslots/:id/block
   * Bác sĩ tự khóa/mở khóa 1 slot của mình (xin nghỉ).
   * Chỉ được khóa slot chưa có lịch hẹn.
   */
  @Patch('timeslots/:id/block')
  async blockMySlot(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: BlockTimeSlotDto,
  ) {
    const data = await this.timeSlotService.doctorSetBlock(user.id, id, dto);
    return {
      message: dto.isBlocked ? 'Đã khóa slot thành công' : 'Đã mở khóa slot thành công',
      data,
    };
  }
}

// ─────────────────────────────────────────────────────────────
//  ADMIN Controller  →  /api/v1/admin/timeslots
// ─────────────────────────────────────────────────────────────

@Roles(UserRole.ADMIN)
@Controller('admin/timeslots')
export class TimeSlotAdminController {
  constructor(private readonly timeSlotService: TimeSlotService) {}

  /**
   * GET /api/v1/admin/timeslots?doctorId=&hospitalId=&fromDate=&toDate=&isBooked=&isBlocked=
   * Admin xem tất cả slots — filter đa chiều.
   */
  @Get()
  async findAll(@Query() query: AdminQueryTimeSlotsDto) {
    const result = await this.timeSlotService.adminFindAll(query);
    return {
      message: 'Lấy danh sách time slot thành công',
      ...result,
    };
  }

  /**
   * POST /api/v1/admin/timeslots/generate
   * Generate hàng loạt slots theo template lặp lại.
   * ⚠️ Khai báo TRƯỚC /:id để tránh NestJS match "generate" vào param
   */
  @Post('generate')
  async generate(@Body() dto: GenerateTimeSlotsDto) {
    const data = await this.timeSlotService.generate(dto);
    return {
      message: data.message,
      data,
    };
  }

  /**
   * PATCH /api/v1/admin/timeslots/:id/block
   * Admin khóa/mở khóa 1 slot cụ thể.
   */
  @Patch(':id/block')
  async setBlock(
    @Param('id') id: string,
    @Body() dto: BlockTimeSlotDto,
  ) {
    const data = await this.timeSlotService.setBlock(id, dto);
    return {
      message: dto.isBlocked ? 'Đã khóa slot thành công' : 'Đã mở khóa slot thành công',
      data,
    };
  }

  /**
   * DELETE /api/v1/admin/timeslots/:id
   * Xóa 1 slot chưa được đặt.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    const data = await this.timeSlotService.remove(id);
    return {
      message: 'Đã xóa time slot thành công',
      data,
    };
  }

  /**
   * DELETE /api/v1/admin/timeslots/bulk
   * Xóa hàng loạt slots chưa đặt trong 1 khoảng thời gian.
   * Body: { doctorId, hospitalId?, fromDate, toDate }
   * ⚠️ Khai báo TRƯỚC /:id
   */
  @Delete('bulk')
  @HttpCode(HttpStatus.OK)
  async bulkRemove(
    @Body() dto: {
      doctorId: string;
      hospitalId?: string;
      fromDate: string;
      toDate: string;
    },
  ) {
    const data = await this.timeSlotService.bulkRemove(dto);
    return {
      message: data.message,
      data,
    };
  }
}
