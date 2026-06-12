import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: Pool;

  constructor() {
    // 1. Lấy chuỗi kết nối từ biến môi trường
    const connectionString = process.env.DATABASE_URL;

    // 2. Khởi tạo Connection Pool của thư viện pg
    const pool = new Pool({ connectionString });

    // 3. Khởi tạo Prisma Adapter cho pg
    const adapter = new PrismaPg(pool);

    // 4. Truyền adapter vào constructor của PrismaClient gốc
    // super({ adapter });
    super({ adapter, log: ['query'] });

    // 5. Lưu lại để dùng trong onModuleDestroy
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end(); // Đóng toàn bộ connection trong pool
  }
}
