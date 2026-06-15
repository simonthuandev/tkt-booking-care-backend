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
  {
    name: 'Đa khoa',
    slug: 'da-khoa',
    description:
      'Chuyên khoa Đa khoa (Nội tổng quát) thực hiện khám sàng lọc ban đầu, đánh giá toàn diện các triệu chứng chưa rõ nguyên nhân, đo các chỉ số sinh tồn (huyết áp, nhịp tim, nhiệt độ, SpO2), khai thác bệnh sử và tiền sử bệnh, từ đó định hướng chẩn đoán sơ bộ và tư vấn chuyển đến chuyên khoa sâu phù hợp. Đây là cửa ngõ đầu tiên giúp người bệnh được phân loại và xử trí kịp thời, đặc biệt hữu ích khi chưa xác định rõ nguyên nhân bệnh lý thuộc nhóm cơ quan nào.',
    imgURL: '',
    diseases: [
      'Sốt chưa rõ nguyên nhân',
      'Mệt mỏi kéo dài, suy nhược cơ thể',
      'Đau nhức toàn thân, đau cơ xương khớp không đặc hiệu',
      'Cảm cúm, cảm lạnh thông thường',
      'Rối loạn tiêu hóa nhẹ (đầy bụng, khó tiêu)',
      'Chóng mặt, hoa mắt',
      'Sụt cân không rõ nguyên nhân',
      'Mất ngủ, rối loạn giấc ngủ nhẹ',
      'Đau đầu thông thường',
      'Triệu chứng chưa rõ nguyên nhân cần định hướng chuyên khoa',
    ],
    information: [
      'Khám tổng quát, đo các chỉ số sinh tồn (huyết áp, nhịp tim, nhiệt độ, cân nặng, BMI)',
      'Khai thác bệnh sử, tiền sử bệnh và tiền sử dùng thuốc',
      'Chỉ định các xét nghiệm cơ bản: công thức máu, đường huyết, chức năng gan thận',
      'Đánh giá triệu chứng và đưa ra chẩn đoán sơ bộ',
      'Tư vấn chuyển chuyên khoa phù hợp khi phát hiện dấu hiệu cần khám sâu',
      'Khám sức khỏe định kỳ, khám sức khỏe tổng quát',
    ],
  },
  {
    name: 'Tim mạch',
    slug: 'tim-mach',
    description:
      'Chuyên khoa Tim mạch chuyên chẩn đoán, điều trị và theo dõi các bệnh lý liên quan đến tim và hệ mạch máu, bao gồm bệnh mạch vành, suy tim, rối loạn nhịp tim, tăng huyết áp, bệnh van tim và các bệnh tim mạch chuyển hóa. Bác sĩ sử dụng các phương tiện cận lâm sàng như điện tâm đồ (ECG), siêu âm tim (echocardiography), holter điện tâm đồ, nghiệm pháp gắng sức và xét nghiệm men tim để đánh giá chức năng và cấu trúc tim, từ đó xây dựng phác đồ điều trị nội khoa hoặc can thiệp phù hợp, đồng thời tư vấn các biện pháp phòng ngừa biến cố tim mạch.',
    imgURL: '',
    diseases: [
      'Tăng huyết áp',
      'Suy tim',
      'Rối loạn nhịp tim (rung nhĩ, ngoại tâm thu, nhịp nhanh trên thất)',
      'Bệnh mạch vành, thiếu máu cơ tim',
      'Nhồi máu cơ tim',
      'Bệnh van tim (hẹp/hở van hai lá, van động mạch chủ)',
      'Bệnh cơ tim (giãn, phì đại, hạn chế)',
      'Rối loạn lipid máu (mỡ máu cao)',
      'Đau thắt ngực',
      'Bệnh tim bẩm sinh ở người lớn',
      'Viêm màng ngoài tim, viêm cơ tim',
      'Tăng áp động mạch phổi',
    ],
    information: [
      'Đo điện tâm đồ (ECG) đánh giá nhịp và hoạt động điện của tim',
      'Siêu âm tim (Doppler tim) đánh giá cấu trúc và chức năng tim',
      'Holter điện tâm đồ 24 giờ theo dõi rối loạn nhịp',
      'Nghiệm pháp gắng sức (Treadmill test) đánh giá thiếu máu cơ tim',
      'Xét nghiệm men tim, mỡ máu, đường huyết liên quan tim mạch',
      'Theo dõi và điều chỉnh thuốc điều trị huyết áp, suy tim, rối loạn nhịp',
      'Tư vấn phòng ngừa bệnh tim mạch: chế độ ăn, vận động, kiểm soát yếu tố nguy cơ',
    ],
  },
  {
    name: 'Nhi khoa',
    slug: 'nhi-khoa',
    description:
      'Chuyên khoa Nhi chăm sóc sức khỏe toàn diện cho trẻ em từ sơ sinh đến 16 tuổi, bao gồm khám và điều trị các bệnh lý nhiễm trùng đường hô hấp, tiêu hóa, da liễu, dị ứng, theo dõi sự phát triển thể chất - tinh thần - vận động theo từng giai đoạn, tư vấn tiêm chủng theo lịch quốc gia và mở rộng, cùng hướng dẫn dinh dưỡng phù hợp với lứa tuổi. Bác sĩ Nhi khoa cần đánh giá cẩn trọng các dấu hiệu sinh tồn và triệu chứng đặc thù ở trẻ nhỏ, vì biểu hiện bệnh ở trẻ thường khác biệt và diễn biến nhanh hơn so với người lớn.',
    imgURL: '',
    diseases: [
      'Sốt virus, sốt phát ban',
      'Viêm phế quản, viêm tiểu phế quản',
      'Viêm phổi ở trẻ em',
      'Tiêu chảy, rối loạn tiêu hóa cấp ở trẻ',
      'Tay chân miệng',
      'Sốt xuất huyết ở trẻ em',
      'Viêm họng, viêm amidan ở trẻ',
      'Hen suyễn ở trẻ em',
      'Dị ứng, mề đay ở trẻ',
      'Suy dinh dưỡng, chậm tăng cân',
      'Thiếu máu do thiếu sắt ở trẻ',
      'Rối loạn giấc ngủ, quấy khóc ở trẻ sơ sinh',
    ],
    information: [
      'Khám tổng quát và theo dõi tăng trưởng (chiều cao, cân nặng, vòng đầu) theo biểu đồ chuẩn',
      'Tư vấn và thực hiện tiêm chủng theo lịch tiêm chủng quốc gia và mở rộng',
      'Hướng dẫn dinh dưỡng cho trẻ theo từng giai đoạn (bú mẹ, ăn dặm, ăn cơm)',
      'Chẩn đoán và điều trị các bệnh nhiễm trùng đường hô hấp, tiêu hóa thường gặp',
      'Tư vấn xử trí sốt, ho, tiêu chảy tại nhà và dấu hiệu cần nhập viện',
      'Đánh giá phát triển tâm thần - vận động theo độ tuổi',
      'Khám sức khỏe định kỳ cho trẻ trước khi đi học',
    ],
  },
  {
    name: 'Da liễu',
    slug: 'da-lieu',
    description:
      'Chuyên khoa Da liễu chẩn đoán và điều trị các bệnh lý về da, tóc, móng và niêm mạc, bao gồm các bệnh da viêm mạn tính, bệnh da do nhiễm khuẩn/nấm/virus, bệnh da tự miễn, các vấn đề về sắc tố da và lão hóa da. Bác sĩ sử dụng các kỹ thuật soi da (dermoscopy), test áp bì (patch test), sinh thiết da khi cần thiết để xác định chẩn đoán chính xác, từ đó xây dựng phác đồ điều trị bằng thuốc bôi, thuốc uống, hoặc các thủ thuật da liễu như laser, áp lạnh, đốt điện, đồng thời tư vấn chăm sóc da phù hợp với từng loại da và tình trạng bệnh lý.',
    imgURL: '',
    diseases: [
      'Mụn trứng cá (mụn viêm, mụn bọc, mụn đầu đen/trắng)',
      'Viêm da cơ địa (chàm)',
      'Viêm da tiếp xúc',
      'Nấm da, lác đồng tiền, nấm móng',
      'Vảy nến',
      'Mề đay, mẩn ngứa dị ứng',
      'Rụng tóc, hói đầu',
      'Nám da, tàn nhang, rối loạn sắc tố',
      'Mụn cóc, mụn cơm',
      'Zona thần kinh (giời leo)',
      'Viêm nang lông',
      'Bệnh ghẻ, chấy rận',
      'Sẹo lồi, sẹo rỗ',
    ],
    information: [
      'Soi da (dermoscopy) đánh giá tổn thương da, nốt ruồi, sắc tố',
      'Điều trị mụn trứng cá: thuốc bôi, thuốc uống, lấy nhân mụn y khoa',
      'Test áp bì (patch test) xác định nguyên nhân dị ứng tiếp xúc',
      'Sinh thiết da khi nghi ngờ bệnh lý ác tính hoặc cần chẩn đoán mô bệnh học',
      'Điều trị bằng laser, áp lạnh, đốt điện cho các tổn thương da lành tính',
      'Chăm sóc da nhạy cảm, da mụn, da lão hóa',
      'Tư vấn liệu trình điều trị nám, tàn nhang, sẹo theo từng cơ địa',
    ],
  },
  {
    name: 'Tai mũi họng',
    slug: 'tai-mui-hong',
    description:
      'Chuyên khoa Tai Mũi Họng (TMH) khám và điều trị các bệnh lý vùng tai, mũi, họng, xoang, thanh quản và các cấu trúc liên quan vùng đầu cổ. Bác sĩ sử dụng nội soi tai mũi họng để quan sát trực tiếp niêm mạc, dịch tiết, tình trạng viêm nhiễm hoặc tổn thương, kết hợp đo thính lực, nội soi thanh quản khi cần để đánh giá chức năng nghe, nói và nuốt. Chuyên khoa này điều trị từ các bệnh lý viêm nhiễm thông thường đến tư vấn chỉ định phẫu thuật đối với các trường hợp viêm xoang mạn tính, viêm amidan tái phát hoặc polyp mũi.',
    imgURL: '',
    diseases: [
      'Viêm xoang (cấp và mạn tính)',
      'Viêm amidan',
      'Ù tai, nghe kém',
      'Viêm tai giữa',
      'Viêm họng, viêm thanh quản',
      'Viêm mũi dị ứng',
      'Polyp mũi',
      'Lệch vách ngăn mũi',
      'Chóng mặt do rối loạn tiền đình tai trong',
      'Viêm tai ngoài',
      'Khàn tiếng, rối loạn giọng nói',
      'Dị vật tai mũi họng',
    ],
    information: [
      'Nội soi tai mũi họng đánh giá niêm mạc, dịch tiết, tổn thương',
      'Tầm soát và điều trị viêm xoang cấp/mạn tính',
      'Đo thính lực, đánh giá chức năng nghe',
      'Nội soi thanh quản đánh giá dây thanh và chức năng phát âm',
      'Hút rửa mũi, xoang, lấy dị vật tai mũi họng',
      'Tư vấn điều trị nội khoa hoặc chỉ định phẫu thuật (cắt amidan, nạo VA, mổ xoang nội soi)',
      'Điều trị viêm mũi dị ứng theo mùa và mạn tính',
    ],
  },
  {
    name: 'Cơ xương khớp',
    slug: 'co-xuong-khop',
    description:
      'Chuyên khoa Cơ xương khớp (Chấn thương chỉnh hình - Cơ xương khớp) chẩn đoán và điều trị các bệnh lý và chấn thương liên quan đến hệ vận động, bao gồm xương, khớp, cơ, gân, dây chằng và sụn khớp. Bác sĩ thực hiện khám lâm sàng vận động, chỉ định chụp X-quang, MRI, siêu âm khớp để đánh giá mức độ tổn thương, từ đó xây dựng phác đồ điều trị bảo tồn (thuốc, vật lý trị liệu, tiêm khớp) hoặc tư vấn can thiệp ngoại khoa khi cần. Chuyên khoa này đặc biệt quan trọng với người cao tuổi (thoái hóa khớp), người lao động nặng và vận động viên (chấn thương thể thao).',
    imgURL: '',
    diseases: [
      'Thoái hóa khớp (gối, háng, cột sống)',
      'Đau lưng, đau thần kinh tọa',
      'Viêm khớp dạng thấp',
      'Gout (bệnh gút)',
      'Thoát vị đĩa đệm',
      'Đau vai gáy, viêm quanh khớp vai',
      'Loãng xương',
      'Viêm gân, viêm bao hoạt dịch',
      'Chấn thương dây chằng, bong gân',
      'Gãy xương',
      'Hội chứng ống cổ tay',
      'Viêm cột sống dính khớp',
    ],
    information: [
      'Khám lâm sàng đánh giá tầm vận động khớp và mức độ đau',
      'Chỉ định chụp X-quang, MRI, siêu âm khớp đánh giá tổn thương xương khớp, mô mềm',
      'Tiêm khớp (corticosteroid, acid hyaluronic) điều trị thoái hóa khớp',
      'Vật lý trị liệu - phục hồi chức năng sau chấn thương hoặc phẫu thuật',
      'Tư vấn điều trị nội khoa các bệnh khớp mạn tính (gout, viêm khớp dạng thấp)',
      'Đo loãng xương (đo mật độ xương DXA) và tư vấn điều trị',
      'Tư vấn chỉ định phẫu thuật chấn thương chỉnh hình khi cần thiết',
    ],
  },
  {
    name: 'Sản phụ khoa',
    slug: 'san-phu-khoa',
    description:
      'Chuyên khoa Sản Phụ khoa chăm sóc sức khỏe sinh sản và sức khỏe phụ nữ trong suốt các giai đoạn cuộc đời, bao gồm khám phụ khoa định kỳ, theo dõi và quản lý thai kỳ, chăm sóc sau sinh, tầm soát các bệnh lý phụ khoa và ung thư cổ tử cung/vú, cùng tư vấn các vấn đề về nội tiết sinh sản, kế hoạch hóa gia đình và mãn kinh. Bác sĩ sử dụng siêu âm phụ khoa, siêu âm thai, xét nghiệm Pap smear, soi cổ tử cung để chẩn đoán và theo dõi, đảm bảo sức khỏe cho cả mẹ và thai nhi trong thai kỳ cũng như sức khỏe sinh sản lâu dài của phụ nữ.',
    imgURL: '',
    diseases: [
      'Rối loạn kinh nguyệt (kinh không đều, rong kinh, vô kinh)',
      'Viêm phụ khoa (viêm âm đạo, viêm cổ tử cung)',
      'Theo dõi và quản lý thai kỳ',
      'U xơ tử cung',
      'U nang buồng trứng',
      'Lạc nội mạc tử cung',
      'Hội chứng buồng trứng đa nang (PCOS)',
      'Viêm vùng chậu',
      'Sa sinh dục (sa tử cung, sa bàng quang)',
      'Vô sinh, hiếm muộn',
      'Mãn kinh và các rối loạn liên quan',
      'Tầm soát ung thư cổ tử cung, ung thư vú',
    ],
    information: [
      'Khám phụ khoa định kỳ và tầm soát các bệnh lý phụ khoa',
      'Siêu âm thai theo dõi sự phát triển của thai nhi qua từng giai đoạn',
      'Xét nghiệm Pap smear, HPV tầm soát ung thư cổ tử cung',
      'Soi cổ tử cung khi phát hiện bất thường tế bào học',
      'Tư vấn tiền sản, dinh dưỡng và chăm sóc thai kỳ',
      'Tư vấn kế hoạch hóa gia đình và các biện pháp tránh thai',
      'Khám và điều trị các bệnh viêm nhiễm phụ khoa thường gặp',
      'Tư vấn các vấn đề mãn kinh, nội tiết sinh sản',
    ],
  },
  {
    name: 'Tiêu hóa',
    slug: 'tieu-hoa',
    description:
      'Chuyên khoa Tiêu hóa - Gan mật chẩn đoán và điều trị các bệnh lý của đường tiêu hóa (thực quản, dạ dày, ruột non, đại tràng) và các cơ quan tiêu hóa phụ trợ (gan, mật, tụy). Bác sĩ sử dụng nội soi tiêu hóa (nội soi dạ dày, nội soi đại tràng) để quan sát trực tiếp niêm mạc đường tiêu hóa, phát hiện viêm loét, polyp hoặc tổn thương nghi ngờ ác tính, kết hợp xét nghiệm chức năng gan, siêu âm bụng để đánh giá toàn diện. Chuyên khoa này đóng vai trò quan trọng trong tầm soát ung thư đường tiêu hóa và quản lý các bệnh lý gan mật mạn tính.',
    imgURL: '',
    diseases: [
      'Đau dạ dày, viêm loét dạ dày - tá tràng',
      'Trào ngược dạ dày thực quản (GERD)',
      'Viêm đại tràng',
      'Hội chứng ruột kích thích',
      'Nhiễm vi khuẩn Helicobacter pylori (HP)',
      'Viêm gan virus (B, C)',
      'Gan nhiễm mỡ',
      'Sỏi mật, viêm túi mật',
      'Viêm tụy',
      'Polyp đại tràng, polyp dạ dày',
      'Táo bón mạn tính',
      'Xuất huyết tiêu hóa',
    ],
    information: [
      'Nội soi dạ dày - thực quản chẩn đoán viêm loét, trào ngược, nhiễm HP',
      'Nội soi đại tràng tầm soát polyp và ung thư đại trực tràng',
      'Xét nghiệm chức năng gan, men gan, viêm gan virus',
      'Siêu âm bụng tổng quát đánh giá gan, mật, tụy, lách',
      'Test thở chẩn đoán vi khuẩn HP',
      'Tư vấn dinh dưỡng cho người bệnh tiêu hóa, gan mật',
      'Theo dõi và điều trị các bệnh lý gan mạn tính (viêm gan, gan nhiễm mỡ)',
    ],
  },
  {
    name: 'Mắt',
    slug: 'mat',
    description:
      'Chuyên khoa Mắt (Nhãn khoa) khám và điều trị các bệnh lý về thị lực và cấu trúc mắt, bao gồm các tật khúc xạ, bệnh lý kết mạc - giác mạc, bệnh lý đáy mắt, tăng nhãn áp và đục thủy tinh thể. Bác sĩ sử dụng các thiết bị đo khúc xạ, đo nhãn áp, soi đáy mắt bằng máy chuyên dụng để đánh giá toàn diện chức năng và cấu trúc mắt, từ đó tư vấn điều chỉnh kính, điều trị nội khoa hoặc chỉ định can thiệp phẫu thuật (phaco, laser) khi cần thiết. Khám mắt định kỳ giúp phát hiện sớm các bệnh lý có thể gây giảm hoặc mất thị lực nếu không điều trị kịp thời.',
    imgURL: '',
    diseases: [
      'Cận thị, viễn thị, loạn thị',
      'Khô mắt',
      'Đục thủy tinh thể',
      'Glôcôm (tăng nhãn áp/cườm nước)',
      'Viêm kết mạc (đau mắt đỏ)',
      'Viêm giác mạc',
      'Thoái hóa điểm vàng',
      'Bệnh võng mạc đái tháo đường',
      'Lác mắt, nhược thị (ở trẻ em)',
      'Viêm bờ mi',
      'Tật khúc xạ ở trẻ em',
      'Dị vật giác mạc, kết mạc',
    ],
    information: [
      'Đo khúc xạ xác định độ cận/viễn/loạn thị và kê đơn kính phù hợp',
      'Đo nhãn áp tầm soát bệnh glôcôm',
      'Soi đáy mắt đánh giá tình trạng võng mạc, dây thần kinh thị giác',
      'Khám và điều trị các bệnh viêm nhiễm mắt (viêm kết mạc, viêm giác mạc)',
      'Tư vấn và theo dõi điều trị đục thủy tinh thể, chỉ định phẫu thuật phaco khi cần',
      'Tầm soát biến chứng mắt ở người bệnh đái tháo đường, tăng huyết áp',
      'Tư vấn kính thuốc, kính áp tròng và chăm sóc mắt hàng ngày',
    ],
  },
  {
    name: 'Thần kinh',
    slug: 'than-kinh',
    description:
      'Chuyên khoa Thần kinh chẩn đoán và điều trị các bệnh lý của hệ thần kinh trung ương và ngoại biên, bao gồm não, tủy sống, dây thần kinh và cơ. Các bệnh lý thường gặp gồm đau đầu, đau nửa đầu (migraine), rối loạn giấc ngủ, rối loạn tiền đình, đột quỵ, động kinh và các bệnh thoái hóa thần kinh. Bác sĩ thực hiện khám thần kinh chi tiết (đánh giá phản xạ, vận động, cảm giác, thần kinh sọ não), kết hợp chỉ định chụp CT/MRI sọ não, điện não đồ (EEG) khi cần để xác định chẩn đoán và xây dựng kế hoạch điều trị, theo dõi dài hạn đối với các bệnh thần kinh mạn tính.',
    imgURL: '',
    diseases: [
      'Đau nửa đầu (migraine)',
      'Mất ngủ, rối loạn giấc ngủ',
      'Rối loạn tiền đình (chóng mặt do nguyên nhân thần kinh)',
      'Đau đầu căng cơ, đau đầu mạn tính',
      'Đột quỵ (tai biến mạch máu não)',
      'Động kinh',
      'Bệnh Parkinson',
      'Suy giảm trí nhớ, sa sút trí tuệ',
      'Đau thần kinh ngoại biên',
      'Liệt mặt (liệt Bell)',
      'Rối loạn lo âu liên quan triệu chứng thần kinh',
      'Hội chứng ống cổ tay (chèn ép thần kinh)',
    ],
    information: [
      'Khám thần kinh đánh giá phản xạ, vận động, cảm giác, thần kinh sọ não',
      'Chỉ định chụp CT/MRI sọ não chẩn đoán đột quỵ, u não, tổn thương cấu trúc',
      'Điện não đồ (EEG) chẩn đoán động kinh và các rối loạn điện não',
      'Đánh giá và tư vấn điều trị các rối loạn giấc ngủ',
      'Theo dõi điều trị dài hạn các bệnh thần kinh mạn tính (Parkinson, động kinh)',
      'Tư vấn phòng ngừa và xử trí cơn đau đầu mạn tính, đau nửa đầu',
      'Đánh giá nguy cơ và tư vấn phòng ngừa đột quỵ',
    ],
  },
  {
    name: 'Nội tiết',
    slug: 'noi-tiet',
    description:
      'Chuyên khoa Nội tiết - Đái tháo đường chẩn đoán và quản lý các bệnh lý liên quan đến hệ thống tuyến nội tiết và chuyển hóa, bao gồm đái tháo đường (tuýp 1, tuýp 2, đái tháo đường thai kỳ), các bệnh lý tuyến giáp (cường giáp, suy giáp, u tuyến giáp), rối loạn lipid máu, béo phì và các rối loạn nội tiết khác (tuyến yên, tuyến thượng thận). Bác sĩ theo dõi các chỉ số đường huyết, HbA1c, hormone tuyến giáp định kỳ, điều chỉnh phác đồ thuốc và tư vấn chế độ ăn - vận động phù hợp, nhằm kiểm soát bệnh ổn định và phòng ngừa các biến chứng mạn tính như biến chứng tim mạch, thận, mắt và thần kinh do đái tháo đường.',
    imgURL: '',
    diseases: [
      'Đái tháo đường tuýp 1 và tuýp 2',
      'Đái tháo đường thai kỳ',
      'Rối loạn tuyến giáp (cường giáp, suy giáp)',
      'U tuyến giáp, bướu cổ',
      'Béo phì, thừa cân',
      'Rối loạn lipid máu (mỡ máu cao)',
      'Hội chứng chuyển hóa',
      'Hạ đường huyết',
      'Suy tuyến thượng thận',
      'Loãng xương do nguyên nhân nội tiết',
      'Rối loạn hormone tuyến yên',
      'Biến chứng mạn tính của đái tháo đường (thần kinh, thận, mắt)',
    ],
    information: [
      'Theo dõi đường huyết, xét nghiệm HbA1c đánh giá kiểm soát đái tháo đường',
      'Xét nghiệm hormone tuyến giáp (TSH, FT3, FT4) chẩn đoán bệnh tuyến giáp',
      'Siêu âm tuyến giáp tầm soát nhân giáp, bướu cổ',
      'Tư vấn chế độ ăn, vận động phù hợp cho người bệnh đái tháo đường, béo phì',
      'Điều chỉnh phác đồ thuốc điều trị đái tháo đường, rối loạn tuyến giáp định kỳ',
      'Tầm soát và theo dõi các biến chứng mạn tính của đái tháo đường',
      'Tư vấn quản lý rối loạn lipid máu và hội chứng chuyển hóa',
    ],
  },
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
const primarySpecialties = specialties.filter((s) => s.slug !== 'da-khoa');
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
    const specialty = primarySpecialties[i];

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
    const primarySpecialty = primarySpecialties[i];
    const specialty = primarySpecialty
      ? specialtyBySlug.get(primarySpecialty.slug)
      : undefined;
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

  const generalSpecialty = specialtyBySlug.get('da-khoa');
  if (generalSpecialty && doctors[0]) {
    await prisma.doctorSpecialty.create({
      data: {
        doctorId: doctors[0].id,
        specialtyId: generalSpecialty.id,
        isPrimary: false,
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
