import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { PaymentProvider } from '@prisma/client';

export class CreatePaymentUrlDto {
  @IsString()
  @IsNotEmpty()
  appointmentId!: string;

  @IsEnum(PaymentProvider)
  @IsNotEmpty()
  provider!: PaymentProvider;
}
