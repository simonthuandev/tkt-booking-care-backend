import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { randomUUID } from 'crypto';

type SendAccountEmailInput = {
  to: string;
  name: string;
  link: string;
};

@Injectable()
export class MailService {
  private resend: Resend | null = null;

  constructor(private readonly configService: ConfigService) {}

  async sendEmailVerification(input: SendAccountEmailInput): Promise<void> {
    await this.send({
      to: input.to,
      subject: 'Xác thực email TKTBookingCare',
      previewText:
        'Vui lòng xác thực email để hoàn tất bảo mật tài khoản TKTBookingCare.',
      html: this.accountActionTemplate({
        title: 'Xác thực email của bạn',
        greeting: `Xin chào ${this.escapeHtml(input.name)},`,
        body: 'Bạn vừa yêu cầu xác thực email cho tài khoản TKTBookingCare. Nhấn nút bên dưới để hoàn tất xác thực.',
        buttonText: 'Xác thực email',
        link: input.link,
        note: 'Link xác thực có hiệu lực trong 24 giờ. Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email này.',
      }),
      text: [
        `Xin chào ${input.name},`,
        'Bạn vừa yêu cầu xác thực email cho tài khoản TKTBookingCare.',
        `Mở link sau để xác thực email: ${input.link}`,
        'Link xác thực có hiệu lực trong 24 giờ.',
      ].join('\n\n'),
    });
  }

  async sendPasswordReset(input: SendAccountEmailInput): Promise<void> {
    await this.send({
      to: input.to,
      subject: 'Khôi phục mật khẩu TKTBookingCare',
      previewText:
        'Sử dụng link khôi phục để đặt lại mật khẩu tài khoản TKTBookingCare.',
      html: this.accountActionTemplate({
        title: 'Đặt lại mật khẩu',
        greeting: `Xin chào ${this.escapeHtml(input.name)},`,
        body: 'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản TKTBookingCare của bạn. Nhấn nút bên dưới để tạo mật khẩu mới.',
        buttonText: 'Đặt lại mật khẩu',
        link: input.link,
        note: 'Link khôi phục có hiệu lực trong 30 phút. Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email này.',
      }),
      text: [
        `Xin chào ${input.name},`,
        'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản TKTBookingCare của bạn.',
        `Mở link sau để đặt lại mật khẩu: ${input.link}`,
        'Link khôi phục có hiệu lực trong 30 phút.',
      ].join('\n\n'),
    });
  }

  private async send(input: {
    to: string;
    subject: string;
    previewText: string;
    html: string;
    text: string;
  }): Promise<void> {
    const resend = this.getClient();
    const from = this.configService.get<string>('MAIL_FROM');

    if (!from) {
      throw new ServiceUnavailableException('Chưa cấu hình MAIL_FROM');
    }

    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      headers: {
        'X-Entity-Ref-ID': randomUUID(),
      },
    });

    if (error) {
      throw new ServiceUnavailableException(
        error.message || 'Không thể gửi email. Vui lòng thử lại sau.',
      );
    }
  }

  private getClient(): Resend {
    if (this.resend) return this.resend;

    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('Chưa cấu hình RESEND_API_KEY');
    }

    this.resend = new Resend(apiKey);
    return this.resend;
  }

  private accountActionTemplate(input: {
    title: string;
    greeting: string;
    body: string;
    buttonText: string;
    link: string;
    note: string;
  }): string {
    const safeLink = this.escapeHtml(input.link);

    return `
      <div style="font-family: Arial, sans-serif; background: #f6f8fb; padding: 32px;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <div style="padding: 24px 28px; background: #0f766e; color: #ffffff;">
            <h1 style="margin: 0; font-size: 22px;">${this.escapeHtml(input.title)}</h1>
          </div>
          <div style="padding: 28px; color: #111827; line-height: 1.6;">
            <p style="margin: 0 0 16px;">${input.greeting}</p>
            <p style="margin: 0 0 24px;">${this.escapeHtml(input.body)}</p>
            <p style="margin: 0 0 24px;">
              <a href="${safeLink}" style="display: inline-block; background: #0f766e; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 6px; font-weight: 700;">
                ${this.escapeHtml(input.buttonText)}
              </a>
            </p>
            <p style="margin: 0 0 8px; color: #4b5563;">Nếu nút không hoạt động, hãy mở link này:</p>
            <p style="margin: 0 0 20px; word-break: break-all;">
              <a href="${safeLink}" style="color: #0f766e;">${safeLink}</a>
            </p>
            <p style="margin: 0; color: #6b7280; font-size: 14px;">${this.escapeHtml(input.note)}</p>
          </div>
        </div>
      </div>
    `;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
