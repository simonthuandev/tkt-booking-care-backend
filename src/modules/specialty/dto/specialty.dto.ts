import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MaxLength,
  MinLength,
  Matches,
  IsArray,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ToBoolean } from '@/common/decorators/to-boolean.decorator';

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
  imgURL?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  diseases?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  information?: string[];
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
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  imgURL?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  diseases?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  information?: string[];

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
  @ToBoolean()
  isActive?: boolean;

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
