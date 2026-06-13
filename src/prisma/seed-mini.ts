/**
 * prisma/seed.minimal.ts
 * Chạy: npx ts-node prisma/seed.minimal.ts
 *       hoặc thay entry trong package.json prisma.seed
 *
 * Seed tối giản để test: specialties, hospitals, doctors, 1 admin.
 * Không tạo patients, appointments, payments hay reviews.
 */

import {
  AuthProvider,
  type Doctor,
  HospitalType,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SALT_ROUNDS = 12;
const ADMIN_PASSWORD = 'Admin@123456';
const DOCTOR_PASSWORD = 'Doctor@123456';

// ─── Dữ liệu (giữ nguyên như seed gốc) ──────────────────────────────────────

const specialties = [
  { name: 'Tim mạch', slug: 'tim-mach', description: 'Chẩn đoán và điều trị các bệnh lý tim và mạch máu.', imgURL: '', diseases: ['Tăng huyết áp', 'Suy tim', 'Rối loạn nhịp tim'], information: ['Điện tâm đồ', 'Siêu âm tim', 'Tư vấn phòng ngừa bệnh tim'] },
  { name: 'Nhi khoa', slug: 'nhi-khoa', description: 'Chăm sóc sức khỏe trẻ em từ sơ sinh đến tuổi thiếu niên.', imgURL: '', diseases: ['Sốt virus', 'Viêm phế quản', 'Rối loạn tiêu hóa'], information: ['Khám tăng trưởng', 'Tư vấn tiêm chủng', 'Dinh dưỡng trẻ em'] },
  { name: 'Da liễu', slug: 'da-lieu', description: 'Điều trị bệnh da, tóc, móng và chăm sóc da y khoa.', imgURL: '', diseases: ['Mụn trứng cá', 'Viêm da cơ địa', 'Nấm da'], information: ['Soi da', 'Điều trị mụn', 'Chăm sóc da nhạy cảm'] },
  { name: 'Tai mũi họng', slug: 'tai-mui-hong', description: 'Khám và điều trị bệnh lý tai, mũi, họng thường gặp.', imgURL: '', diseases: ['Viêm xoang', 'Viêm amidan', 'Ù tai'], information: ['Nội soi tai mũi họng', 'Tầm soát viêm xoang', 'Tư vấn phẫu thuật'] },
  { name: 'Cơ xương khớp', slug: 'co-xuong-khop', description: 'Điều trị đau nhức, chấn thương và bệnh lý vận động.', imgURL: '', diseases: ['Thoái hóa khớp', 'Đau lưng', 'Viêm khớp'], information: ['Chụp chiếu cơ bản', 'Vật lý trị liệu', 'Tư vấn phục hồi chức năng'] },
  { name: 'Sản phụ khoa', slug: 'san-phu-khoa', description: 'Chăm sóc sức khỏe phụ nữ, thai kỳ và sau sinh.', imgURL: '', diseases: ['Rối loạn kinh nguyệt', 'Viêm phụ khoa', 'Theo dõi thai kỳ'], information: ['Siêu âm thai', 'Khám phụ khoa', 'Tư vấn tiền sản'] },
  { name: 'Tiêu hóa', slug: 'tieu-hoa', description: 'Khám và điều trị các bệnh lý dạ dày, ruột, gan mật.', imgURL: '', diseases: ['Đau dạ dày', 'Trào ngược', 'Viêm đại tràng'], information: ['Nội soi tiêu hóa', 'Tư vấn dinh dưỡng', 'Theo dõi men gan'] },
  { name: 'Mắt', slug: 'mat', description: 'Khám thị lực, bệnh lý mắt và tư vấn chăm sóc mắt.', imgURL: '', diseases: ['Cận thị', 'Khô mắt', 'Đục thủy tinh thể'], information: ['Đo khúc xạ', 'Soi đáy mắt', 'Tư vấn kính thuốc'] },
  { name: 'Thần kinh', slug: 'than-kinh', description: 'Điều trị đau đầu, mất ngủ và bệnh lý thần kinh.', imgURL: '', diseases: ['Đau nửa đầu', 'Mất ngủ', 'Rối loạn tiền đình'], information: ['Đánh giá thần kinh', 'Tư vấn giấc ngủ', 'Theo dõi điều trị dài hạn'] },
  { name: 'Nội tiết', slug: 'noi-tiet', description: 'Quản lý bệnh lý tuyến giáp, đái tháo đường và chuyển hóa.', imgURL: '', diseases: ['Đái tháo đường', 'Rối loạn tuyến giáp', 'Béo phì'], information: ['Theo dõi đường huyết', 'Tư vấn chế độ ăn', 'Điều chỉnh thuốc định kỳ'] },
];

const hospitals = [
  { name: 'Bệnh viện Chợ Rẫy', slug: 'benh-vien-cho-ray', address: '201B Nguyễn Chí Thanh, Phường 12, Quận 5', city: 'TP. Hồ Chí Minh', type: HospitalType.public, imgURL: '', description: 'Bệnh viện đa khoa tuyến cuối tại khu vực phía Nam.' },
  { name: 'Bệnh viện Bạch Mai', slug: 'benh-vien-bach-mai', address: '78 Giải Phóng, Phương Mai, Đống Đa', city: 'Hà Nội', type: HospitalType.public, imgURL: '', description: 'Bệnh viện đa khoa hạng đặc biệt tại Hà Nội.' },
  { name: 'Bệnh viện Vinmec Central Park', slug: 'benh-vien-vinmec-central-park', address: '208 Nguyễn Hữu Cảnh, Bình Thạnh', city: 'TP. Hồ Chí Minh', type: HospitalType.private, imgURL: '', description: 'Bệnh viện đa khoa quốc tế với nhiều chuyên khoa sâu.' },
  { name: 'Bệnh viện Đại học Y Dược TP.HCM', slug: 'benh-vien-dai-hoc-y-duoc-tphcm', address: '215 Hồng Bàng, Phường 11, Quận 5', city: 'TP. Hồ Chí Minh', type: HospitalType.public, imgURL: '', description: 'Cơ sở khám chữa bệnh kết hợp đào tạo và nghiên cứu.' },
  { name: 'Bệnh viện Trung ương Huế', slug: 'benh-vien-trung-uong-hue', address: '16 Lê Lợi, Vĩnh Ninh', city: 'Huế', type: HospitalType.public, imgURL: '', description: 'Bệnh viện trung ương phục vụ khu vực miền Trung.' },
  { name: 'Bệnh viện Đà Nẵng', slug: 'benh-vien-da-nang', address: '124 Hải Phòng, Thạch Thang', city: 'Đà Nẵng', type: HospitalType.public, imgURL: '', description: 'Bệnh viện đa khoa lớn tại thành phố Đà Nẵng.' },
  { name: 'Phòng khám Quốc tế Victoria', slug: 'phong-kham-quoc-te-victoria', address: '135A Nguyễn Văn Trỗi, Phú Nhuận', city: 'TP. Hồ Chí Minh', type: HospitalType.private, imgURL: '', description: 'Phòng khám tư nhân theo mô hình chăm sóc gia đình.' },
  { name: 'Bệnh viện Nhi Đồng 1', slug: 'benh-vien-nhi-dong-1', address: '341 Sư Vạn Hạnh, Phường 10, Quận 10', city: 'TP. Hồ Chí Minh', type: HospitalType.public, imgURL: '', description: 'Bệnh viện chuyên khoa nhi lâu đời tại TP. Hồ Chí Minh.' },
  { name: 'Bệnh viện Mắt Sài Gòn', slug: 'benh-vien-mat-sai-gon', address: '473 Cách Mạng Tháng 8, Phường 13, Quận 10', city: 'TP. Hồ Chí Minh', type: HospitalType.private, imgURL: '', description: 'Hệ thống bệnh viện chuyên khoa mắt.' },
  { name: 'Bệnh viện Hữu nghị Việt Đức', slug: 'benh-vien-huu-nghi-viet-duc', address: '40 Tràng Thi, Hoàn Kiếm', city: 'Hà Nội', type: HospitalType.public, imgURL: '', description: 'Bệnh viện ngoại khoa và chấn thương chỉnh hình hàng đầu.' },
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

// ─── Identifiers để clear ────────────────────────────────────────────────────

const adminEmail = 'admin@tktbookingcare.vn';
const doctorEmails = doctorSeeds.map(([email]) => email);
const doctorSlugs = doctorSeeds.map(([, , , slug]) => slug);
const licenseNumbers = doctorSeeds.map(([, , , , licenseNumber]) => licenseNumber);
const specialtySlugs = specialties.map((s) => s.slug);
const hospitalSlugs = hospitals.map((h) => h.slug);

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function hash(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// ─── Clear ───────────────────────────────────────────────────────────────────

async function clearData() {
  const allEmails = [adminEmail, ...doctorEmails];

  const users = await prisma.user.findMany({
    where: { email: { in: allEmails } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  const doctors = await prisma.doctor.findMany({
    where: {
      OR: [
        { userId: { in: userIds } },
        { slug: { in: [...doctorSlugs] } },
        { licenseNumber: { in: [...licenseNumbers] } },
      ],
    },
    select: { id: true },
  });
  const doctorIds = doctors.map((d) => d.id);

  const hospitalRecords = await prisma.hospital.findMany({
    where: { slug: { in: [...hospitalSlugs] } },
    select: { id: true },
  });
  const hospitalIds = hospitalRecords.map((h) => h.id);

  const specialtyRecords = await prisma.specialty.findMany({
    where: { slug: { in: [...specialtySlugs] } },
    select: { id: true },
  });
  const specialtyIds = specialtyRecords.map((s) => s.id);

  // Xóa theo thứ tự quan hệ
  await prisma.doctorHospital.deleteMany({
    where: { OR: [{ doctorId: { in: doctorIds } }, { hospitalId: { in: hospitalIds } }] },
  });
  await prisma.doctorSpecialty.deleteMany({
    where: { OR: [{ doctorId: { in: doctorIds } }, { specialtyId: { in: specialtyIds } }] },
  });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.doctor.deleteMany({ where: { id: { in: doctorIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.hospital.deleteMany({ where: { id: { in: hospitalIds } } });
  await prisma.specialty.deleteMany({ where: { id: { in: specialtyIds } } });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Bắt đầu seed tối giản...');

  await clearData();
  console.log('Đã xóa dữ liệu cũ.');

  const [adminHash, doctorHash] = await Promise.all([hash(ADMIN_PASSWORD), hash(DOCTOR_PASSWORD)]);

  // Specialties
  await prisma.specialty.createMany({
    data: specialties.map((s) => ({ ...s, isActive: true })),
  });
  const createdSpecialties = await prisma.specialty.findMany({
    where: { slug: { in: [...specialtySlugs] } },
  });
  const specialtyBySlug = new Map(createdSpecialties.map((s) => [s.slug, s]));

  // Hospitals
  await prisma.hospital.createMany({
    data: hospitals.map((h) => ({ ...h, isActive: true })),
  });
  const createdHospitals = await prisma.hospital.findMany({
    where: { slug: { in: [...hospitalSlugs] } },
  });
  const hospitalBySlug = new Map(createdHospitals.map((h) => [h.slug, h]));

  // Admin
  await prisma.user.create({
    data: {
      email: adminEmail,
      password: adminHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: UserRole.admin,
      provider: AuthProvider.local,
      isActive: true,
      isEmailVerified: true,
    },
  });

  // Doctors
  const doctors: Doctor[] = [];
  for (let i = 0; i < doctorSeeds.length; i++) {
    const [email, firstName, lastName, slug, licenseNumber, experience, consultationFee] = doctorSeeds[i];
    const specialty = specialties[i];

    const user = await prisma.user.create({
      data: {
        email,
        password: doctorHash,
        firstName,
        lastName,
        role: UserRole.doctor,
        provider: AuthProvider.local,
        isActive: true,
        isEmailVerified: true,
      },
    });

    doctors.push(
      await prisma.doctor.create({
        data: {
          userId: user.id,
          slug,
          imgURL: '',
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

  // DoctorSpecialty + DoctorHospital
  for (let i = 0; i < doctors.length; i++) {
    const specialty = specialtyBySlug.get(specialtySlugs[i]);
    const hospital = hospitalBySlug.get(hospitalSlugs[i]);

    if (!specialty || !hospital) {
      throw new Error(`Không tìm thấy specialty/hospital tại index ${i}`);
    }

    await prisma.doctorSpecialty.create({
      data: { doctorId: doctors[i].id, specialtyId: specialty.id, isPrimary: true },
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

  // Summary
  const [uCount, spCount, hCount, dCount] = await Promise.all([
    prisma.user.count({ where: { email: { in: [adminEmail, ...doctorEmails] } } }),
    prisma.specialty.count({ where: { slug: { in: [...specialtySlugs] } } }),
    prisma.hospital.count({ where: { slug: { in: [...hospitalSlugs] } } }),
    prisma.doctor.count({ where: { slug: { in: [...doctorSlugs] } } }),
  ]);

  console.log('\nSeed tối giản hoàn tất.');
  console.table({ User: uCount, Specialty: spCount, Hospital: hCount, Doctor: dCount });

  console.log('\nTài khoản demo:');
  console.log(`Admin  : ${adminEmail} / ${ADMIN_PASSWORD}`);
  console.log(`Doctor : ${doctorSeeds[0][0]} / ${DOCTOR_PASSWORD}`);
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