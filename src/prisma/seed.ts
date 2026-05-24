/**
 * prisma/seed.ts
 * Chạy: npx prisma db seed
 *
 * Tạo:
 *   - 1 admin account
 *   - 3 specialties
 *   - 2 hospitals
 *   - 3 doctors (mỗi doctor có user + doctor profile)
 *   - DoctorSpecialty + DoctorHospital links
 *   - TimeSlots mẫu cho 7 ngày tới
 *   - 1 user thường + 1 PatientProfile
 */

import {
  PrismaClient,
  UserRole,
  AuthProvider,
  HospitalType,
  Gender,
  Relationship,
  Prisma,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

// const prisma = new PrismaClient();
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Helpers ─────────────────────────────────────────────────

const SALT_ROUNDS = 12;

async function hash(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/** Sinh slug từ tên tiếng Việt */
function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Sinh doctor slug: ten-bac-si + 4 ký tự ngẫu nhiên */
function toDoctorSlug(fullName: string): string {
  const base = toSlug(fullName);
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${suffix}`;
}

/** Tạo TimeSlots cho 1 bác sĩ trong 7 ngày tới */
async function generateTimeSlots(
  doctorId: string,
  hospitalId: string,
  startHour: number = 8,
  endHour: number = 17,
  durationMin: number = 30,
) {
  // const slots = [];
  const slots: Prisma.TimeSlotCreateManyInput[] = [];
  const today = new Date();

  for (let day = 1; day <= 7; day++) {
    const date = new Date(today);
    date.setDate(today.getDate() + day);

    // Bỏ qua Chủ nhật (0)
    if (date.getDay() === 0) continue;

    for (let hour = startHour; hour < endHour; hour++) {
      for (let min = 0; min < 60; min += durationMin) {
        const startTime = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        const endMin = min + durationMin;
        const endHourActual = endMin >= 60 ? hour + 1 : hour;
        const endMinActual = endMin >= 60 ? endMin - 60 : endMin;
        const endTime = `${String(endHourActual).padStart(2, '0')}:${String(endMinActual).padStart(2, '0')}`;

        // Bỏ giờ nghỉ trưa 12:00-13:00
        if (hour === 12) continue;

        slots.push({
          doctorId,
          hospitalId,
          date: new Date(date.setHours(0, 0, 0, 0)),
          startTime,
          endTime,
          isBooked: false,
          isBlocked: false,
        });
      }
    }
  }

  // Dùng createMany để nhanh hơn
  await prisma.timeSlot.createMany({
    data: slots,
    skipDuplicates: true,
  });

  return slots.length;
}

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Bắt đầu seed...\n');

  // ── 1. Specialties ──────────────────────────────────────────

  const specialties = await Promise.all([
    prisma.specialty.upsert({
      where: { slug: 'tim-mach' },
      update: {},
      create: {
        name: 'Tim mạch',
        slug: 'tim-mach',
        description: 'Chẩn đoán và điều trị các bệnh về tim và mạch máu.',
        imgURL: '',
        isActive: true,
      },
    }),
    prisma.specialty.upsert({
      where: { slug: 'nhi-khoa' },
      update: {},
      create: {
        name: 'Nhi khoa',
        slug: 'nhi-khoa',
        description: 'Chăm sóc sức khỏe trẻ em từ sơ sinh đến 18 tuổi.',
        imgURL: '',
        isActive: true,
      },
    }),
    prisma.specialty.upsert({
      where: { slug: 'da-lieu' },
      update: {},
      create: {
        name: 'Da liễu',
        slug: 'da-lieu',
        description: 'Điều trị các bệnh về da, tóc và móng.',
        imgURL: '',
        isActive: true,
      },
    }),
  ]);

  console.log(`✅ Specialties: ${specialties.length} records`);

  // ── 2. Hospitals (3 bản ghi) ────────────────────────────────

  const hospitals = await Promise.all([
    prisma.hospital.upsert({
      where: { slug: 'benh-vien-cho-ray' },
      update: {},
      create: {
        name: 'Bệnh viện Chợ Rẫy',
        slug: 'benh-vien-cho-ray',
        address: '201B Nguyễn Chí Thanh, Phường 12, Quận 5',
        city: 'TP. Hồ Chí Minh',
        type: HospitalType.public,
        description: 'Bệnh viện đa khoa lớn nhất khu vực phía Nam.',
        isActive: true,
      },
    }),
    prisma.hospital.upsert({
      where: { slug: 'benh-vien-vinmec' },
      update: {},
      create: {
        name: 'Bệnh viện Vinmec',
        slug: 'benh-vien-vinmec',
        address: '458 Minh Khai, Hai Bà Trưng',
        city: 'Hà Nội',
        type: HospitalType.private,
        description: 'Hệ thống bệnh viện đa khoa quốc tế Vinmec.',
        isActive: true,
      },
    }),
    prisma.hospital.upsert({
      where: { slug: 'benh-vien-bach-mai' },
      update: {},
      create: {
        name: 'Bệnh viện Bạch Mai',
        slug: 'benh-vien-bach-mai',
        address: '78 Giải Phóng, Phương Mai, Đống Đa',
        city: 'Hà Nội',
        type: HospitalType.public,
        description: 'Bệnh viện đa khoa hạng đặc biệt đầu tiên của cả nước.',
        isActive: true,
      },
    }),
  ]);

  console.log(`✅ Hospitals: ${hospitals.length} records`);

  // ── 3. Admin Account ────────────────────────────────────────

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@tktbookingcare.vn' },
    update: {},
    create: {
      email: 'admin@tktbookingcare.vn',
      password: await hash('Admin@123456'),
      firstName: 'Super',
      lastName: 'Admin',
      role: UserRole.admin,
      provider: AuthProvider.local,
      isActive: true,
      isEmailVerified: true,
    },
  });

  console.log(`✅ Admin: ${adminUser.email}`);

  // ── 4. Doctor Accounts ──────────────────────────────────────

  const doctorData = [
    {
      email: 'bs.nguyen.thi.lan@tktbookingcare.vn',
      firstName: 'Lan',
      lastName: 'Nguyễn Thị',
      fullName: 'Nguyễn Thị Lan',
      bio: 'Chuyên gia tim mạch với hơn 15 năm kinh nghiệm tại BV Chợ Rẫy.',
      experience: 15,
      licenseNumber: 'BS-HCM-001',
      consultationFee: 350000,
      specialtyIndex: 0, // Tim mạch
      hospitalIndex: 0, // Chợ Rẫy
    },
    {
      email: 'bs.le.van.hung@tktbookingcare.vn',
      firstName: 'Hùng',
      lastName: 'Lê Văn',
      fullName: 'Lê Văn Hùng',
      bio: 'Bác sĩ nhi khoa, chuyên điều trị các bệnh hô hấp ở trẻ em.',
      experience: 10,
      licenseNumber: 'BS-HN-002',
      consultationFee: 280000,
      specialtyIndex: 1, // Nhi khoa
      hospitalIndex: 1, // Vinmec
    },
    {
      email: 'bs.tran.thuy.linh@tktbookingcare.vn',
      firstName: 'Linh',
      lastName: 'Trần Thúy',
      fullName: 'Trần Thúy Linh',
      bio: 'Bác sĩ da liễu, chuyên điều trị mụn trứng cá và các bệnh da mãn tính.',
      experience: 8,
      licenseNumber: 'BS-HCM-003',
      consultationFee: 300000,
      specialtyIndex: 2, // Da liễu
      hospitalIndex: 0, // Chợ Rẫy
    },
  ];

  for (const d of doctorData) {
    // Tạo User với role = doctor
    const doctorUser = await prisma.user.upsert({
      where: { email: d.email },
      update: {},
      create: {
        email: d.email,
        password: await hash('Doctor@123456'),
        firstName: d.firstName,
        lastName: d.lastName,
        role: UserRole.doctor,
        provider: AuthProvider.local,
        isActive: true,
        isEmailVerified: true,
      },
    });

    // Tạo Doctor profile
    const slug = toDoctorSlug(d.fullName);
    const doctor = await prisma.doctor.upsert({
      where: { userId: doctorUser.id },
      update: {},
      create: {
        userId: doctorUser.id,
        slug,
        imgURL: '',
        information: [d.bio],
        treatment: [],
        experience: d.experience,
        licenseNumber: d.licenseNumber,
        consultationFee: d.consultationFee,
        isVerified: true,
        isActive: true,
      },
    });

    // Link DoctorSpecialty
    await prisma.doctorSpecialty.upsert({
      where: {
        doctorId_specialtyId: {
          doctorId: doctor.id,
          specialtyId: specialties[d.specialtyIndex].id,
        },
      },
      update: {},
      create: {
        doctorId: doctor.id,
        specialtyId: specialties[d.specialtyIndex].id,
        isPrimary: true,
      },
    });

    // Link DoctorHospital
    await prisma.doctorHospital.upsert({
      where: {
        doctorId_hospitalId: {
          doctorId: doctor.id,
          hospitalId: hospitals[d.hospitalIndex].id,
        },
      },
      update: {},
      create: {
        doctorId: doctor.id,
        hospitalId: hospitals[d.hospitalIndex].id,
        workingDays: 'MON,TUE,WED,THU,FRI',
        startTime: '08:00',
        endTime: '17:00',
        isActive: true,
      },
    });

    // Generate TimeSlots cho 7 ngày tới
    const slotCount = await generateTimeSlots(
      doctor.id,
      hospitals[d.hospitalIndex].id,
    );

    console.log(
      `✅ Doctor: ${d.fullName} | slug: ${slug} | ${slotCount} slots`,
    );
  }

  // ── 5. Regular Users + PatientProfiles (3 bản ghi) ──────────

  const userData = [
    {
      email: 'user1@example.com',
      first: 'Mai',
      last: 'Nguyễn Thị',
      obj: Gender.female,
    },
    {
      email: 'user2@example.com',
      first: 'Tuấn',
      last: 'Trần Văn',
      obj: Gender.male,
    },
    {
      email: 'user3@example.com',
      first: 'Hoa',
      last: 'Lê Thị',
      obj: Gender.female,
    },
  ];

  const patientProfiles: any[] = [];

  for (const u of userData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        password: await hash('User@123456'),
        firstName: u.first,
        lastName: u.last,
        role: UserRole.user,
        provider: AuthProvider.local,
        isActive: true,
        isEmailVerified: true,
      },
    });

    let profile = await prisma.patientProfile.findFirst({
      where: { userId: user.id, relationship: Relationship.self },
    });

    if (!profile) {
      profile = await prisma.patientProfile.create({
        data: {
          userId: user.id,
          fullName: `${u.last} ${u.first}`,
          dob: new Date('1995-05-15'),
          gender: u.obj,
          phoneNumber: '0901234567',
          address: '123 Nguyễn Văn Cừ, Quận 5, TP.HCM',
          relationship: Relationship.self,
          isDefault: true,
        },
      });
    }
    patientProfiles.push(profile);
  }
  console.log(`✅ Regular Users: 3 records`);

  // ── 6. Tạo Appointments để test thanh toán (3 bản ghi) ────────

  const doctorsList = await prisma.doctor.findMany({
    include: { specialties: true },
  });
  const testAppointments: any[] = [];

  for (let i = 0; i < 3; i++) {
    const doctor = doctorsList[i % doctorsList.length];
    const patientProfile = patientProfiles[i];

    // Lấy 1 slot trống tương ứng của bác sĩ
    const slot = await prisma.timeSlot.findFirst({
      where: { doctorId: doctor.id, isBooked: false, isBlocked: false },
    });

    if (slot) {
      // Đánh dấu slot đã được đặt
      await prisma.timeSlot.update({
        where: { id: slot.id },
        data: { isBooked: true },
      });

      // Tạo lịch hẹn với trạng thái thanh toán chờ (pending)
      const appointment = await prisma.appointment.create({
        data: {
          patientProfileId: patientProfile.id,
          doctorId: doctor.id,
          hospitalId: slot.hospitalId,
          timeSlotId: slot.id,
          status: 'pending',
          paymentStatus: 'pending',
          totalAmount: doctor.consultationFee,
          reason: 'Khám kiểm tra sức khỏe tổng quát (Dữ liệu Test Thanh Toán)',
        },
      });
      testAppointments.push(appointment);
    }
  }

  // ── Summary ─────────────────────────────────────────────────

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 Seed hoàn tất!\n');
  console.log('Tài khoản demo:');
  console.log('  Admin  : admin@tktbookingcare.vn  / Admin@123456');
  console.log('  Doctor : bs.nguyen.thi.lan@...    / Doctor@123456');
  console.log('  User   : user1@example.com        / User@123456');

  console.log('\n💳 CÁC APPOINTMENT ID ĐỂ TEST THANH TOÁN (STATUS = PENDING):');
  testAppointments.forEach((app, idx) => {
    console.log(
      `   [${idx + 1}]. ID: ${app.id} | Tổng tiền: ${app.totalAmount} VND`,
    );
  });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed thất bại:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
