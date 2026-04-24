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

import { JwtAuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    PassportModule.register({ session: false }),
    JwtModule.register({}),
    // JwtModule không cần secret ở đây vì mỗi strategy tự config
    // nhưng vẫn cần register để inject JwtService vào AuthService
    // ScheduleModule.forRoot(),  // cần cho @Cron
  ],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    JwtSoftStrategy,
    GoogleStrategy,

    // Áp dụng JwtAuthGuard toàn cục — routes cần public thì thêm @Public()
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
