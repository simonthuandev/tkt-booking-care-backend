import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentUrlDto } from './dto/payment.dto';
import * as crypto from 'crypto';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async createPaymentUrl(dto: CreatePaymentUrlDto, ipAddr: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointmentId },
    });

    if (!appointment) {
      throw new BadRequestException('Lịch hẹn không tồn tại');
    }

    if (appointment.status !== 'pending') {
      throw new BadRequestException(
        'Không thể xử lý thanh toán cho trạng thái lịch hẹn hiện tại',
      );
    }

    const transactionId = `INV${Date.now()}`;

    // ─── XỬ LÝ PHƯƠNG THỨC THANH TOÁN SAU TẠI QUẦY (CASH) ───
    if (dto.provider === 'cash') {
      await this.prisma.$transaction([
        // Tạo hóa đơn lưu trữ với trạng thái pending (vì khách chưa tới khám, chưa thu tiền)
        this.prisma.payment.create({
          data: {
            appointmentId: appointment.id,
            amount: appointment.totalAmount,
            provider: 'cash',
            transactionId: transactionId,
            status: 'pending',
          },
        }),
        // Vì chọn tiền mặt tại quầy, duyệt đặt chỗ thành công luôn để giữ chỗ cho khách
        this.prisma.appointment.update({
          where: { id: appointment.id },
          data: { status: 'confirmed' },
        }),
      ]);

      // Trả về URL điều hướng Frontend về trang báo đặt lịch thành công dạng tiền mặt
      return { payUrl: 'http://localhost:3564/appointments/success-cash' };
    }

    // ─── XỬ LÝ PHƯƠNG THỨC THANH TOÁN ONLINE VNPAY ───
    if (dto.provider === 'vn_pay') {
      const payUrl = this.buildVnpayUrl(appointment, transactionId, ipAddr);

      // Ghi nhận transaction ONLINE chờ webhook cổng thanh toán VNPAY bắn về sau
      await this.prisma.payment.create({
        data: {
          appointmentId: appointment.id,
          amount: appointment.totalAmount,
          provider: 'vn_pay',
          transactionId: transactionId,
          status: 'pending',
        },
      });

      return { payUrl };
    }

    throw new BadRequestException('Nhà cung cấp thanh toán không hợp lệ');
  }

  /*
   * Sinh Link mã hóa kết nối cổng thanh toán VNPAY (FIX CHUẨN VNPAY 2.1.0)
   */
  private buildVnpayUrl(
    appointment: any,
    transactionId: string,
    ipAddr: string,
  ): string {
    const vnpayUrl = this.configService.getOrThrow<string>('VNPAY_URL');
    const tmnCode = this.configService.getOrThrow<string>('VNPAY_TMN_CODE');
    const secretKey =
      this.configService.getOrThrow<string>('VNPAY_HASH_SECRET');
    const returnUrl = this.configService.getOrThrow<string>('VNPAY_RETURN_URL');

    const date = new Date();
    const gmt7Time = new Date(
      date.getTime() +
        7 * 60 * 60 * 1000 +
        date.getTimezoneOffset() * 60 * 1000,
    );
    const pad = (n: number) => String(n).padStart(2, '0');
    const createDate = `${gmt7Time.getFullYear()}${pad(gmt7Time.getMonth() + 1)}${pad(gmt7Time.getDate())}${pad(gmt7Time.getHours())}${pad(gmt7Time.getMinutes())}${pad(gmt7Time.getSeconds())}`;

    const vnpParams: Record<string, any> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: transactionId,
      vnp_OrderInfo: `Thanh toan lich hen ${appointment.id}`,
      vnp_OrderType: 'other',
      vnp_Amount: Math.round(appointment.totalAmount * 100),
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
    };

    const sortedKeys = Object.keys(vnpParams).sort();

    // CHÌA KHÓA Ở ĐÂY: VNPAY yêu cầu EncodeURIComponent và đổi khoảng trắng (%20) thành dấu +
    const signData = sortedKeys
      .map(
        (key) =>
          `${key}=${encodeURIComponent(String(vnpParams[key])).replace(/%20/g, '+')}`,
      )
      .join('&');

    const hmac = crypto.createHmac('sha512', secretKey);
    const secureHash = hmac
      .update(Buffer.from(signData, 'utf-8'))
      .digest('hex');

    // Nối chuỗi đã encode cùng với mã Hash
    return `${vnpayUrl}?${signData}&vnp_SecureHash=${secureHash}`;
  }

  /**
   * Hàm xử lý Webhook IPN (FIX LỖI DECODE)
   */
  async handleVnpayIpn(query: any) {
    const secretKey =
      this.configService.getOrThrow<string>('VNPAY_HASH_SECRET');
    const secureHash = query['vnp_SecureHash'];

    const vnpParams = { ...query };
    delete vnpParams['vnp_SecureHash'];
    delete vnpParams['vnp_SecureHashType'];

    const sortedKeys = Object.keys(vnpParams).sort();

    // CHÌA KHÓA Ở ĐÂY: NestJS đã tự động Decode Query, ta phải Encode lại thì Hash mới khớp
    const signData = sortedKeys
      .map(
        (key) =>
          `${key}=${encodeURIComponent(String(vnpParams[key])).replace(/%20/g, '+')}`,
      )
      .join('&');

    const hmac = crypto.createHmac('sha512', secretKey);
    const checkHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash !== checkHash) {
      return { RspCode: '97', Message: 'Invalid Signature' };
    }

    const transactionId = query['vnp_TxnRef'];
    const vnpResponseCode = query['vnp_ResponseCode'];
    const vnpAmount = Number(query['vnp_Amount']);

    const payment = await this.prisma.payment.findFirst({
      where: { transactionId },
    });

    if (!payment) return { RspCode: '01', Message: 'Order not found' };
    if (Math.round(payment.amount * 100) !== vnpAmount)
      return { RspCode: '04', Message: 'Invalid amount' };
    if (payment.status !== 'pending')
      return { RspCode: '02', Message: 'Order already confirmed' };

    if (vnpResponseCode === '00') {
      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'completed' },
        }),
        this.prisma.appointment.update({
          where: { id: payment.appointmentId },
          data: {
            status: 'confirmed',
            paymentStatus: 'completed',
          },
        }),
      ]);
      return { RspCode: '00', Message: 'Confirm Success' };
    } else {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed' },
      });
      return {
        RspCode: '00',
        Message: 'Confirm Success (with transaction failed state)',
      };
    }
  }

  /**
   * Xác nhận thu tiền mặt (Dành cho Lễ tân bấm sau khi bệnh nhân đã khám xong và trả tiền mặt)
   */
  async confirmCashPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new BadRequestException('Hóa đơn giao dịch không tồn tại');
    }

    if (payment.provider !== 'cash') {
      throw new BadRequestException(
        'Hóa đơn này là hóa đơn Online, không thể thu tiền mặt',
      );
    }

    if (payment.status !== 'pending') {
      throw new BadRequestException(
        'Hóa đơn này đã được thanh toán hoàn tất từ trước',
      );
    }

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'completed' }, // Khớp enum PaymentStatus.completed
    });

    return { message: 'Xác nhận thu tiền mặt tại quầy thành công!' };
  }
}
