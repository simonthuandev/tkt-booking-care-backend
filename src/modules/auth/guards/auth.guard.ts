import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators';
import { Observable } from 'rxjs';

/**
 * Guard chính — bảo vệ tất cả routes mặc định.
 * Routes được đánh dấu @Public() sẽ được bỏ qua.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    return super.canActivate(context);
  }

  handleRequest<TUser = any>(err: any, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException(
        err?.message ?? 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ',
      );
    }
    return user;
  }
}

/**
 * Guard dành riêng cho endpoint /auth/refresh
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {
  handleRequest<TUser = any>(err: any, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }
    return user;
  }
}

/**
 * Guard khởi động Google OAuth flow
 */
@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}

/**
 * Guard dùng cho logout — KHÔNG throw khi access token đã hết hạn.
 * User vẫn có thể logout dù token expired; ta chỉ cần userId từ payload.
 */
@Injectable()
export class JwtSoftAuthGuard extends AuthGuard('jwt-soft') {
  handleRequest<TUser = any>(_err: any, user: TUser): TUser {
    // Trả về user nếu có (token hợp lệ hoặc chỉ expired),
    // trả về null nếu không có token — controller tự xử lý
    return user;
  }
}