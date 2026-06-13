import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AuthProvider, UserRole } from '@prisma/client';
import { ToBoolean } from '@/common/decorators/to-boolean.decorator';

export class QueryAdminReportsDto {
  @IsString()
  @IsNotEmpty({ message: 'from không được để trống' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'from phải theo định dạng YYYY-MM-DD',
  })
  from!: string;

  @IsString()
  @IsNotEmpty({ message: 'to không được để trống' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'to phải theo định dạng YYYY-MM-DD',
  })
  to!: string;
}

export class QueryAdminUsersDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }: { value?: string }) => value?.trim())
  search?: string;

  @IsOptional()
  @IsEnum(UserRole, { message: 'role không hợp lệ' })
  role?: UserRole;

  @IsOptional()
  @IsEnum(AuthProvider, { message: 'provider không hợp lệ' })
  provider?: AuthProvider;

  @IsOptional()
  @IsBoolean({ message: 'isActive phải là boolean' })
  @ToBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'isEmailVerified phải là boolean' })
  @ToBoolean()
  isEmailVerified?: boolean;

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

export class UpdateUserRoleDto {
  @IsEnum(UserRole, { message: 'role không hợp lệ' })
  role!: UserRole;
}

export class UpdateUserBanDto {
  @IsBoolean({ message: 'isActive phải là boolean' })
  isActive!: boolean;
}
