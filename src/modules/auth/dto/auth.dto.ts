import {
  IsEmail,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';

const trimString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : value;

const normalizeEmail = (value: unknown) =>
  typeof value === 'string' ? value.toLowerCase().trim() : value;

export class RegisterDto {
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @MaxLength(64, { message: 'Mật khẩu không được vượt quá 64 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: 'Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt',
  })
  password!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Tên phải có ít nhất 2 ký tự' })
  @MaxLength(50, { message: 'Tên không được vượt quá 50 ký tự' })
  firstName!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Họ phải có ít nhất 2 ký tự' })
  @MaxLength(50, { message: 'Họ không được vượt quá 50 ký tự' })
  lastName!: string;
}

export class LoginDto {
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64, { message: 'Mật khẩu không được vượt quá 64 ký tự' })
  password!: string;
}

export class UpdateMeDto {
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Tên phải có ít nhất 2 ký tự' })
  @MaxLength(50, { message: 'Tên không được vượt quá 50 ký tự' })
  firstName?: string;

  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Họ phải có ít nhất 2 ký tự' })
  @MaxLength(50, { message: 'Họ không được vượt quá 50 ký tự' })
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Avatar không được vượt quá 500 ký tự' })
  avatar?: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu hiện tại không được để trống' })
  currentPassword!: string;

  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @MaxLength(64, { message: 'Mật khẩu không được vượt quá 64 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: 'Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt',
  })
  newPassword!: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng xác nhận mật khẩu mới' })
  confirmPassword!: string;
}

export class ConfirmTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'Token không được để trống' })
  token!: string;
}

export class OAuthExchangeDto {
  @IsString()
  @IsNotEmpty({ message: 'OAuth code không được để trống' })
  code!: string;
}

export class RequestPasswordResetDto {
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;
}

export class ConfirmPasswordResetDto {
  @IsString()
  @IsNotEmpty({ message: 'Token không được để trống' })
  token!: string;

  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @MaxLength(64, { message: 'Mật khẩu không được vượt quá 64 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: 'Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt',
  })
  newPassword!: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng xác nhận mật khẩu mới' })
  confirmPassword!: string;
}
