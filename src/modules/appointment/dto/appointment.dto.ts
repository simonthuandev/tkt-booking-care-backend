import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { AppointmentStatus, CancelledBy } from '@prisma/client';

// ─── Create (User đặt lịch) ───────────────────────────────────

export class CreateAppointmentDto {
  /**
   * ID hồ sơ bệnh nhân — phải thuộc về user đang đăng nhập.
   */
  @IsString()
  @IsNotEmpty({ message: 'patientProfileId không được để trống' })
  patientProfileId!: string;

  /**
   * ID time slot — phải còn trống (isBooked=false, isBlocked=false).
   */
  @IsString()
  @IsNotEmpty({ message: 'timeSlotId không được để trống' })
  timeSlotId!: string;

  /**
   * Lý do khám — tùy chọn nhưng khuyến khích điền.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Lý do khám không được vượt quá 500 ký tự' })
  @Transform(({ value }) => value?.trim())
  reason?: string;
}

// ─── Cancel (User / Doctor / Admin huỷ lịch) ─────────────────

export class CancelAppointmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Lý do huỷ không được vượt quá 500 ký tự' })
  @Transform(({ value }) => value?.trim())
  cancelReason?: string;
}

// ─── Update Status (Doctor / Admin thay đổi trạng thái) ──────

/**
 * Trạng thái Doctor được phép chuyển:
 *   pending     → confirmed
 *   confirmed   → processing
 *   processing  → completed | no_show
 *
 * Admin có thể set thêm: cancelled
 */
export class UpdateAppointmentStatusDto {
  @IsEnum(AppointmentStatus, {
    message: 'status không hợp lệ',
  })
  status!: AppointmentStatus;
}

// ─── Query User (GET /users/me/appointments) ─────────────────

export class QueryMyAppointmentsDto {
  @IsOptional()
  @IsEnum(AppointmentStatus, { message: 'status không hợp lệ' })
  status?: AppointmentStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

// ─── Query Doctor (GET /doctors/me/appointments) ─────────────

export class QueryDoctorAppointmentsDto {
  /**
   * Lọc theo ngày — YYYY-MM-DD.
   */
  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsEnum(AppointmentStatus, { message: 'status không hợp lệ' })
  status?: AppointmentStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

// ─── Query Admin (GET /admin/appointments) ───────────────────

export class QueryAdminAppointmentsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  search?: string; // tên bệnh nhân hoặc bác sĩ

  @IsOptional()
  @IsEnum(AppointmentStatus, { message: 'status không hợp lệ' })
  status?: AppointmentStatus;

  @IsOptional()
  @IsString()
  doctorId?: string;

  @IsOptional()
  @IsString()
  hospitalId?: string;

  /**
   * Lọc theo ngày đặt lịch hoặc ngày khám — YYYY-MM-DD.
   */
  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
