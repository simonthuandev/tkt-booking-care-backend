import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthUser, JwtPayload } from '../interfaces';
import { AUTH_CONSTANTS } from '../auth.constants';

/* LUONG XU LY JWT-REFRESH-STRATEGY:
  !req.cookies[REFRESH_TOKEN_COOKIE] && !req.headers.authorization ? 
    nem UnauthorizedException 
  !verify token ?
    nem UnauthorizedException
  extract to payload 
  validate(request, payload) ?
    nem UnauthorizedException
  done -> return user
*/

export interface RefreshTokenRequest extends Request {
  rawRefreshToken?: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Uu tien lay tu cookie truoc
        (request: Request) => {
          return request?.cookies?.[AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE] ?? null;
        },
        // Neu khong co cookie, thi lay tu header Authorization
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),

      // token het han -> nem UnauthorizedException
      ignoreExpiration: false,

      // Refresh Secret Key - verify refresh token
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),

      // Truyen them req vao validate(), thay vi chi co payload nhu JwtStrategy
      passReqToCallback: true,
    });
  }

  async validate(
    request: RefreshTokenRequest,
    payload: JwtPayload,
  ): Promise<AuthUser> {
    const rawToken = request?.cookies?.[AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE];

    if (!rawToken) {
      throw new UnauthorizedException('Refresh token không tồn tại');
    }

    if (!payload.sub || !payload.email || !payload.tokenFamily) {
      throw new UnauthorizedException('Refresh token payload không hợp lệ');
    }

    // Dinh kem rawRefreshToken de controller co the lay va compare hash
    request.rawRefreshToken = rawToken;

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
