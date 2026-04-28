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
import { User, AuthProvider as PrismaAuthProvider, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

import {
  JwtPayload,
  JwtRefreshPayload,
  GoogleProfile,
  AuthTokens,
  AuthUser,
} from './interfaces/auth.interface';
import { AUTH_CONSTANTS } from './auth.constants';
import { RegisterDto } from './dto/auth.dto';
import { PrismaService } from '@/prisma/prisma.service';

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
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // @Cron('0 3 * * *') // cai them nestjs/schedule, dung de xoa token luc 3.00am moi ngay
  async cleanExpiredTokens(): Promise<void> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
      this.logger.log(`Đã xóa ${result.count} refresh token hết hạn`);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  getFrontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL', 'http://localhost:3564');
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
        'Tài khoản này đăng nhập bằng mạng xã hội. Vui lòng dùng Google.',
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

    } catch(error) {

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
    userId: string,
    oldRawToken: string,
    payload: JwtRefreshPayload,
  ): Promise<AuthTokens> {
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        userId,
        tokenFamily: payload.tokenFamily,
        isRevoked: false,
        expiresAt: { gt: new Date() },
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
      this.signAccessToken(authUser, payload.tokenFamily),
      this.signRefreshToken(authUser, payload.tokenFamily),
    ]);

    await this.saveRefreshToken(userId, newRefreshToken, payload.tokenFamily);

    return { accessToken, refreshToken: newRefreshToken };
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
    return this.jwtService.decode(token) as T | null;
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private async signAccessToken(user: AuthUser, tokenFamily: string): Promise<string> {
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
    const payload: JwtRefreshPayload = {
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

  // Import type trực tiếp từ @prisma/client, không phụ thuộc entity file cũ
  private toAuthUser(user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'role'>): AuthUser {
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
