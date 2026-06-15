import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class TriageDto {
  @IsString()
  @IsNotEmpty({ message: 'message không được để trống' })
  @MaxLength(500, { message: 'message không được vượt quá 500 ký tự' })
  @Transform(({ value }: { value?: string }) => value?.trim())
  message!: string;
}
