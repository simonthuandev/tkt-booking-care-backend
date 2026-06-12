/**
 * prisma/seed.ts
 * Chạy: npx prisma db seed
 *
 * Seed deterministic demo data for the current Prisma schema.
 * The script removes only known demo records first, then recreates them.
 */

import {
  type Appointment,
  AppointmentStatus,
  AuthProvider,
  CancelledBy,
  type Doctor,
  Gender,
  HospitalType,
  type PatientProfile,
  PaymentProvider,
  PaymentStatus,
  PrismaClient,
  Relationship,
  type TimeSlot,
  type User,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SALT_ROUNDS = 12;
const ADMIN_PASSWORD = 'Admin@123456';
const DOCTOR_PASSWORD = 'Doctor@123456';
const PATIENT_PASSWORD = 'User@123456';

const specialties = [
  {
    name: 'Tim mạch',
    slug: 'tim-mach',
    description: 'Chẩn đoán và điều trị các bệnh lý tim và mạch máu.',
    imgURL: 'https://images.unsplash.com/photo-1628348070889-cb656235b4eb',
    diseases: ['Tăng huyết áp', 'Suy tim', 'Rối loạn nhịp tim'],
    information: ['Điện tâm đồ', 'Siêu âm tim', 'Tư vấn phòng ngừa bệnh tim'],
  },
  {
    name: 'Nhi khoa',
    slug: 'nhi-khoa',
    description: 'Chăm sóc sức khỏe trẻ em từ sơ sinh đến tuổi thiếu niên.',
    imgURL: 'https://images.unsplash.com/photo-1581056771107-24ca5f033842',
    diseases: ['Sốt virus', 'Viêm phế quản', 'Rối loạn tiêu hóa'],
    information: ['Khám tăng trưởng', 'Tư vấn tiêm chủng', 'Dinh dưỡng trẻ em'],
  },
  {
    name: 'Da liễu',
    slug: 'da-lieu',
    description: 'Điều trị bệnh da, tóc, móng và chăm sóc da y khoa.',
    imgURL: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef',
    diseases: ['Mụn trứng cá', 'Viêm da cơ địa', 'Nấm da'],
    information: ['Soi da', 'Điều trị mụn', 'Chăm sóc da nhạy cảm'],
  },
  {
    name: 'Tai mũi họng',
    slug: 'tai-mui-hong',
    description: 'Khám và điều trị bệnh lý tai, mũi, họng thường gặp.',
    imgURL: 'https://images.unsplash.com/photo-1588776814546-daab30f310ce',
    diseases: ['Viêm xoang', 'Viêm amidan', 'Ù tai'],
    information: ['Nội soi tai mũi họng', 'Tầm soát viêm xoang', 'Tư vấn phẫu thuật'],
  },
  {
    name: 'Cơ xương khớp',
    slug: 'co-xuong-khop',
    description: 'Điều trị đau nhức, chấn thương và bệnh lý vận động.',
    imgURL: 'https://images.unsplash.com/photo-1579154204601-01588f351e67',
    diseases: ['Thoái hóa khớp', 'Đau lưng', 'Viêm khớp'],
    information: ['Chụp chiếu cơ bản', 'Vật lý trị liệu', 'Tư vấn phục hồi chức năng'],
  },
  {
    name: 'Sản phụ khoa',
    slug: 'san-phu-khoa',
    description: 'Chăm sóc sức khỏe phụ nữ, thai kỳ và sau sinh.',
    imgURL: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56',
    diseases: ['Rối loạn kinh nguyệt', 'Viêm phụ khoa', 'Theo dõi thai kỳ'],
    information: ['Siêu âm thai', 'Khám phụ khoa', 'Tư vấn tiền sản'],
  },
  {
    name: 'Tiêu hóa',
    slug: 'tieu-hoa',
    description: 'Khám và điều trị các bệnh lý dạ dày, ruột, gan mật.',
    imgURL: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118',
    diseases: ['Đau dạ dày', 'Trào ngược', 'Viêm đại tràng'],
    information: ['Nội soi tiêu hóa', 'Tư vấn dinh dưỡng', 'Theo dõi men gan'],
  },
  {
    name: 'Mắt',
    slug: 'mat',
    description: 'Khám thị lực, bệnh lý mắt và tư vấn chăm sóc mắt.',
    imgURL: 'https://images.unsplash.com/photo-1559757175-5700dde675bc',
    diseases: ['Cận thị', 'Khô mắt', 'Đục thủy tinh thể'],
    information: ['Đo khúc xạ', 'Soi đáy mắt', 'Tư vấn kính thuốc'],
  },
  {
    name: 'Thần kinh',
    slug: 'than-kinh',
    description: 'Điều trị đau đầu, mất ngủ và bệnh lý thần kinh.',
    imgURL: 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063',
    diseases: ['Đau nửa đầu', 'Mất ngủ', 'Rối loạn tiền đình'],
    information: ['Đánh giá thần kinh', 'Tư vấn giấc ngủ', 'Theo dõi điều trị dài hạn'],
  },
  {
    name: 'Nội tiết',
    slug: 'noi-tiet',
    description: 'Quản lý bệnh lý tuyến giáp, đái tháo đường và chuyển hóa.',
    imgURL: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528',
    diseases: ['Đái tháo đường', 'Rối loạn tuyến giáp', 'Béo phì'],
    information: ['Theo dõi đường huyết', 'Tư vấn chế độ ăn', 'Điều chỉnh thuốc định kỳ'],
  },
];

const hospitals = [
  {
    name: 'Bệnh viện Chợ Rẫy',
    slug: 'benh-vien-cho-ray',
    address: '201B Nguyễn Chí Thanh, Phường 12, Quận 5',
    city: 'TP. Hồ Chí Minh',
    type: HospitalType.public,
    imgURL: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3',
    description: 'Bệnh viện đa khoa tuyến cuối tại khu vực phía Nam.',
  },
  {
    name: 'Bệnh viện Bạch Mai',
    slug: 'benh-vien-bach-mai',
    address: '78 Giải Phóng, Phương Mai, Đống Đa',
    city: 'Hà Nội',
    type: HospitalType.public,
    imgURL: 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc',
    description: 'Bệnh viện đa khoa hạng đặc biệt tại Hà Nội.',
  },
  {
    name: 'Bệnh viện Vinmec Central Park',
    slug: 'benh-vien-vinmec-central-park',
    address: '208 Nguyễn Hữu Cảnh, Bình Thạnh',
    city: 'TP. Hồ Chí Minh',
    type: HospitalType.private,
    imgURL: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d',
    description: 'Bệnh viện đa khoa quốc tế với nhiều chuyên khoa sâu.',
  },
  {
    name: 'Bệnh viện Đại học Y Dược TP.HCM',
    slug: 'benh-vien-dai-hoc-y-duoc-tphcm',
    address: '215 Hồng Bàng, Phường 11, Quận 5',
    city: 'TP. Hồ Chí Minh',
    type: HospitalType.public,
    imgURL: 'https://images.unsplash.com/photo-1586773860383-dab5f3bc1bcc',
    description: 'Cơ sở khám chữa bệnh kết hợp đào tạo và nghiên cứu.',
  },
  {
    name: 'Bệnh viện Trung ương Huế',
    slug: 'benh-vien-trung-uong-hue',
    address: '16 Lê Lợi, Vĩnh Ninh',
    city: 'Huế',
    type: HospitalType.public,
    imgURL: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907',
    description: 'Bệnh viện trung ương phục vụ khu vực miền Trung.',
  },
  {
    name: 'Bệnh viện Đà Nẵng',
    slug: 'benh-vien-da-nang',
    address: '124 Hải Phòng, Thạch Thang',
    city: 'Đà Nẵng',
    type: HospitalType.public,
    imgURL: 'https://images.unsplash.com/photo-1587351021355-a479a299d2f9',
    description: 'Bệnh viện đa khoa lớn tại thành phố Đà Nẵng.',
  },
  {
    name: 'Phòng khám Quốc tế Victoria',
    slug: 'phong-kham-quoc-te-victoria',
    address: '135A Nguyễn Văn Trỗi, Phú Nhuận',
    city: 'TP. Hồ Chí Minh',
    type: HospitalType.private,
    imgURL: 'https://images.unsplash.com/photo-1516549655169-df83a0774514',
    description: 'Phòng khám tư nhân theo mô hình chăm sóc gia đình.',
  },
  {
    name: 'Bệnh viện Nhi Đồng 1',
    slug: 'benh-vien-nhi-dong-1',
    address: '341 Sư Vạn Hạnh, Phường 10, Quận 10',
    city: 'TP. Hồ Chí Minh',
    type: HospitalType.public,
    imgURL: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf',
    description: 'Bệnh viện chuyên khoa nhi lâu đời tại TP. Hồ Chí Minh.',
  },
  {
    name: 'Bệnh viện Mắt Sài Gòn',
    slug: 'benh-vien-mat-sai-gon',
    address: '473 Cách Mạng Tháng 8, Phường 13, Quận 10',
    city: 'TP. Hồ Chí Minh',
    type: HospitalType.private,
    imgURL: 'https://images.unsplash.com/photo-1606811971618-4486d14f3f99',
    description: 'Hệ thống bệnh viện chuyên khoa mắt.',
  },
  {
    name: 'Bệnh viện Hữu nghị Việt Đức',
    slug: 'benh-vien-huu-nghi-viet-duc',
    address: '40 Tràng Thi, Hoàn Kiếm',
    city: 'Hà Nội',
    type: HospitalType.public,
    imgURL: 'https://images.unsplash.com/photo-1504439468489-c8920d796a29',
    description: 'Bệnh viện ngoại khoa và chấn thương chỉnh hình hàng đầu.',
  },
];

const doctorSeeds = [
  ['bs.nguyen.thi.lan@tktbookingcare.vn', 'Lan', 'Nguyễn Thị', 'bs-nguyen-thi-lan', 'BS-HCM-001', 15, 350000],
  ['bs.le.van.hung@tktbookingcare.vn', 'Hùng', 'Lê Văn', 'bs-le-van-hung', 'BS-HN-002', 10, 280000],
  ['bs.tran.thuy.linh@tktbookingcare.vn', 'Linh', 'Trần Thúy', 'bs-tran-thuy-linh', 'BS-HCM-003', 8, 300000],
  ['bs.pham.minh.quan@tktbookingcare.vn', 'Quân', 'Phạm Minh', 'bs-pham-minh-quan', 'BS-DN-004', 12, 320000],
  ['bs.vo.thanh.tam@tktbookingcare.vn', 'Tâm', 'Võ Thanh', 'bs-vo-thanh-tam', 'BS-HUE-005', 18, 420000],
  ['bs.dang.hoai.an@tktbookingcare.vn', 'An', 'Đặng Hoài', 'bs-dang-hoai-an', 'BS-HCM-006', 9, 310000],
  ['bs.bui.khanh.ngoc@tktbookingcare.vn', 'Ngọc', 'Bùi Khánh', 'bs-bui-khanh-ngoc', 'BS-HN-007', 14, 390000],
  ['bs.hoang.gia.bao@tktbookingcare.vn', 'Bảo', 'Hoàng Gia', 'bs-hoang-gia-bao', 'BS-HCM-008', 7, 260000],
  ['bs.do.thu.ha@tktbookingcare.vn', 'Hà', 'Đỗ Thu', 'bs-do-thu-ha', 'BS-HCM-009', 11, 340000],
  ['bs.ngo.quoc.viet@tktbookingcare.vn', 'Việt', 'Ngô Quốc', 'bs-ngo-quoc-viet', 'BS-HN-010', 16, 450000],
] as const;

const patientSeeds = [
  ['user01@example.com', 'Mai', 'Nguyễn Thị', Gender.female, '0901000001', '12 Nguyễn Trãi, Quận 1, TP.HCM'],
  ['user02@example.com', 'Tuấn', 'Trần Văn', Gender.male, '0901000002', '34 Lê Lợi, Hoàn Kiếm, Hà Nội'],
  ['user03@example.com', 'Hoa', 'Lê Thị', Gender.female, '0901000003', '56 Hải Phòng, Hải Châu, Đà Nẵng'],
  ['user04@example.com', 'Minh', 'Phạm Đức', Gender.male, '0901000004', '78 Hùng Vương, Huế'],
  ['user05@example.com', 'Ngân', 'Võ Kim', Gender.female, '0901000005', '90 Pasteur, Quận 3, TP.HCM'],
  ['user06@example.com', 'Khoa', 'Đặng Anh', Gender.male, '0901000006', '21 Tràng Thi, Hoàn Kiếm, Hà Nội'],
  ['user07@example.com', 'Vy', 'Bùi Tường', Gender.female, '0901000007', '43 Nguyễn Huệ, Quận 1, TP.HCM'],
  ['user08@example.com', 'Long', 'Hoàng Nhật', Gender.male, '0901000008', '65 Lê Duẩn, Hải Châu, Đà Nẵng'],
  ['user09@example.com', 'Hạnh', 'Đỗ Mỹ', Gender.female, '0901000009', '87 Trần Phú, Huế'],
  ['user10@example.com', 'Nam', 'Ngô Hải', Gender.male, '0901000010', '109 Điện Biên Phủ, Bình Thạnh, TP.HCM'],
] as const;

const adminEmail = 'admin@tktbookingcare.vn';
const seededEmails = [
  adminEmail,
  ...doctorSeeds.map(([email]) => email),
  ...patientSeeds.map(([email]) => email),
];
const seededDoctorSlugs = doctorSeeds.map(([, , , slug]) => slug);
const seededLicenseNumbers = doctorSeeds.map(([, , , , licenseNumber]) => licenseNumber);
const seededSpecialtySlugs = specialties.map((specialty) => specialty.slug);
const seededHospitalSlugs = hospitals.map((hospital) => hospital.slug);
const seededTokenFamilies = Array.from({ length: 10 }, (_, i) => `seed-family-${i + 1}`);
const seededTransactionIds = Array.from({ length: 10 }, (_, i) => `SEED-TXN-${String(i + 1).padStart(3, '0')}`);

async function hash(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

function daysFromToday(offset: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
}

async function clearDemoData() {
  const seededUsers = await prisma.user.findMany({
    where: { email: { in: seededEmails } },
    select: { id: true },
  });
  const seededUserIds = seededUsers.map((user) => user.id);

  const seededDoctors = await prisma.doctor.findMany({
    where: {
      OR: [
        { userId: { in: seededUserIds } },
        { slug: { in: seededDoctorSlugs } },
        { licenseNumber: { in: seededLicenseNumbers } },
      ],
    },
    select: { id: true },
  });
  const seededDoctorIds = seededDoctors.map((doctor) => doctor.id);

  const seededProfiles = await prisma.patientProfile.findMany({
    where: { userId: { in: seededUserIds } },
    select: { id: true },
  });
  const seededProfileIds = seededProfiles.map((profile) => profile.id);

  const seededHospitals = await prisma.hospital.findMany({
    where: { slug: { in: seededHospitalSlugs } },
    select: { id: true },
  });
  const seededHospitalIds = seededHospitals.map((hospital) => hospital.id);

  const seededSpecialties = await prisma.specialty.findMany({
    where: { slug: { in: seededSpecialtySlugs } },
    select: { id: true },
  });
  const seededSpecialtyIds = seededSpecialties.map((specialty) => specialty.id);

  const seededSlots = await prisma.timeSlot.findMany({
    where: {
      OR: [
        { doctorId: { in: seededDoctorIds } },
        { hospitalId: { in: seededHospitalIds } },
      ],
    },
    select: { id: true },
  });
  const seededSlotIds = seededSlots.map((slot) => slot.id);

  const seededAppointments = await prisma.appointment.findMany({
    where: {
      OR: [
        { patientProfileId: { in: seededProfileIds } },
        { doctorId: { in: seededDoctorIds } },
        { hospitalId: { in: seededHospitalIds } },
        { timeSlotId: { in: seededSlotIds } },
      ],
    },
    select: { id: true },
  });
  const seededAppointmentIds = seededAppointments.map((appointment) => appointment.id);

  await prisma.review.deleteMany({
    where: {
      OR: [
        { appointmentId: { in: seededAppointmentIds } },
        { patientProfileId: { in: seededProfileIds } },
        { doctorId: { in: seededDoctorIds } },
        { hospitalId: { in: seededHospitalIds } },
      ],
    },
  });
  await prisma.payment.deleteMany({
    where: {
      OR: [
        { appointmentId: { in: seededAppointmentIds } },
        { transactionId: { in: seededTransactionIds } },
      ],
    },
  });
  await prisma.appointment.deleteMany({ where: { id: { in: seededAppointmentIds } } });
  await prisma.timeSlot.deleteMany({ where: { id: { in: seededSlotIds } } });
  await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { userId: { in: seededUserIds } },
        { tokenFamily: { in: seededTokenFamilies } },
      ],
    },
  });
  await prisma.doctorHospital.deleteMany({
    where: {
      OR: [
        { doctorId: { in: seededDoctorIds } },
        { hospitalId: { in: seededHospitalIds } },
      ],
    },
  });
  await prisma.doctorSpecialty.deleteMany({
    where: {
      OR: [
        { doctorId: { in: seededDoctorIds } },
        { specialtyId: { in: seededSpecialtyIds } },
      ],
    },
  });
  await prisma.doctor.deleteMany({ where: { id: { in: seededDoctorIds } } });
  await prisma.patientProfile.deleteMany({ where: { id: { in: seededProfileIds } } });
  await prisma.user.deleteMany({ where: { id: { in: seededUserIds } } });
  await prisma.hospital.deleteMany({ where: { id: { in: seededHospitalIds } } });
  await prisma.specialty.deleteMany({ where: { id: { in: seededSpecialtyIds } } });
}

