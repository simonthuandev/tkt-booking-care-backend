import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtSoftStrategy } from './strategies/jwt-soft.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { MailModule } from '@modules/mail/mail.module';

import { JwtAuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    MailModule,
    /**
     * server khong luu session, chỉ dua vao token gui tu client
     */
    PassportModule.register({ session: false }),
    /**
     * khong can secret va options vi moi strategy tu config rieng
     * nhung van can JwtModule empty o day de co the inject JwtService vao AuthService
     */
    JwtModule.register({}),
  ],
  providers: [
    /**
     * Xu ly logic auth chinh (dang ky, dang nhap, tao token, xac thuc token, luu token, thu hoi token...)
     */
    AuthService,

    /**
     * Dinh nghia cac chien luoc xac thuc (lay token tu header, giai ma token, kiem tra token...)
     */
    JwtStrategy,
    JwtRefreshStrategy,
    JwtSoftStrategy,
    GoogleStrategy,

    /**
     * Ap dung JwtAuthGuard va RolesGuard cho toan bo app (global guard)
     * Moi request deu phai qua 2 guard nay
     */
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
