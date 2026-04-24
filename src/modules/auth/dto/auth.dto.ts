import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @MaxLength(64, { message: 'Mật khẩu không được vượt quá 64 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: 'Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt',
  })
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Tên phải có ít nhất 2 ký tự' })
  @MaxLength(50, { message: 'Tên không được vượt quá 50 ký tự' })
  @Transform(({ value }) => value?.trim())
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Họ phải có ít nhất 2 ký tự' })
  @MaxLength(50, { message: 'Họ không được vượt quá 50 ký tự' })
  @Transform(({ value }) => value?.trim())
  lastName!: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  password!: string;
}