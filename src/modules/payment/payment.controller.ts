import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Query,
  HttpCode,
  HttpStatus,
  Patch,
  Param,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentUrlDto } from './dto/payment.dto';
import { Public } from '@modules/auth/decorators';
import { Request } from 'express';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create-url')
  async createPaymentUrl(
    @Body() dto: CreatePaymentUrlDto,
    @Req() req: Request,
  ) {
    const rawIp =
      (req.headers['x-forwarded-for'] as string) ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    let clientIp = rawIp.split(',')[0].trim();

    // FIX: Đổi IP IPv6 localhost thành IPv4 để VNPAY không báo lỗi
    if (clientIp === '::1') {
      clientIp = '127.0.0.1';
    }

    return this.paymentService.createPaymentUrl(dto, clientIp);
  }

  // VNPAY IPN sử dụng phương thức GET
  @Public()
  @Get('vnpay-ipn')
  async verifyIpnVnPay(@Query() query: any) {
    console.log('🚀 [IPN NHẬN ĐƯỢC TỪ VNPAY]:', query); // Thêm dòng này
    return this.paymentService.handleVnpayIpn(query);
  }

  // API dành cho Lễ tân/Admin bấm nút xác nhận khi nhận tiền mặt tại quầy
  @Patch('confirm-cash/:id')
  async confirmCashPayment(@Param('id') paymentId: string) {
    return this.paymentService.confirmCashPayment(paymentId);
  }
}
