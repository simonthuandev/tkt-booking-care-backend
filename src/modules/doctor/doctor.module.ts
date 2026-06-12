import { Module } from '@nestjs/common';
import { DoctorService } from './doctor.service';
import {
  DoctorPublicController,
  DoctorSelfController,
  DoctorAdminController,
} from './doctor.controller';

@Module({
  controllers: [
    DoctorSelfController, // /doctors/me/profile — khai báo TRƯỚC public để tránh slug conflict
    DoctorPublicController, // /doctors, /doctors/:slug
    DoctorAdminController, // /admin/doctors CRUD
  ],
  providers: [DoctorService],
  exports: [DoctorService], // Export để Appointment/TimeSlot module dùng sau
})
export class DoctorModule {}
