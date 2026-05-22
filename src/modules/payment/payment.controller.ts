import { Controller, Post, Get, Body, Req, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentUrlDto } from './dto/payment.dto';
import { Public } from '@modules/auth/decorators';
import { Request } from 'express';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create-url')
  async createPaymentUrl(@Body() dto: CreatePaymentUrlDto, @Req() req: Request) {
    // Trích xuất IP chính xác của Client đứng sau Proxy/Load Balancer
    const rawIp = 
      (req.headers['x-forwarded-for'] as string) || 
      req.socket.remoteAddress || 
      '127.0.0.1';
    
    // Lấy phần tử IP đầu tiên nếu chuỗi chứa danh sách IP phân tách bởi dấu phẩy
    const clientIp = rawIp.split(',')[0].trim();

    return this.paymentService.createPaymentUrl(dto, clientIp);
  }

  // VNPAY IPN sử dụng phương thức GET
  @Public()
  @Get('vnpay-ipn')
  async verifyIpnVnPay(@Query() query: any) {
    return this.paymentService.handleVnpayIpn(query);
  }
  
  // MoMo IPN sử dụng phương thức POST
  @Public()
  @Post('momo-ipn')
  @HttpCode(HttpStatus.NO_CONTENT) // MoMo khuyến khích trả về 204 No Content nếu thành công
  async verifyIpnMoMo(@Body() body: any) {
    await this.paymentService.handleMomoIpn(body);
  }
}