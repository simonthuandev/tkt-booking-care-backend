import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumber,
  IsArray,
  ArrayNotEmpty,
  Min,
  Max,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

// ─── Create (Admin tạo User + Doctor cùng lúc) ───────────────

export class CreateDoctorDto {
  // ── Thông tin tài khoản User ──────────────────────────────
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @MaxLength(64)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: 'Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt',
  })
  password!: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên không được để trống' })
  @MinLength(2)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  firstName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Họ không được để trống' })
  @MinLength(2)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;

  // ── Thông tin Doctor Profile ──────────────────────────────

  /**
   * Slug tùy chọn — nếu không truyền, tự sinh từ họ tên + suffix ngẫu nhiên.
   * VD: "nguyen-thi-lan-d4f2"
   */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug chỉ được chứa chữ thường, số và dấu gạch ngang',
  })
  @MaxLength(150)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => value?.trim())
  bio?: string;

  @IsOptional()
  @IsInt({ message: 'Số năm kinh nghiệm phải là số nguyên' })
  @Min(0)
  @Max(60)
  experience?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  licenseNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  consultationFee?: number;

  // ── Relations ─────────────────────────────────────────────

  /**
   * Danh sách specialtyId — bắt buộc ít nhất 1.
   * specialtyIds[0] sẽ được set isPrimary = true.
   */
  @IsArray({ message: 'specialtyIds phải là mảng' })
  @ArrayNotEmpty({ message: 'Phải chọn ít nhất 1 chuyên khoa' })
  @IsString({ each: true })
  specialtyIds!: string[];

  /**
   * Danh sách hospitalId kèm thông tin làm việc — bắt buộc ít nhất 1.
   */
  @IsArray({ message: 'hospitals phải là mảng' })
  @ArrayNotEmpty({ message: 'Phải chọn ít nhất 1 bệnh viện' })
  @Type(() => DoctorHospitalLinkDto)
  hospitals!: DoctorHospitalLinkDto[];
}

// ─── Hospital link DTO (dùng trong Create + Update) ──────────

export class DoctorHospitalLinkDto {
  @IsString()
  @IsNotEmpty()
  hospitalId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  workingDays?: string; // VD: "MON,TUE,WED,THU,FRI"

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime phải theo định dạng HH:mm',
  })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime phải theo định dạng HH:mm',
  })
  endTime?: string;
}

// ─── Update (Admin cập nhật Doctor) ──────────────────────────

export class UpdateDoctorDto {
  // ── User fields ───────────────────────────────────────────
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;

  @IsOptional()
  @IsBoolean()
  isUserActive?: boolean; // bật/tắt tài khoản user

  // ── Doctor profile fields ─────────────────────────────────
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug chỉ được chứa chữ thường, số và dấu gạch ngang',
  })
  @MaxLength(150)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => value?.trim())
  bio?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  experience?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  licenseNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  consultationFee?: number;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // ── Relations (thay thế toàn bộ nếu truyền vào) ──────────
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialtyIds?: string[];

  @IsOptional()
  @IsArray()
  @Type(() => DoctorHospitalLinkDto)
  hospitals?: DoctorHospitalLinkDto[];
}

// ─── Update Doctor Self (bác sĩ tự cập nhật profile) ─────────

export class UpdateDoctorSelfDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => value?.trim())
  bio?: string;

  // Bác sĩ KHÔNG được tự đổi: slug, licenseNumber, isVerified, isActive, specialtyIds
}

// ─── Query (public listing với pagination + filter) ──────────

export class QueryDoctorDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  search?: string; // tìm theo tên

  @IsOptional()
  @IsString()
  specialtyId?: string;

  @IsOptional()
  @IsString()
  hospitalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

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
