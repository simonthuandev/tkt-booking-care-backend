import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import {
  AdminAggregateController,
  AdminPublicController,
  AdminUsersController,
} from './admin.controller';

@Module({
  controllers: [
    AdminPublicController,
    AdminAggregateController,
    AdminUsersController,
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
