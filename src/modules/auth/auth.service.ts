import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
  BadRequestException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  User,
  AccountTokenType,
  AuthProvider as PrismaAuthProvider,
  Prisma,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';

import { JwtPayload, GoogleProfile, AuthTokens, AuthUser } from './interfaces';
import { AUTH_CONSTANTS } from './auth.constants';
import {
  ChangePasswordDto,
  ConfirmPasswordResetDto,
  RegisterDto,
  UpdateMeDto,
} from './dto/auth.dto';
import { PrismaService } from '@/prisma/prisma.service';

type AccountUser = Pick<
  User,
  | 'id'
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'avatar'
  | 'role'
  | 'provider'
  | 'isActive'
  | 'isEmailVerified'
>;

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  /**
   * Dọn expired tokens mỗi lần server khởi động.
   * Bù cho những lần server tắt và bỏ lỡ cron 3h sáng.
   */
  async onApplicationBootstrap() {
    try {
      await this.cleanExpiredTokens();
    } catch (error) {
      this.logger.warn(
        'Không thể dọn expired tokens lúc khởi động:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // @Cron('0 3 * * *') // cai them nestjs/schedule, dung de xoa token luc 3.00am moi ngay
  async cleanExpiredTokens(): Promise<void> {
    const [refreshResult, accountResult] = await Promise.all([
      this.prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      }),
      this.prisma.accountToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      }),
    ]);
    if (refreshResult.count > 0) {
      this.logger.log(`Đã xóa ${refreshResult.count} refresh token hết hạn`);
    }
    if (accountResult.count > 0) {
      this.logger.log(`Đã xóa ${accountResult.count} account token hết hạn`);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  getFrontendUrl(): string {
    return this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3564',
    );
  }

  // ─── Local Auth ─────────────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<AuthUser> {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('Email đã được sử dụng');

    const hashedPassword = await bcrypt.hash(
      dto.password,
      AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS,
    );

    const saved = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        provider: PrismaAuthProvider.local,
      },
    });

    return this.toAuthUser(saved);
  }

  async getCurrentAccount(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: this.accountSelect(),
    });

    return this.toAccountUser(user);
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<AuthUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.avatar !== undefined && { avatar: dto.avatar }),
      },
    });

    return this.toAuthUser(user);
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<AuthUser> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (user.provider !== PrismaAuthProvider.local || !user.password) {
      throw new BadRequestException(
        'Tài khoản Google không thể đổi mật khẩu tại đây',
      );
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Mật khẩu hiện tại không chính xác');
    }

    const password = await bcrypt.hash(
      dto.newPassword,
      AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS,
    );

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { password },
    });

    await this.revokeAllUserTokens(userId);
    return this.toAuthUser(updated);
  }

  async requestEmailVerification(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (user.isEmailVerified) {
      return { message: 'Email đã được xác thực' };
    }

    return this.createAccountTokenResponse(
      user.id,
      AccountTokenType.email_verification,
      EMAIL_VERIFICATION_TTL_MS,
      `/auth/verify-email`,
      'Đã tạo link xác thực email',
    );
  }

  async confirmEmailVerification(token: string) {
    const accountToken = await this.findValidAccountToken(
      token,
      AccountTokenType.email_verification,
    );

    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: accountToken.userId },
        data: { isEmailVerified: true },
      }),
      this.prisma.accountToken.update({
        where: { id: accountToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return this.toAccountUser(user);
  }

  async requestPasswordReset(email: string) {
    const genericResponse = {
      message:
        'Nếu email tồn tại trong hệ thống, link khôi phục mật khẩu đã được tạo.',
    };

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (
      !user ||
      !user.isActive ||
      user.provider !== PrismaAuthProvider.local ||
      !user.password
    ) {
      return genericResponse;
    }

    const response = await this.createAccountTokenResponse(
      user.id,
      AccountTokenType.password_reset,
      PASSWORD_RESET_TTL_MS,
      `/auth/reset-password`,
      genericResponse.message,
    );

    return response;
  }

  async confirmPasswordReset(dto: ConfirmPasswordResetDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp');
    }

    const accountToken = await this.findValidAccountToken(
      dto.token,
      AccountTokenType.password_reset,
    );

    const password = await bcrypt.hash(
      dto.newPassword,
      AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS,
    );

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: accountToken.userId },
        data: { password },
      }),
      this.prisma.accountToken.update({
        where: { id: accountToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: accountToken.userId, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      }),
    ]);

    return { message: 'Đặt lại mật khẩu thành công' };
  }

  async validateLocalUser(
    email: string,
    password: string,
  ): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
        role: true,
        provider: true,
        isActive: true,
      },
    });

    if (!user) return null;

    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa');
    }

    if (user.provider !== PrismaAuthProvider.local || !user.password) {
      throw new BadRequestException(
        'Tài khoản này liên kết Google account. Vui lòng dùng Google login',
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    return this.toAuthUser(user);
  }

  // ─── Google OAuth ────────────────────────────────────────────────────────────

  async findOrCreateGoogleUser(profile: GoogleProfile): Promise<AuthUser> {
    // Kiểm tra trước: email đã tồn tại với local account không
    // Phải làm trước upsert vì nếu email đã có + googleId null
    // → upsert theo googleId sẽ CREATE bản ghi mới và bị lỗi unique constraint ở email
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (existingByEmail && !existingByEmail.googleId) {
      // Liên kết Google vào tài khoản local hiện có
      const linked = await this.prisma.user.update({
        where: { id: existingByEmail.id },
        data: { googleId: profile.googleId, avatar: profile.avatar },
      });

      if (!linked.isActive) {
        throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa');
      }

      return this.toAuthUser(linked);
    }

    // Upsert theo googleId: update nếu đã có, create nếu chưa có
    try {
      const user = await this.prisma.user.upsert({
        where: { googleId: profile.googleId },
        update: {
          avatar: profile.avatar,
        },
        create: {
          email: profile.email,
          googleId: profile.googleId,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatar: profile.avatar,
          provider: PrismaAuthProvider.google,
          isActive: true,
          isEmailVerified: true,
        },
      });
      if (!user.isActive) {
        throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa');
      }
      return this.toAuthUser(user);
    } catch (error) {
      // Race condition: 2 request đồng thời tạo cùng 1 user → P2002
      // Xử lý bằng cách retry findUnique thay vì crash
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.warn(
          `Race condition khi tạo Google user (${profile.email}), retry findUnique`,
        );
        const existing = await this.prisma.user.findUnique({
          where: { googleId: profile.googleId },
        });
        if (!existing) throw error; // Lỗi thật, không phải race condition
        if (!existing.isActive) {
          throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa');
        }
        return this.toAuthUser(existing);
      }
      throw error;
    }
  }

  // ─── Token Management ────────────────────────────────────────────────────────

  async generateTokens(user: AuthUser): Promise<AuthTokens> {
    const tokenFamily = uuidv4();

    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(user, tokenFamily),
      this.signRefreshToken(user, tokenFamily),
    ]);

    await this.saveRefreshToken(user.id, refreshToken, tokenFamily);

    return { accessToken, refreshToken };
  }

  /**
   * Rotate refresh token: Vô hiệu token cũ, cấp token mới.
   * Nếu token đã dùng rồi (reuse attack) → revoke toàn bộ family.
   */
  async rotateRefreshToken(
    oldRawToken: string,
    userData: AuthUser,
  ): Promise<AuthTokens> {
    const userId = userData.id;
    const tokenFamily = userData.tokenFamily;

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        userId,
        tokenFamily,
        isRevoked: false,
      },
    });

    if (!storedToken) {
      this.logger.warn(
        `Phát hiện Refresh Token Reuse Attack cho userId: ${userId}`,
      );
      await this.revokeAllUserTokens(userId);
      throw new UnauthorizedException(
        'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
      );
    }

    // Kiểm tra hash của raw token có khớp không
    const isValid = await bcrypt.compare(oldRawToken, storedToken.tokenHash);
    if (!isValid) {
      await this.revokeAllUserTokens(userId);
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    if (storedToken.expiresAt < new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { isRevoked: true, revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token đã hết hạn');
    }

    // Revoke token cũ
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    // Lấy thông tin user để sign token mới
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const authUser = this.toAuthUser(user);

    const [accessToken, newRefreshToken] = await Promise.all([
      this.signAccessToken(authUser, tokenFamily),
      this.signRefreshToken(authUser, tokenFamily),
    ]);

    await this.saveRefreshToken(userId, newRefreshToken, tokenFamily);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(userId: string, tokenFamily: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenFamily, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }

  // ─── Public Helpers ──────────────────────────────────────────────────────────

  /**
   * Decode token KHÔNG verify signature — chỉ dùng để đọc payload
   * (ví dụ: lấy tokenFamily lúc logout mà không cần xác thực)
   */
  decodeToken<T>(token: string): T | null {
    return this.jwtService.decode(token);
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private async signAccessToken(
    user: AuthUser,
    tokenFamily: string,
  ): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tokenFamily,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRES_IN,
    });
  }

  private async signRefreshToken(
    user: AuthUser,
    tokenFamily: string,
  ): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tokenFamily,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRES_IN,
    });
  }

  private async saveRefreshToken(
    userId: string,
    rawToken: string,
    tokenFamily: string,
  ): Promise<void> {
    const tokenHash = await bcrypt.hash(
      rawToken,
      AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS,
    );

    const expiresAt = new Date(
      Date.now() + AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE_MAX_AGE,
    );

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, tokenFamily, expiresAt },
    });
  }

  private async createAccountTokenResponse(
    userId: string,
    type: AccountTokenType,
    ttlMs: number,
    routePrefix: string,
    message: string,
  ) {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(
      rawToken,
      AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS,
    );
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.accountToken.updateMany({
        where: { userId, type, usedAt: null },
        data: { usedAt: now },
      }),
      this.prisma.accountToken.create({
        data: {
          userId,
          type,
          tokenHash,
          expiresAt: new Date(Date.now() + ttlMs),
        },
      }),
    ]);

    if (this.configService.get<string>('NODE_ENV') === 'production') {
      return { message };
    }

    return {
      message,
      devToken: rawToken,
      devLink: `${this.getFrontendUrl()}${routePrefix}/${rawToken}`,
    };
  }

  private async findValidAccountToken(token: string, type: AccountTokenType) {
    const candidates = await this.prisma.accountToken.findMany({
      where: {
        type,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    for (const candidate of candidates) {
      const isMatch = await bcrypt.compare(token, candidate.tokenHash);
      if (isMatch) return candidate;
    }

    throw new BadRequestException('Token không hợp lệ hoặc đã hết hạn');
  }

  private accountSelect() {
    return {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatar: true,
      role: true,
      provider: true,
      isActive: true,
      isEmailVerified: true,
    };
  }

  private toAccountUser(user: AccountUser) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      role: user.role,
      provider: user.provider,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
    };
  }

  // Import type trực tiếp từ @prisma/client, không phụ thuộc entity file cũ
  private toAuthUser(
    user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'role'>,
  ): AuthUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as AuthUser['role'],
      tokenFamily: '', // placeholder — được gán thực khi sign token
    };
  }
}
