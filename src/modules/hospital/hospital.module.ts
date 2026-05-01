import { Module } from '@nestjs/common';
import { HospitalService } from './hospital.service';
import {
  HospitalPublicController,
  HospitalAdminController,
} from './hospital.controller';

@Module({
  controllers: [
    HospitalPublicController,  // GET /hospitals, GET /hospitals/cities, GET /hospitals/:slug
    HospitalAdminController,   // CRUD /admin/hospitals
  ],
  providers: [HospitalService],
  exports: [HospitalService], // Export để Doctor/Appointment module dùng sau
})
export class HospitalModule {}
