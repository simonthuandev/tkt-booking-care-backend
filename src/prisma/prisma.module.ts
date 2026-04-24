import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Module này dùng cho toàn ứng dụng mà không cần import
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}