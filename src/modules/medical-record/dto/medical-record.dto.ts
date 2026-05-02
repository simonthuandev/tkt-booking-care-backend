import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { IsInt, Min, Max } from 'class-validator';

// ─── Create (Doctor tạo sau khi appointment = completed) ──────

export class CreateMedicalRecordDto {
  /**
   * ID lịch hẹn — phải ở trạng thái completed
   * và chưa có medical record nào.
   */
  @IsString()
  @IsNotEmpty({ message: 'appointmentId không được để trống' })
  appointmentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Chẩn đoán không được vượt quá 2000 ký tự' })
  @Transform(({ value }) => value?.trim())
  diagnosis?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Đơn thuốc không được vượt quá 5000 ký tự' })
  @Transform(({ value }) => value?.trim())
  prescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Ghi chú không được vượt quá 2000 ký tự' })
  @Transform(({ value }) => value?.trim())
  notes?: string;
}

// ─── Update (Doctor chỉnh sửa) ────────────────────────────────

export class UpdateMedicalRecordDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => value?.trim())
  diagnosis?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  @Transform(({ value }) => value?.trim())
  prescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => value?.trim())
  notes?: string;
}

// ─── Query User (GET /users/me/medical-records) ───────────────

export class QueryMyMedicalRecordsDto {
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

// ─── Query Admin ──────────────────────────────────────────────

export class QueryAdminMedicalRecordsDto {
  @IsOptional()
  @IsString()
  patientProfileId?: string;

  @IsOptional()
  @IsString()
  doctorId?: string;

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
