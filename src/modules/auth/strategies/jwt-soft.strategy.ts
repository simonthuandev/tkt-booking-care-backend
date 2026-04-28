import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload, AuthUser } from '../interfaces/auth.interface';
import { AUTH_CONSTANTS } from '../auth.constants';

/**
 * Strategy riêng cho logout: giống jwt nhưng ignoreExpiration = true.
 * Cho phép đọc userId từ token đã hết hạn để revoke đúng session.
 */
@Injectable()
export class JwtSoftStrategy extends PassportStrategy(Strategy, 'jwt-soft') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) =>
          request?.cookies?.[AUTH_CONSTANTS.ACCESS_TOKEN_COOKIE] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: true,  // ✅ bỏ qua hạn token khi logout
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser | null> {
    if (!payload?.sub || !payload?.email) return null;

    return {
      id: payload.sub,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      role: payload.role,
      tokenFamily: payload.tokenFamily,
    };
  }
}
