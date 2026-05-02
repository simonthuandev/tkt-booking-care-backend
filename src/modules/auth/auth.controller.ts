import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
// import type — chỉ dùng để annotate, không cần ở runtime
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import {
  JwtAuthGuard,
  JwtRefreshGuard,
  GoogleOAuthGuard,
  JwtSoftAuthGuard,
} from './guards/auth.guard';
import { Public, CurrentUser, Roles } from './decorators';
import {
  UserRole,
  AuthUser,
  JwtRefreshPayload,
} from './interfaces/auth.interface';
import {
  AUTH_CONSTANTS,
  ACCESS_COOKIE_OPTIONS,
  REFRESH_COOKIE_OPTIONS,
  COOKIE_OPTIONS,
} from './auth.constants';
import type { RefreshTokenRequest } from './strategies/jwt-refresh.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Local Auth ─────────────────────────────────────────────────────────────

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.register(dto);
    const tokens = await this.authService.generateTokens(user);

    this.setTokenCookies(res, tokens.accessToken, tokens.refreshToken);

    return {
      message: 'Đăng ký thành công',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateLocalUser(
      dto.email,
      dto.password,
    );

    if (!user) {
      // Dùng NestJS exception thay vì throw object thô
      // Thông báo chung chung — không tiết lộ email hay password sai
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const tokens = await this.authService.generateTokens(user);
    this.setTokenCookies(res, tokens.accessToken, tokens.refreshToken);

    return {
      message: 'Đăng nhập thành công',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  // ─── Google OAuth ────────────────────────────────────────────────────────────

  @Public()
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  googleLogin() {
    // Passport tự redirect sang Google — không cần body
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    try {
      const user = req.user as AuthUser;
      const tokens = await this.authService.generateTokens(user);
      this.setTokenCookies(res, tokens.accessToken, tokens.refreshToken);
      return res.redirect(
        `${this.authService.getFrontendUrl()}/auth/oauth/callback`,
      );
    } catch (error) {
      return res.redirect(
        `${this.authService.getFrontendUrl()}/auth/login?error=oauth_failed`,
      );
    }
  }

  // ─── Token Refresh ───────────────────────────────────────────────────────────

  @Public()
  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: RefreshTokenRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const payload = req.refreshPayload as JwtRefreshPayload;
    const rawToken = req.rawRefreshToken as string;

    const tokens = await this.authService.rotateRefreshToken(
      payload.sub,
      rawToken,
      payload,
    );

    this.setTokenCookies(res, tokens.accessToken, tokens.refreshToken);

    return { message: 'Token đã được làm mới' };
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────

  @Post('logout')
  @UseGuards(JwtSoftAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: RefreshTokenRequest,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: AuthUser,
  ) {
    if (user?.id && user?.tokenFamily) {
      try {
        await this.authService.logout(user.id, user.tokenFamily);
      } catch {
        // Bỏ qua lỗi — vẫn xóa cookie
      }
    }

    this.clearTokenCookies(res);
    return { message: 'Đăng xuất thành công' };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.revokeAllUserTokens(user.id);
    this.clearTokenCookies(res);

    return { message: 'Đã đăng xuất khỏi tất cả thiết bị' };
  }

  // ─── Profile ─────────────────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthUser) {
    return { user };
  }

  // ─── Admin Only ──────────────────────────────────────────────────────────────

  @Get('admin')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  adminOnlyRoute(@CurrentUser() user: AuthUser) {
    return { message: 'Chào admin!', user };
  }

  // ─── Cookie Helpers ──────────────────────────────────────────────────────────

  private setTokenCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    res.cookie(
      AUTH_CONSTANTS.ACCESS_TOKEN_COOKIE,
      accessToken,
      ACCESS_COOKIE_OPTIONS,
    );
    res.cookie(
      AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE,
      refreshToken,
      REFRESH_COOKIE_OPTIONS,
    );
  }

  private clearTokenCookies(res: Response): void {
    res.clearCookie(AUTH_CONSTANTS.ACCESS_TOKEN_COOKIE, COOKIE_OPTIONS);
    /**
     * nếu refresh token cookie không dùng path riêng thì clear đơn giản như này là đủ
     */
    res.clearCookie(AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE, COOKIE_OPTIONS);
    //  res.clearCookie(AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE, {
    //    ...COOKIE_OPTIONS,
    //    path: AUTH_CONSTANTS.REFRESH_TOKEN_PATH
    //  });
  }
}
