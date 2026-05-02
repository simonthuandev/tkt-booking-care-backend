// Libraries
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// Modules
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from '@modules/auth/auth.module';
import { SpecialtyModule } from '@modules/specialty/specialty.module';
import { HospitalModule } from '@modules/hospital/hospital.module';
import { DoctorModule } from '@modules/doctor/doctor.module';
import { TimeSlotModule } from '@modules/timeslot/timeslot.module';
import { PatientProfileModule } from '@modules/patient-profile/patient-profile.module';
import { AppointmentModule } from '@modules/appointment/appointment.module';
import { MedicalRecordModule } from '@modules/medical-record/medical-record.module';
import { ReviewModule } from '@modules/review/review.module';
import { NewsModule } from '@modules/news/news.module';
import { AdminModule } from '@modules/admin/admin.module';
import { SearchModule } from '@modules/search/search.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // ConfigModule có thể dùng ở bất kỳ đâu mà không cần import lại
      envFilePath: '.env', // load cấu hình từ file .env
      cache: true, // cache config để tăng hiệu suất, tránh đọc file nhiều lần
    }),

    // ─── Rate Limiting (chống brute-force) ───────────────────────────────────
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 giây
        limit: 5, // tối đa 5 request
      },
      {
        name: 'medium',
        ttl: 60000, // 1 phút
        limit: 50,
      },
    ]),
    PrismaModule,
    AuthModule,
    SpecialtyModule,
    HospitalModule,
    DoctorModule,
    TimeSlotModule,
    PatientProfileModule,
    AppointmentModule,
    MedicalRecordModule,
    ReviewModule,
    NewsModule,
    AdminModule,
    SearchModule,
  ],

  providers: [
    // Rate limiting guard toàn cục
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
