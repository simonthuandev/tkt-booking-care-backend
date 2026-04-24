import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe, VersioningType } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { PrismaClientExceptionFilter } from '@common/filters/prisma-client-exception.filter';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ─── Security Headers ──────────────────────────────────────────────────────
  app.use(helmet());

  // ─── Cookie Parser (bắt buộc để đọc httpOnly cookies) ─────────────────────
  app.use(cookieParser());

  // ─── CORS ─────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3564',
    credentials: true, // Bắt buộc để browser gửi kèm cookie
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });


  // Bật khiên bảo vệ toàn cục
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // TỰ ĐỘNG LỌC BỎ các field không được khai báo trong DTO (VD: role)
    forbidNonWhitelisted: true, // Nếu client cố tình gửi field lạ, quăng lỗi 400 luôn
    transform: true, // Tự động ép kiểu dữ liệu
    transformOptions: {
      enableImplicitConversion: true, // Cho phép tự động chuyển đổi kiểu dữ liệu (VD: "123" -> 123)
    },
  }));

  // ─── Class Serializer (loại bỏ @Exclude fields khỏi response) ────────────
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  // Đăng ký lưới lọc bắt lỗi Prisma toàn cục
  app.useGlobalFilters(
    new PrismaClientExceptionFilter(),
    new HttpExceptionFilter(), // Bắt lỗi HTTP chung từ NestJS và Class Validator
  );

  // Tạo prefix chung (Ví dụ: 'api')
  app.setGlobalPrefix('api');

  // Kích hoạt Versioning (Ví dụ: 'v1')
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Áp dụng middleware logging lên toàn project cho tất cả các route
  // app.use(new LoggerMiddleware().use); 

  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();