async function main() {
  console.log('Bắt đầu seed dữ liệu demo...');

  await clearDemoData();
  console.log('Đã xóa dữ liệu demo cũ.');

  const [adminPasswordHash, doctorPasswordHash, patientPasswordHash] = await Promise.all([
    hash(ADMIN_PASSWORD),
    hash(DOCTOR_PASSWORD),
    hash(PATIENT_PASSWORD),
  ]);

  await prisma.specialty.createMany({
    data: specialties.map((specialty) => ({
      ...specialty,
      isActive: true,
    })),
  });
  const createdSpecialties = await prisma.specialty.findMany({
    where: { slug: { in: seededSpecialtySlugs } },
    orderBy: { slug: 'asc' },
  });
  const specialtyBySlug = new Map(createdSpecialties.map((specialty) => [specialty.slug, specialty]));

  await prisma.hospital.createMany({
    data: hospitals.map((hospital) => ({
      ...hospital,
      isActive: true,
    })),
  });
  const createdHospitals = await prisma.hospital.findMany({
    where: { slug: { in: seededHospitalSlugs } },
    orderBy: { slug: 'asc' },
  });
  const hospitalBySlug = new Map(createdHospitals.map((hospital) => [hospital.slug, hospital]));

  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      password: adminPasswordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: UserRole.admin,
      provider: AuthProvider.local,
      isActive: true,
      isEmailVerified: true,
    },
  });

  const doctorUsers: User[] = [];
  for (const [email, firstName, lastName] of doctorSeeds) {
    doctorUsers.push(
      await prisma.user.create({
        data: {
          email,
          password: doctorPasswordHash,
          firstName,
          lastName,
          role: UserRole.doctor,
          provider: AuthProvider.local,
          isActive: true,
          isEmailVerified: true,
        },
      }),
    );
  }

  const patientUsers: User[] = [];
  for (const [email, firstName, lastName] of patientSeeds) {
    patientUsers.push(
      await prisma.user.create({
        data: {
          email,
          password: patientPasswordHash,
          firstName,
          lastName,
          role: UserRole.user,
          provider: AuthProvider.local,
          isActive: true,
          isEmailVerified: true,
        },
      }),
    );
  }

  const refreshUsers = [admin, ...doctorUsers.slice(0, 4), ...patientUsers.slice(0, 5)];
  await prisma.refreshToken.createMany({
    data: refreshUsers.map((user, index) => ({
      userId: user.id,
      tokenHash: `seed-refresh-token-hash-${index + 1}`,
      tokenFamily: seededTokenFamilies[index],
      isRevoked: index % 4 === 0,
      expiresAt: daysFromToday(30 + index),
      revokedAt: index % 4 === 0 ? daysFromToday(-1) : null,
    })),
  });

  const patientProfiles: PatientProfile[] = [];
  for (let i = 0; i < patientSeeds.length; i++) {
    const [, firstName, lastName, gender, phoneNumber, address] = patientSeeds[i];
    patientProfiles.push(
      await prisma.patientProfile.create({
        data: {
          userId: patientUsers[i].id,
          fullName: `${lastName} ${firstName}`,
          dob: new Date(Date.UTC(1988 + i, i % 12, 10 + (i % 18))),
          gender,
          phoneNumber,
          address,
          relationship: Relationship.self,
          isDefault: true,
        },
      }),
    );
  }

  const doctors: Doctor[] = [];
  for (let i = 0; i < doctorSeeds.length; i++) {
    const [, firstName, lastName, slug, licenseNumber, experience, consultationFee] = doctorSeeds[i];
    const specialty = specialties[i];
    doctors.push(
      await prisma.doctor.create({
        data: {
          userId: doctorUsers[i].id,
          slug,
          imgURL: `https://i.pravatar.cc/300?img=${20 + i}`,
          information: [
            `${lastName} ${firstName} có ${experience} năm kinh nghiệm trong lĩnh vực ${specialty.name}.`,
            'Tư vấn rõ ràng, ưu tiên phác đồ điều trị phù hợp với từng bệnh nhân.',
          ],
          treatment: specialty.diseases,
          experience,
          licenseNumber,
          consultationFee,
          rating: 0,
          totalReviews: 0,
          isVerified: true,
          isActive: true,
        },
      }),
    );
  }

  const specialtySlugs = specialties.map((specialty) => specialty.slug);
  const hospitalSlugs = hospitals.map((hospital) => hospital.slug);
  for (let i = 0; i < doctors.length; i++) {
    const specialty = specialtyBySlug.get(specialtySlugs[i]);
    const hospital = hospitalBySlug.get(hospitalSlugs[i]);

    if (!specialty || !hospital) {
      throw new Error(`Không tìm thấy specialty/hospital seed tại index ${i}`);
    }

    await prisma.doctorSpecialty.create({
      data: {
        doctorId: doctors[i].id,
        specialtyId: specialty.id,
        isPrimary: true,
      },
    });

    await prisma.doctorHospital.create({
      data: {
        doctorId: doctors[i].id,
        hospitalId: hospital.id,
        workingDays: i % 2 === 0 ? 'MON,WED,FRI' : 'TUE,THU,SAT',
        startTime: i % 3 === 0 ? '07:30' : '08:00',
        endTime: i % 3 === 0 ? '16:30' : '17:00',
        isActive: true,
      },
    });
  }

  const timeSlots: TimeSlot[] = [];
  for (let i = 0; i < 12; i++) {
    const doctorIndex = i % doctors.length;
    const hospital = hospitalBySlug.get(hospitalSlugs[doctorIndex]);

    if (!hospital) {
      throw new Error(`Không tìm thấy hospital seed tại index ${doctorIndex}`);
    }

    const hour = 8 + (i % 6);
    timeSlots.push(
      await prisma.timeSlot.create({
        data: {
          doctorId: doctors[doctorIndex].id,
          hospitalId: hospital.id,
          date: daysFromToday(1 + Math.floor(i / 4)),
          startTime: `${String(hour).padStart(2, '0')}:00`,
          endTime: `${String(hour).padStart(2, '0')}:30`,
          isBooked: i < 10,
          isBlocked: i === 11,
        },
      }),
    );
  }

  const appointmentStatuses = [
    AppointmentStatus.completed,
    AppointmentStatus.completed,
    AppointmentStatus.completed,
    AppointmentStatus.completed,
    AppointmentStatus.completed,
    AppointmentStatus.completed,
    AppointmentStatus.confirmed,
    AppointmentStatus.processing,
    AppointmentStatus.pending,
    AppointmentStatus.cancelled,
  ];
  const appointmentPaymentStatuses = [
    PaymentStatus.completed,
    PaymentStatus.completed,
    PaymentStatus.completed,
    PaymentStatus.completed,
    PaymentStatus.completed,
    PaymentStatus.completed,
    PaymentStatus.pending,
    PaymentStatus.completed,
    PaymentStatus.pending,
    PaymentStatus.refunded,
  ];

  const appointments: Appointment[] = [];
  for (let i = 0; i < 10; i++) {
    const slot = timeSlots[i];
    const doctor = doctors[i % doctors.length];
    appointments.push(
      await prisma.appointment.create({
        data: {
          patientProfileId: patientProfiles[i].id,
          doctorId: doctor.id,
          hospitalId: slot.hospitalId,
          timeSlotId: slot.id,
          status: appointmentStatuses[i],
          paymentStatus: appointmentPaymentStatuses[i],
          totalAmount: doctor.consultationFee,
          reason: [
            'Khám tổng quát và tư vấn sức khỏe định kỳ',
            'Theo dõi triệu chứng gần đây và nhận phác đồ điều trị',
            'Tái khám theo lịch hẹn trước',
          ][i % 3],
          cancelReason: appointmentStatuses[i] === AppointmentStatus.cancelled ? 'Bệnh nhân đổi lịch cá nhân' : null,
          cancelledBy: appointmentStatuses[i] === AppointmentStatus.cancelled ? CancelledBy.patient : null,
        },
      }),
    );
  }

  await prisma.payment.createMany({
    data: appointments.map((appointment, index) => ({
      appointmentId: appointment.id,
      amount: appointment.totalAmount,
      provider: index % 3 === 0 ? PaymentProvider.cash : PaymentProvider.vn_pay,
      transactionId: index % 3 === 0 ? null : seededTransactionIds[index],
      status: appointment.paymentStatus,
    })),
  });

  const reviewRatings = [5, 4, 5, 4, 5, 3];
  for (let i = 0; i < reviewRatings.length; i++) {
    const appointment = appointments[i];
    await prisma.review.create({
      data: {
        appointmentId: appointment.id,
        patientProfileId: appointment.patientProfileId,
        doctorId: appointment.doctorId,
        hospitalId: appointment.hospitalId,
        rating: reviewRatings[i],
        comment: [
          'Bác sĩ tư vấn kỹ, giải thích dễ hiểu.',
          'Quy trình khám nhanh và nhân viên hỗ trợ tốt.',
          'Kết quả điều trị tiến triển tích cực.',
          'Cơ sở sạch sẽ, đặt lịch thuận tiện.',
          'Bác sĩ thân thiện và theo dõi sát.',
          'Thời gian chờ hơi lâu nhưng chất lượng khám ổn.',
        ][i],
        isVisible: i !== 5,
      },
    });
  }

  for (const doctor of doctors) {
    const result = await prisma.review.aggregate({
      where: { doctorId: doctor.id, isVisible: true },
      _avg: { rating: true },
      _count: { id: true },
    });

    await prisma.doctor.update({
      where: { id: doctor.id },
      data: {
        rating: Math.round((result._avg.rating ?? 0) * 10) / 10,
        totalReviews: result._count.id,
      },
    });
  }

  const counts = await Promise.all([
    prisma.user.count({ where: { email: { in: seededEmails } } }),
    prisma.refreshToken.count({ where: { tokenFamily: { in: seededTokenFamilies } } }),
    prisma.patientProfile.count({ where: { userId: { in: patientUsers.map((user) => user.id) } } }),
    prisma.specialty.count({ where: { slug: { in: seededSpecialtySlugs } } }),
    prisma.hospital.count({ where: { slug: { in: seededHospitalSlugs } } }),
    prisma.doctor.count({ where: { slug: { in: seededDoctorSlugs } } }),
    prisma.doctorSpecialty.count({ where: { doctorId: { in: doctors.map((doctor) => doctor.id) } } }),
    prisma.doctorHospital.count({ where: { doctorId: { in: doctors.map((doctor) => doctor.id) } } }),
    prisma.timeSlot.count({ where: { doctorId: { in: doctors.map((doctor) => doctor.id) } } }),
    prisma.appointment.count({ where: { id: { in: appointments.map((appointment) => appointment.id) } } }),
    prisma.review.count({ where: { appointmentId: { in: appointments.map((appointment) => appointment.id) } } }),
    prisma.payment.count({ where: { appointmentId: { in: appointments.map((appointment) => appointment.id) } } }),
  ]);

  console.log('\nSeed hoàn tất.');
  console.table({
    User: counts[0],
    RefreshToken: counts[1],
    PatientProfile: counts[2],
    Specialty: counts[3],
    Hospital: counts[4],
    Doctor: counts[5],
    DoctorSpecialty: counts[6],
    DoctorHospital: counts[7],
    TimeSlot: counts[8],
    Appointment: counts[9],
    Review: counts[10],
    Payment: counts[11],
  });

  console.log('\nTài khoản demo:');
  console.log(`Admin  : ${adminEmail} / ${ADMIN_PASSWORD}`);
  console.log(`Doctor : ${doctorSeeds[0][0]} / ${DOCTOR_PASSWORD}`);
  console.log(`User   : ${patientSeeds[0][0]} / ${PATIENT_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('Seed thất bại:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
