import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Gender, Relationship } from '@prisma/client';

// ─── Create ──────────────────────────────────────────────────

export class CreatePatientProfileDto {
  @IsString()
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  @MinLength(2, { message: 'Họ tên phải có ít nhất 2 ký tự' })
  @MaxLength(100, { message: 'Họ tên không được vượt quá 100 ký tự' })
  @Transform(({ value }) => value?.trim())
  fullName!: string;

  /**
   * Ngày sinh — ISO 8601: "1995-05-15" hoặc "1995-05-15T00:00:00.000Z"
   */
  @IsOptional()
  @IsDateString({}, { message: 'Ngày sinh không hợp lệ. Định dạng: YYYY-MM-DD' })
  dob?: string;

  @IsOptional()
  @IsEnum(Gender, { message: 'Giới tính phải là male, female hoặc other' })
  gender?: Gender;

  @IsOptional()
  @IsString()
  @Matches(/^(0|\+84)[0-9]{8,10}$/, {
    message: 'Số điện thoại không hợp lệ',
  })
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Địa chỉ không được vượt quá 300 ký tự' })
  @Transform(({ value }) => value?.trim())
  address?: string;

  @IsOptional()
  @IsEnum(Relationship, {
    message: 'Mối quan hệ phải là: self, parent, child, spouse, sibling, other',
  })
  relationship?: Relationship;
}

// ─── Update ──────────────────────────────────────────────────

export class UpdatePatientProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  fullName?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày sinh không hợp lệ. Định dạng: YYYY-MM-DD' })
  dob?: string;

  @IsOptional()
  @IsEnum(Gender, { message: 'Giới tính phải là male, female hoặc other' })
  gender?: Gender;

  @IsOptional()
  @IsString()
  @Matches(/^(0|\+84)[0-9]{8,10}$/, {
    message: 'Số điện thoại không hợp lệ',
  })
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(({ value }) => value?.trim())
  address?: string;

  @IsOptional()
  @IsEnum(Relationship, {
    message: 'Mối quan hệ phải là: self, parent, child, spouse, sibling, other',
  })
  relationship?: Relationship;
}
