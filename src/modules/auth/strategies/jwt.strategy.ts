import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload, AuthUser } from '../interfaces';
import { AUTH_CONSTANTS } from '../auth.constants';

/* LUONG XU LY JWT-STRATEGY: 
  !req.cookies[ACCESS_TOKEN_COOKIE] && !req.headers.authorization ? 
    nem UnauthorizedException 
  !verify token ?
    nem UnauthorizedException
  extract to payload 
  validate(payload) ?
    nem UnauthorizedException
  done -> return user
*/

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Uu tien lay tu cookie truoc
        (request: Request) => {
          return request?.cookies?.[AUTH_CONSTANTS.ACCESS_TOKEN_COOKIE] ?? null;
        },
        // Neu k co cookie -> lay tu header Authorization
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),

      // token het han -> nem UnauthorizedException
      ignoreExpiration: false,

      // Access Secret Key - verify access token
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    // Token ko co PK || unique key ? Nem UnauthorizedException
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Token payload không hợp lệ');
    }

    // Tra ket qua ve cho Guard
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

/**
 * LUU Y:
 * Tin tuyet doi vao token da duoc verify (nhu tren) -> nhanh
 * Rui ro: neu user da bi xoa, token van dung duoc neu con hsd, vi ko check db
 * Kho khan: query db moi lan validate -> rat cham, hieu suat kem
 * Giai phap: ket hop them redis de luu cache
 */