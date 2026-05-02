import { Module } from '@nestjs/common';
import { MedicalRecordService } from './medical-record.service';
import {
  MedicalRecordDoctorController,
  MedicalRecordDoctorMeController,
  MedicalRecordUserController,
  MedicalRecordAdminController,
} from './medical-record.controller';

@Module({
  controllers: [
    MedicalRecordDoctorController,   // POST /medical-records, PATCH /medical-records/:id
    MedicalRecordDoctorMeController, // GET /doctors/me/medical-records
    MedicalRecordUserController,     // GET /users/me/medical-records, GET /users/me/medical-records/:id
    MedicalRecordAdminController,    // GET /admin/medical-records
  ],
  providers: [MedicalRecordService],
  exports: [MedicalRecordService],
})
export class MedicalRecordModule {}
