import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentUrlDto } from './dto/payment.dto';
import * as crypto from 'crypto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

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
      throw new BadRequestException('Không thể thanh toán cho trạng thái lịch hẹn hiện tại');
    }

    let payUrl = '';
    const transactionId = `INV${Date.now()}`; // Tạo mã giao dịch độc nhất dựa trên timestamp

    if (dto.provider === 'vn_pay') {
      payUrl = this.buildVnpayUrl(appointment, transactionId, ipAddr);
    } else if (dto.provider === 'momo') {
      payUrl = await this.requestMomoPayUrl(appointment, transactionId);
    } else {
      throw new BadRequestException('Nhà cung cấp thanh toán không hợp lệ');
    }

    // Ghi nhận lịch sử giao dịch ban đầu với trạng thái pending vào DB
    await this.prisma.payment.create({
      data: {
        appointmentId: appointment.id,
        amount: appointment.totalAmount,
        provider: dto.provider,
        transactionId: transactionId,
        status: 'pending',
      },
    });

    return { payUrl };
  }

  /**
   * ─── LUỒNG XỬ LÝ VNPAY ──────────────────────────────────────────────────
   */
  private buildVnpayUrl(appointment: any, transactionId: string, ipAddr: string): string {
    const vnpayUrl = this.configService.getOrThrow<string>('VNPAY_URL');
    const tmnCode = this.configService.getOrThrow<string>('VNPAY_TMN_CODE');
    const secretKey = this.configService.getOrThrow<string>('VNPAY_HASH_SECRET');
    const returnUrl = this.configService.getOrThrow<string>('VNPAY_RETURN_URL');

    // Chuẩn hóa thời gian theo múi giờ Việt Nam (GMT+7) bắt buộc dạng YYYYMMDDHHmmss
    const date = new Date();
    const gmt7Time = new Date(date.getTime() + (7 * 60 * 60 * 1000) + (date.getTimezoneOffset() * 60 * 1000));
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
      vnp_Amount: appointment.totalAmount * 100, // SẠN FIXED: Nhân 100 theo quy định VNPAY
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: ipAddr, // SẠN FIXED: Đã đưa địa chỉ IP vào tham số
      vnp_CreateDate: createDate,
    };

    // Sắp xếp các tham số theo thứ tự bảng chữ cái Alphabet
    const sortedParams = Object.keys(vnpParams)
      .sort()
      .reduce((acc, key) => {
        acc[key] = vnpParams[key];
        return acc;
      }, {} as Record<string, any>);

    // Nối chuỗi Query String thô
    const signData = Object.entries(sortedParams)
      .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`)
      .join('&');

    // Băm chữ ký bảo mật bằng thuật toán HMAC-SHA512
    const hmac = crypto.createHmac('sha512', secretKey);
    const secureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    // Trả về URL hoàn chỉnh để Frontend redirect
    return `${vnpayUrl}?${signData}&vnp_SecureHash=${secureHash}`;
  }

async handleVnpayIpn(query: any) {
    const secretKey = this.configService.getOrThrow<string>('VNPAY_HASH_SECRET');
    const secureHash = query['vnp_SecureHash'];

    const vnpParams = { ...query };
    delete vnpParams['vnp_SecureHash'];
    delete vnpParams['vnp_SecureHashType'];

    const sortedParams = Object.keys(vnpParams)
      .sort()
      .reduce((acc, key) => {
        acc[key] = vnpParams[key];
        return acc;
      }, {} as Record<string, any>);

    const signData = Object.entries(sortedParams)
      .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`)
      .join('&');

    const hmac = crypto.createHmac('sha512', secretKey);
    const checkHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash !== checkHash) {
      return { RspCode: '97', Message: 'Invalid Signature' };
    }

    const transactionId = query['vnp_TxnRef'];
    const vnpResponseCode = query['vnp_ResponseCode'];
    const vnpAmount = Number(query['vnp_Amount']);

    // FIXED: Thay findUnique bằng findFirst vì transactionId không phải trường @unique duy nhất ở tầng Prisma
    const payment = await this.prisma.payment.findFirst({
      where: { transactionId },
    });

    if (!payment) {
      return { RspCode: '01', Message: 'Order not found' };
    }

    if (payment.amount * 100 !== vnpAmount) {
      return { RspCode: '04', Message: 'Invalid amount' };
    }

    if (payment.status !== 'pending') {
      return { RspCode: '02', Message: 'Order already confirmed' };
    }

    if (vnpResponseCode === '00') {
      // FIXED: Sửa trạng thái thành 'completed' (cho Payment) và 'confirmed' (cho Appointment)
      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id }, // Dùng id khóa chính để update duy nhất
          data: { status: 'completed' },
        }),
        this.prisma.appointment.update({
          where: { id: payment.appointmentId },
          data: { status: 'confirmed' }, // Chuyển sang confirmed theo đúng enum của bạn
        }),
      ]);
      return { RspCode: '00', Message: 'Confirm Success' };
    } else {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed' },
      });
      return { RspCode: '00', Message: 'Confirm Success (with transaction failed state)' };
    }
  }
  
  /**
   * ─── LUỒNG XỬ LÝ MOMO ──────────────────────────────────────────────────
   */
  private async requestMomoPayUrl(appointment: any, transactionId: string): Promise<string> {
    const momoUrl = this.configService.getOrThrow<string>('MOMO_URL');
    const partnerCode = this.configService.getOrThrow<string>('MOMO_PARTNER_CODE');
    const accessKey = this.configService.getOrThrow<string>('MOMO_ACCESS_KEY');
    const secretKey = this.configService.getOrThrow<string>('MOMO_SECRET_KEY');
    const returnUrl = this.configService.getOrThrow<string>('MOMO_RETURN_URL');
    const ipnUrl = this.configService.getOrThrow<string>('MOMO_IPN_URL');

    const amount = appointment.totalAmount;
    const orderInfo = `Thanh toan lich hen ${appointment.id}`;
    const requestId = transactionId;
    const requestType = 'captureWallet';
    const extraData = ''; // Để trống nếu không dùng, bắt buộc tham gia ký số

    // SẠN FIXED: Xây dựng chuỗi thô đúng trật tự Alphabet nghiêm ngặt của MoMo
    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${transactionId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${returnUrl}&requestId=${requestId}&requestType=${requestType}`;

    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(rawSignature)
      .digest('hex');

    const payload = {
      partnerCode,
      requestId,
      amount,
      orderId: transactionId,
      orderInfo,
      redirectUrl: returnUrl,
      ipnUrl,
      requestType,
      extraData,
      lang: 'vi',
      signature,
    };

    try {
      // SẠN FIXED: Gửi POST Request (Server-to-Server) sang MoMo thay vì nối chuỗi bừa bãi
      const response = await fetch(momoUrl, {
        method: 'POST',
        headers: { 'Content-Type:': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data && data.payUrl) {
        return data.payUrl;
      }
      
      this.logger.error('MoMo Response Error:', data);
      throw new BadRequestException('Không thể khởi tạo URL thanh toán từ MoMo');
    } catch (error) {
      this.logger.error('Lỗi khi kết nối đến MoMo Gateway:', error);
      throw new BadRequestException('Lỗi kết nối cổng thanh toán MoMo');
    }
  }

  async handleMomoIpn(body: any) {
    const secretKey = this.configService.getOrThrow<string>('MOMO_SECRET_KEY');
    const accessKey = this.configService.getOrThrow<string>('MOMO_ACCESS_KEY');
    const receivedSignature = body.signature;

    const rawSignature = `accessKey=${accessKey}&amount=${body.amount}&extraData=${body.extraData}&message=${body.message}&orderId=${body.orderId}&orderInfo=${body.orderInfo}&orderType=${body.orderType}&partnerCode=${body.partnerCode}&requestId=${body.requestId}&responseTime=${body.responseTime}&resultCode=${body.resultCode}&transId=${body.transId}`;

    const checkSignature = crypto
      .createHmac('sha256', secretKey)
      .update(rawSignature)
      .digest('hex');

    if (receivedSignature !== checkSignature) {
      throw new BadRequestException('Invalid Signature');
    }

    // FIXED: Thay findUnique bằng findFirst để sửa lỗi Property 'id' is missing
    const payment = await this.prisma.payment.findFirst({
      where: { transactionId: body.orderId },
    });

    if (!payment) return; 
    if (payment.amount !== Number(body.amount)) return;
    if (payment.status !== 'pending') return;

    if (body.resultCode === 0) {
      // FIXED: Đồng bộ hóa chuẩn xác theo Enum PaymentStatus (completed) và AppointmentStatus (confirmed)
      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'completed' },
        }),
        this.prisma.appointment.update({
          where: { id: payment.appointmentId },
          data: { status: 'confirmed' },
        }),
      ]);
    } else {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed' },
      });
    }
  }
}