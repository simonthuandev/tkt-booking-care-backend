import { Module } from '@nestjs/common';
import { TimeSlotService } from './timeslot.service';
import {
  TimeSlotPublicController,
  TimeSlotDoctorController,
  TimeSlotAdminController,
} from './timeslot.controller';

@Module({
  controllers: [
    TimeSlotPublicController, // GET /timeslots
    TimeSlotDoctorController, // /doctors/me/schedule, /doctors/me/timeslots
    TimeSlotAdminController, // /admin/timeslots CRUD + generate
  ],
  providers: [TimeSlotService],
  exports: [TimeSlotService], // Export để Appointment module dùng khi lock slot
})
export class TimeSlotModule {}
