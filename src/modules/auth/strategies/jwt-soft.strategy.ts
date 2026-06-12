import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload, AuthUser } from '../interfaces';
import { AUTH_CONSTANTS } from '../auth.constants';

/* =============================================================================
 Chien luoc nay y chang JwtStrategy, chi khac la no cho phep token het han
 ================================================================================*/

@Injectable()
export class JwtSoftStrategy extends PassportStrategy(Strategy, 'jwt-soft') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) =>
          request?.cookies?.[AUTH_CONSTANTS.ACCESS_TOKEN_COOKIE] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: true, // Bo qua viec kiem tra het han
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser | null> {
    if (!payload?.sub || !payload?.email) {
      return null;
      // -> Return null thay vi throw loi -> de req co the den controller
      // -> Controller se tu xu ly case null
    }

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
