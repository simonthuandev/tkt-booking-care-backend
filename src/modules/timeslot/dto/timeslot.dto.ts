import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  ArrayNotEmpty,
  IsEnum,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

// ─── Enum ngày trong tuần ─────────────────────────────────────

export enum DayOfWeek {
  MON = 'MON',
  TUE = 'TUE',
  WED = 'WED',
  THU = 'THU',
  FRI = 'FRI',
  SAT = 'SAT',
  SUN = 'SUN',
}

// ─── Generate hàng loạt (Admin) ──────────────────────────────

export class GenerateTimeSlotsDto {
  @IsString()
  @IsNotEmpty()
  doctorId!: string;

  @IsString()
  @IsNotEmpty()
  hospitalId!: string;

  /**
   * Ngày bắt đầu sinh slot — định dạng YYYY-MM-DD.
   * VD: "2026-05-01"
   */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate phải theo định dạng YYYY-MM-DD',
  })
  startDate!: string;

  /**
   * Ngày kết thúc sinh slot — định dạng YYYY-MM-DD.
   * Tối đa 90 ngày kể từ startDate.
   */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate phải theo định dạng YYYY-MM-DD',
  })
  endDate!: string;

  /**
   * Các ngày trong tuần áp dụng.
   * VD: ["MON", "WED", "FRI"]
   */
  @IsArray()
  @ArrayNotEmpty({ message: 'Phải chọn ít nhất 1 ngày trong tuần' })
  @IsEnum(DayOfWeek, { each: true, message: 'dayOfWeek không hợp lệ' })
  dayOfWeek!: DayOfWeek[];

  /**
   * Giờ bắt đầu ca làm việc — HH:mm
   */
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime phải theo định dạng HH:mm',
  })
  startTime!: string;

  /**
   * Giờ kết thúc ca làm việc — HH:mm
   */
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime phải theo định dạng HH:mm',
  })
  endTime!: string;

  /**
   * Thời lượng mỗi slot (phút).
   * Mặc định 30, tối thiểu 15, tối đa 120.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15, { message: 'Thời lượng tối thiểu 15 phút' })
  @Max(120, { message: 'Thời lượng tối đa 120 phút' })
  durationMinutes?: number = 30;

  /**
   * Khoảng nghỉ giữa ca (phút) — bỏ qua giờ nghỉ trưa.
   * VD: breakStart="12:00", breakEnd="13:00"
   */
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'breakStart phải theo định dạng HH:mm',
  })
  breakStart?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'breakEnd phải theo định dạng HH:mm',
  })
  breakEnd?: string;
}

// ─── Block / Unblock 1 slot (Admin) ──────────────────────────

export class BlockTimeSlotDto {
  @IsBoolean()
  isBlocked!: boolean;
}

// ─── Query slots trống (Public) ──────────────────────────────

export class QueryTimeSlotsDto {
  @IsString()
  @IsNotEmpty({ message: 'doctorId là bắt buộc' })
  doctorId!: string;

  /**
   * Ngày cần xem slots — định dạng YYYY-MM-DD.
   * Nếu không truyền → trả về tất cả slots từ hôm nay trở đi (7 ngày).
   */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date phải theo định dạng YYYY-MM-DD',
  })
  date?: string;

  /**
   * hospitalId — filter thêm nếu bác sĩ làm việc ở nhiều cơ sở.
   */
  @IsOptional()
  @IsString()
  hospitalId?: string;
}

// ─── Query Admin (xem tất cả slots của 1 bác sĩ) ─────────────

export class AdminQueryTimeSlotsDto {
  @IsOptional()
  @IsString()
  doctorId?: string;

  @IsOptional()
  @IsString()
  hospitalId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date phải theo định dạng YYYY-MM-DD',
  })
  date?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fromDate phải theo định dạng YYYY-MM-DD',
  })
  fromDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'toDate phải theo định dạng YYYY-MM-DD',
  })
  toDate?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isBooked?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isBlocked?: boolean;

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
  limit?: number = 50;
}
