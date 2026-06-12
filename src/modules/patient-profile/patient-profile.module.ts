import { Module } from '@nestjs/common';
import { PatientProfileService } from './patient-profile.service';
import { PatientProfileController } from './patient-profile.controller';

@Module({
  controllers: [PatientProfileController],
  providers: [PatientProfileService],
  exports: [PatientProfileService], // Export để AppointmentModule dùng verifyOwnership
})
export class PatientProfileModule {}
