import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum SearchType {
  ALL = 'all',
  DOCTOR = 'doctor',
  HOSPITAL = 'hospital',
  SPECIALTY = 'specialty',
}

export class QuerySearchDto {
  @IsString()
  @IsNotEmpty({ message: 'q không được để trống' })
  @MaxLength(200, { message: 'q không được vượt quá 200 ký tự' })
  @Transform(({ value }: { value?: string }) => value?.trim())
  q!: string;

  @IsOptional()
  @IsEnum(SearchType, { message: 'type không hợp lệ' })
  type?: SearchType = SearchType.ALL;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value?: string }) => value?.trim())
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
