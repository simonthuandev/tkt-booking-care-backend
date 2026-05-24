import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators';
import { Observable } from 'rxjs';

/*=====================================================================================
 * Extend AuthGuard de tao ra cac guard rieng tu cac strategy da dang ky voi passport
 * Request den cac guards bi chan lai -> goi canActivate() de kich hoat strategy tuong ung
 * Strategy xu ly xong, tra ve err || user -> handleRequest() bat lay va xu ly
 * Neu oke, dinh user vao req va gui den controller; neu loi thi drop luon
 ======================================================================================*/

/*
 * Guard chinh - dung 'jwt' strategy: kiem tra access token hop le khong?
 * Dang ky cho toan bo app trong auth.module, moi request deu qua guard nay
 * Chi nhung route co @Public() moi khong can xac thuc, ma cho qua luon
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector, // reflector dung de doc metadata tu @Public
  ) {
    super();
  }

  // Override canActivate cua AuthGuard de check @Public truoc, neu co thi bo qua xac thuc
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(), // xet method truoc
      context.getClass(), // neu method khong co thi xet class (controller)
    ]);

    if (isPublic) return true;

    return super.canActivate(context);
  }

  // Override handleRequest
  handleRequest<TUser = any>(err: any, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException(
        err?.message ?? 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ',
      );
    }
    return user;
  }
}

// ==================================================================================

/*
 * Guard refresh token: dung 'jwt-refresh' strategy: kiem tra refresh token hop le khong?
 * Chi danh cho /auth/refresh, khong ap dung toan bo app nhu JwtAuthGuard
 * Dung thong qua UseGuards(JwtRefreshGuard) o controller
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {
  // Override handleRequest
  handleRequest<TUser = any>(err: any, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }
    return user;
  }
}

// ==================================================================================

/*
 * Guard google oauth: dung 'google' strategy: xac thuc qua google login
 * Chi dung cho /auth/google va /auth/google/callback, k ap dung toan app
 * Dung thong qua UseGuards(GoogleOAuthGuard) o controller
 */
@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {}

// ==================================================================================

/*
 * Guard soft auth: dung 'jwt-soft' strategy: kiem tra access token nhung ignore expired
 * Chi danh cho /auth/logout, khong ap dung toan bo app nhu JwtAuthGuard
 * Dung thong qua UseGuards(JwtSoftAuthGuard) o controller
 */
@Injectable()
export class JwtSoftAuthGuard extends AuthGuard('jwt-soft') {
  // Override handleRequest dam bao req den duoc controller
  handleRequest<TUser = any>(_err: any, user: TUser): TUser {
    return user; // -> Luon tra ve user: AuthUser | null, ko throw loi
  }
}
