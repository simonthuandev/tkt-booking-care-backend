import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

// ─── Create ──────────────────────────────────────────────────

export class CreateSpecialtyDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên chuyên khoa không được để trống' })
  @MinLength(2, { message: 'Tên phải có ít nhất 2 ký tự' })
  @MaxLength(100, { message: 'Tên không được vượt quá 100 ký tự' })
  @Transform(({ value }) => value?.trim())
  name!: string;

  /**
   * Slug tùy chọn — nếu không truyền, service sẽ tự sinh từ name.
   * Chỉ cho phép chữ thường, số và dấu gạch ngang.
   */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug chỉ được chứa chữ thường, số và dấu gạch ngang',
  })
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Mô tả không được vượt quá 500 ký tự' })
  @Transform(({ value }) => value?.trim())
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  icon?: string;
}

// ─── Update ──────────────────────────────────────────────────

export class UpdateSpecialtyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Tên chuyên khoa không được để trống' })
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug chỉ được chứa chữ thường, số và dấu gạch ngang',
  })
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  icon?: string;

  @IsOptional()
  @IsBoolean({ message: 'isActive phải là boolean' })
  isActive?: boolean;
}

// ─── Query (public listing) ───────────────────────────────────

export class QuerySpecialtyDto {
  /**
   * Tìm kiếm theo tên (partial match)
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  search?: string;

  /**
   * Mặc định chỉ trả về specialty đang active.
   * Admin có thể truyền false để xem tất cả.
   */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean;
}
