import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtRefreshPayload } from '../interfaces/auth.interface';
import { AUTH_CONSTANTS } from '../auth.constants';

export interface RefreshTokenRequest extends Request {
  refreshPayload?: JwtRefreshPayload;
  rawRefreshToken?: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) =>
          request?.cookies?.[AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true, // Cần để lấy raw token cho việc xác thực hash
    });
  }

  async validate(
    request: RefreshTokenRequest,
    payload: JwtRefreshPayload,
  ): Promise<JwtRefreshPayload> {
    const rawToken =
      request?.cookies?.[AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE];

    if (!rawToken) {
      throw new UnauthorizedException('Refresh token không tồn tại');
    }

    if (!payload.sub || !payload.tokenFamily) {
      throw new UnauthorizedException('Refresh token payload không hợp lệ');
    }

    // Đính kèm raw token vào request để service có thể dùng verify hash
    request.rawRefreshToken = rawToken;
    request.refreshPayload = payload;

    return payload;
  }
}
