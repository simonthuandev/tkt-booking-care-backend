import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true, // ConfigModule có thể dùng ở bất kỳ đâu mà không cần import lại
      envFilePath: '.env', // load cấu hình từ file .env
      cache: true, // cache config để tăng hiệu suất, tránh đọc file nhiều lần
    }),

    // ─── Rate Limiting (chống brute-force) ───────────────────────────────────
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,   // 1 giây
        limit: 5,    // tối đa 5 request
      },
      {
        name: 'medium',
        ttl: 60000,  // 1 phút
        limit: 50,
      },
    ]),
    PrismaModule, 
    AuthModule
  ],

  controllers: [AppController],

  providers: [
    // Rate limiting guard toàn cục
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    AppService
  ],
})
export class AppModule {}
