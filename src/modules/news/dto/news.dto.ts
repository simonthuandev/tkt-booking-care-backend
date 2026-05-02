import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { IsInt, Min, Max } from 'class-validator';

// ─── Create (Admin tạo bài viết) ─────────────────────────────

export class CreateNewsDto {
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  @MinLength(5, { message: 'Tiêu đề phải có ít nhất 5 ký tự' })
  @MaxLength(300, { message: 'Tiêu đề không được vượt quá 300 ký tự' })
  @Transform(({ value }) => value?.trim())
  title!: string;

  /**
   * Slug tùy chọn — nếu không truyền, service tự sinh từ title.
   * Chỉ cho phép chữ thường, số và dấu gạch ngang.
   */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug chỉ được chứa chữ thường, số và dấu gạch ngang',
  })
  @MaxLength(350)
  slug?: string;

  /**
   * Nội dung bài viết — full HTML hoặc markdown.
   */
  @IsString()
  @IsNotEmpty({ message: 'Nội dung không được để trống' })
  content!: string;

  /**
   * Tóm tắt ngắn — hiển thị ở danh sách bài viết.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Tóm tắt không được vượt quá 500 ký tự' })
  @Transform(({ value }) => value?.trim())
  excerpt?: string;

  /**
   * URL ảnh thumbnail.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnail?: string;

  /**
   * Danh mục bài viết.
   * VD: "sức khỏe", "tim mạch", "dinh dưỡng"
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  category?: string;

  /**
   * Xuất bản ngay khi tạo — mặc định false (lưu nháp).
   */
  @IsOptional()
  @IsBoolean({ message: 'isPublished phải là boolean' })
  isPublished?: boolean;
}

// ─── Update (Admin chỉnh sửa) ────────────────────────────────

export class UpdateNewsDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  @Transform(({ value }) => value?.trim())
  title?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug chỉ được chứa chữ thường, số và dấu gạch ngang',
  })
  @MaxLength(350)
  slug?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Nội dung không được để trống' })
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  excerpt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  category?: string;
}

// ─── Publish (Admin publish/unpublish) ───────────────────────

export class PublishNewsDto {
  @IsBoolean({ message: 'isPublished phải là boolean' })
  isPublished!: boolean;
}

// ─── Query public (GET /news?category&page&limit) ─────────────

export class QueryNewsDto {
  /**
   * Lọc theo danh mục — partial match, case-insensitive.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  category?: string;

  /**
   * Tìm kiếm theo tiêu đề.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  search?: string;

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

// ─── Query Admin (GET /admin/news) ────────────────────────────

export class QueryAdminNewsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  category?: string;

  /**
   * Lọc theo trạng thái xuất bản.
   * Admin có thể xem cả bản nháp.
   */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isPublished?: boolean;

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
