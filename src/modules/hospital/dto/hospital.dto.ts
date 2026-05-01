import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsInt,
  Min,
  Max,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { HospitalType } from '@prisma/client';

// ─── Create ──────────────────────────────────────────────────

export class CreateHospitalDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên bệnh viện không được để trống' })
  @MinLength(2, { message: 'Tên phải có ít nhất 2 ký tự' })
  @MaxLength(200, { message: 'Tên không được vượt quá 200 ký tự' })
  @Transform(({ value }) => value?.trim())
  name!: string;

  /**
   * Slug tùy chọn — nếu không truyền, service tự sinh từ name.
   */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug chỉ được chứa chữ thường, số và dấu gạch ngang',
  })
  @MaxLength(220)
  slug?: string;

  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ không được để trống' })
  @MaxLength(300)
  @Transform(({ value }) => value?.trim())
  address!: string;

  @IsString()
  @IsNotEmpty({ message: 'Thành phố không được để trống' })
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  city!: string;

  @IsOptional()
  @IsEnum(HospitalType, {
    message: 'Loại bệnh viện phải là "public" hoặc "private"',
  })
  type?: HospitalType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Mô tả không được vượt quá 2000 ký tự' })
  @Transform(({ value }) => value?.trim())
  description?: string;
}

// ─── Update ──────────────────────────────────────────────────

export class UpdateHospitalDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug chỉ được chứa chữ thường, số và dấu gạch ngang',
  })
  @MaxLength(220)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(({ value }) => value?.trim())
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  city?: string;

  @IsOptional()
  @IsEnum(HospitalType, {
    message: 'Loại bệnh viện phải là "public" hoặc "private"',
  })
  type?: HospitalType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => value?.trim())
  description?: string;

  @IsOptional()
  @IsBoolean({ message: 'isActive phải là boolean' })
  isActive?: boolean;
}

// ─── Query (public listing với pagination + filter) ──────────

export class QueryHospitalDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  city?: string;

  @IsOptional()
  @IsEnum(HospitalType, {
    message: 'type phải là "public" hoặc "private"',
  })
  type?: HospitalType;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean;

  // ─── Pagination ────────────────────────────────────────────

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
