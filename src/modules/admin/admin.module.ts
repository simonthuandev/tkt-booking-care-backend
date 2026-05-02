import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminAggregateController, AdminUsersController } from './admin.controller';

@Module({
  controllers: [AdminAggregateController, AdminUsersController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}

