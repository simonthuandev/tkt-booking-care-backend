import { Module } from '@nestjs/common';
import { SpecialtyService } from './specialty.service';
import {
  SpecialtyPublicController,
  SpecialtyAdminController,
} from './specialty.controller';
@Module({
  controllers: [
    SpecialtyPublicController, // GET /specialties, GET /specialties/:slug
    SpecialtyAdminController, // CRUD /admin/specialties
  ],
  providers: [SpecialtyService],
  exports: [SpecialtyService], // Export để Hospital/Doctor module dùng sau
})
export class SpecialtyModule {}
