import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

// ─── Create (User tạo review sau khi appointment = completed) ──

export class CreateReviewDto {
  /**
   * ID lịch hẹn — phải ở trạng thái completed
   * và chưa có review nào.
   */
  @IsString()
  @IsNotEmpty({ message: 'appointmentId không được để trống' })
  appointmentId!: string;

  /**
   * Điểm đánh giá từ 1 đến 5.
   */
  @IsInt({ message: 'rating phải là số nguyên' })
  @Min(1, { message: 'rating tối thiểu là 1' })
  @Max(5, { message: 'rating tối đa là 5' })
  rating!: number;

  /**
   * Nội dung đánh giá — tùy chọn.
   */
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Bình luận không được vượt quá 1000 ký tự' })
  @Transform(({ value }) => value?.trim())
  comment?: string;
}

// ─── Update Visibility (Admin ẩn/hiện review) ────────────────

export class UpdateReviewVisibilityDto {
  @IsBoolean({ message: 'isVisible phải là boolean' })
  isVisible!: boolean;
}

// ─── Query public (GET /reviews?doctorId&hospitalId&page) ─────

export class QueryReviewDto {
  /**
   * Lọc review theo bác sĩ.
   */
  @IsOptional()
  @IsString()
  doctorId?: string;

  /**
   * Lọc review theo bệnh viện.
   */
  @IsOptional()
  @IsString()
  hospitalId?: string;

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

// ─── Query Admin (GET /admin/reviews) ────────────────────────

export class QueryAdminReviewDto {
  @IsOptional()
  @IsString()
  doctorId?: string;

  @IsOptional()
  @IsString()
  hospitalId?: string;

  @IsOptional()
  @IsString()
  patientProfileId?: string;

  /**
   * Lọc theo trạng thái hiển thị.
   * Admin có thể xem cả review đã ẩn.
   */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isVisible?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

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
