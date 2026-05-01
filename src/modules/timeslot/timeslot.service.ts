import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  GenerateTimeSlotsDto,
  BlockTimeSlotDto,
  QueryTimeSlotsDto,
  AdminQueryTimeSlotsDto,
  DayOfWeek,
} from './dto/timeslot.dto';

// Map DayOfWeek enum → getDay() index (0=Sun, 1=Mon, ...)
const DAY_OF_WEEK_INDEX: Record<DayOfWeek, number> = {
  [DayOfWeek.SUN]: 0,
  [DayOfWeek.MON]: 1,
  [DayOfWeek.TUE]: 2,
  [DayOfWeek.WED]: 3,
  [DayOfWeek.THU]: 4,
  [DayOfWeek.FRI]: 5,
  [DayOfWeek.SAT]: 6,
};

@Injectable()
export class TimeSlotService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ───────────────────────────────────────────────

  /**
   * Parse "HH:mm" → tổng số phút tính từ 00:00.
   * VD: "08:30" → 510
   */
  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  /**
   * Tổng số phút → "HH:mm".
   * VD: 510 → "08:30"
   */
  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /**
   * Parse date string "YYYY-MM-DD" → Date object (UTC 00:00:00).
   */
  private parseDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  /**
   * Validate doctor + hospital tồn tại và đang active.
   * Kiểm tra thêm bác sĩ có làm việc tại hospital đó không.
   */
  private async validateDoctorHospital(
    doctorId: string,
    hospitalId: string,
  ): Promise<void> {
    const [doctor, hospital, link] = await Promise.all([
      this.prisma.doctor.findUnique({
        where: { id: doctorId },
        select: { id: true, isActive: true, isVerified: true },
      }),
      this.prisma.hospital.findUnique({
        where: { id: hospitalId },
        select: { id: true, isActive: true },
      }),
      this.prisma.doctorHospital.findUnique({
        where: { doctorId_hospitalId: { doctorId, hospitalId } },
        select: { id: true, isActive: true },
      }),
    ]);

    if (!doctor || !doctor.isActive || !doctor.isVerified) {
      throw new NotFoundException('Bác sĩ không tồn tại hoặc chưa được duyệt');
    }
    if (!hospital || !hospital.isActive) {
      throw new NotFoundException('Bệnh viện không tồn tại hoặc không hoạt động');
    }
    if (!link || !link.isActive) {
      throw new BadRequestException('Bác sĩ này không làm việc tại bệnh viện đó');
    }
  }

  private getPagination(page = 1, limit = 50) {
    return { take: limit, skip: (page - 1) * limit };
  }

  // ─── Public APIs ───────────────────────────────────────────

  /**
   * GET /timeslots?doctorId=&date=&hospitalId=
   * Trả về các slot còn trống (isBooked=false, isBlocked=false)
   * của bác sĩ trong 1 ngày cụ thể hoặc 7 ngày tới.
   * Group theo ngày để frontend dễ hiển thị.
   */
  async findAvailable(query: QueryTimeSlotsDto) {
    const { doctorId, date, hospitalId } = query;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let dateFilter: object;

    if (date) {
      const targetDate = this.parseDate(date);
      if (targetDate < today) {
        throw new BadRequestException('Không thể xem slot của ngày đã qua');
      }
      dateFilter = { equals: targetDate };
    } else {
      // Mặc định: 7 ngày tới
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      dateFilter = { gte: today, lte: nextWeek };
    }

    const slots = await this.prisma.timeSlot.findMany({
      where: {
        doctorId,
        isBooked: false,
        isBlocked: false,
        date: dateFilter,
        ...(hospitalId && { hospitalId }),
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        hospitalId: true,
        hospital: {
          select: { id: true, name: true, slug: true, city: true },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    // Group theo ngày để frontend hiển thị lịch dạng calendar
    const grouped = slots.reduce<Record<string, typeof slots>>((acc, slot) => {
      const key = slot.date.toISOString().split('T')[0]; // "YYYY-MM-DD"
      if (!acc[key]) acc[key] = [];
      acc[key].push(slot);
      return acc;
    }, {});

    return {
      doctorId,
      dates: Object.entries(grouped).map(([date, slots]) => ({
        date,
        slots,
      })),
    };
  }

  // ─── Admin APIs ────────────────────────────────────────────

  /**
   * GET /admin/timeslots?doctorId=&hospitalId=&fromDate=&toDate=&isBooked=&isBlocked=
   * Admin xem tất cả slots — có thể filter đa chiều.
   */
  async adminFindAll(query: AdminQueryTimeSlotsDto) {
    const {
      doctorId, hospitalId, date,
      fromDate, toDate, isBooked, isBlocked,
      page, limit,
    } = query;
    const { take, skip } = this.getPagination(page, limit);

    // Xây dựng date filter
    let dateFilter: object | undefined;
    if (date) {
      dateFilter = { equals: this.parseDate(date) };
    } else if (fromDate || toDate) {
      dateFilter = {
        ...(fromDate && { gte: this.parseDate(fromDate) }),
        ...(toDate && { lte: this.parseDate(toDate) }),
      };
    }

    const where = {
      ...(doctorId && { doctorId }),
      ...(hospitalId && { hospitalId }),
      ...(dateFilter && { date: dateFilter }),
      ...(isBooked !== undefined && { isBooked }),
      ...(isBlocked !== undefined && { isBlocked }),
    };

    const [data, total] = await Promise.all([
      this.prisma.timeSlot.findMany({
        where,
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          isBooked: true,
          isBlocked: true,
          doctor: {
            select: {
              id: true,
              slug: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
          hospital: {
            select: { id: true, name: true, city: true },
          },
          appointment: {
            select: {
              id: true,
              status: true,
              patientProfile: { select: { fullName: true } },
            },
          },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        take,
        skip,
      }),
      this.prisma.timeSlot.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: page ?? 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * POST /admin/timeslots/generate
   * Sinh hàng loạt TimeSlots theo template lặp lại.
   *
   * Logic:
   *  1. Validate input (date range, time range, doctor-hospital link)
   *  2. Tính danh sách tất cả (date, startTime) cần tạo
   *  3. Dùng createMany + skipDuplicates để bỏ qua slot đã tồn tại
   *  4. Trả về số lượng slot đã tạo thực sự
   */
  async generate(dto: GenerateTimeSlotsDto) {
    const {
      doctorId, hospitalId,
      startDate: startDateStr, endDate: endDateStr,
      dayOfWeek, startTime, endTime,
      durationMinutes = 30,
      breakStart, breakEnd,
    } = dto;

    // ── Validate ────────────────────────────────────────────

    await this.validateDoctorHospital(doctorId, hospitalId);

    const startDate = this.parseDate(startDateStr);
    const endDate = this.parseDate(endDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate < today) {
      throw new BadRequestException('startDate không được là ngày trong quá khứ');
    }
    if (endDate < startDate) {
      throw new BadRequestException('endDate phải sau hoặc bằng startDate');
    }

    // Giới hạn 90 ngày để tránh generate quá nhiều
    const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 90) {
      throw new BadRequestException('Khoảng thời gian tối đa là 90 ngày');
    }

    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    if (endMinutes <= startMinutes) {
      throw new BadRequestException('endTime phải sau startTime');
    }
    if (endMinutes - startMinutes < durationMinutes) {
      throw new BadRequestException(
        `Khoảng thời gian làm việc phải đủ ít nhất ${durationMinutes} phút`,
      );
    }

    const breakStartMin = breakStart ? this.timeToMinutes(breakStart) : null;
    const breakEndMin = breakEnd ? this.timeToMinutes(breakEnd) : null;

    // Validate break time
    if (breakStartMin !== null && breakEndMin !== null) {
      if (breakEndMin <= breakStartMin) {
        throw new BadRequestException('breakEnd phải sau breakStart');
      }
    }

    // ── Tính danh sách slots ────────────────────────────────

    const dayIndexSet = new Set(dayOfWeek.map((d) => DAY_OF_WEEK_INDEX[d]));
    const slotsToCreate: {
      doctorId: string;
      hospitalId: string;
      date: Date;
      startTime: string;
      endTime: string;
    }[] = [];

    // Lặp qua từng ngày trong khoảng
    const current = new Date(startDate);
    while (current <= endDate) {
      // Chỉ xử lý ngày nằm trong dayOfWeek đã chọn
      if (dayIndexSet.has(current.getDay())) {
        // Lặp qua các slot trong ngày
        let slotStart = startMinutes;
        while (slotStart + durationMinutes <= endMinutes) {
          const slotEnd = slotStart + durationMinutes;

          // Bỏ qua slot nằm trong giờ nghỉ
          const inBreak =
            breakStartMin !== null &&
            breakEndMin !== null &&
            slotStart < breakEndMin &&
            slotEnd > breakStartMin;

          if (!inBreak) {
            slotsToCreate.push({
              doctorId,
              hospitalId,
              date: new Date(current), // clone để tránh mutate
              startTime: this.minutesToTime(slotStart),
              endTime: this.minutesToTime(slotEnd),
            });
          }

          slotStart += durationMinutes;
        }
      }

      // Tăng ngày lên 1
      current.setUTCDate(current.getUTCDate() + 1);
    }

    if (slotsToCreate.length === 0) {
      throw new BadRequestException(
        'Không có slot nào được sinh ra. Kiểm tra lại dayOfWeek và khoảng thời gian.',
      );
    }

    // Giới hạn tối đa 500 slots / 1 lần generate để tránh timeout
    if (slotsToCreate.length > 500) {
      throw new BadRequestException(
        `Số lượng slot sinh ra (${slotsToCreate.length}) vượt quá giới hạn 500/lần. Hãy rút ngắn khoảng thời gian hoặc tăng durationMinutes.`,
      );
    }

    // ── Tạo slots — skipDuplicates bỏ qua slot đã tồn tại ──

    const result = await this.prisma.timeSlot.createMany({
      data: slotsToCreate,
      skipDuplicates: true,
    });

    return {
      requested: slotsToCreate.length,
      created: result.count,
      skipped: slotsToCreate.length - result.count,
      message: `Đã tạo ${result.count} slot (bỏ qua ${slotsToCreate.length - result.count} slot đã tồn tại)`,
    };
  }

  /**
   * PATCH /admin/timeslots/:id/block
   * Admin chặn hoặc mở khóa 1 slot cụ thể.
   * Không cho block slot đã có appointment đang active.
   */
  async setBlock(id: string, dto: BlockTimeSlotDto) {
    const slot = await this.findById(id);

    // Nếu đang muốn block nhưng slot đã được đặt
    if (dto.isBlocked && slot.isBooked) {
      throw new ConflictException(
        'Không thể khóa slot này vì đã có lịch hẹn. Hủy lịch hẹn trước.',
      );
    }

    return this.prisma.timeSlot.update({
      where: { id },
      data: { isBlocked: dto.isBlocked },
    });
  }

  /**
   * DELETE /admin/timeslots/:id
   * Xóa cứng 1 slot — chỉ cho phép nếu slot chưa được đặt.
   */
  async remove(id: string) {
    const slot = await this.findById(id);

    if (slot.isBooked) {
      throw new ConflictException(
        'Không thể xóa slot đã có lịch hẹn. Hủy lịch hẹn trước.',
      );
    }

    await this.prisma.timeSlot.delete({ where: { id } });
    return { id, deleted: true };
  }

  /**
   * DELETE /admin/timeslots/bulk-delete
   * Xóa hàng loạt slots chưa được đặt trong 1 khoảng thời gian.
   * Dùng khi cần "reset" lịch của 1 bác sĩ.
   */
  async bulkRemove(dto: {
    doctorId: string;
    hospitalId?: string;
    fromDate: string;
    toDate: string;
  }) {
    const { doctorId, hospitalId, fromDate, toDate } = dto;

    const from = this.parseDate(fromDate);
    const to = this.parseDate(toDate);

    if (to < from) {
      throw new BadRequestException('toDate phải sau hoặc bằng fromDate');
    }

    const result = await this.prisma.timeSlot.deleteMany({
      where: {
        doctorId,
        ...(hospitalId && { hospitalId }),
        date: { gte: from, lte: to },
        isBooked: false, // KHÔNG xóa slot đã có lịch
      },
    });

    return {
      deleted: result.count,
      message: `Đã xóa ${result.count} slot chưa được đặt`,
    };
  }

  // ─── Doctor-self APIs ──────────────────────────────────────

  /**
   * GET /doctors/me/schedule
   * Trả về lịch làm việc cố định của bác sĩ (từ DoctorHospital).
   * Đây là thông tin macro: làm ở đâu, ngày nào, giờ nào.
   */
  async getDoctorSchedule(userId: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId },
      select: {
        id: true,
        slug: true,
        hospitals: {
          where: { isActive: true },
          select: {
            id: true,
            workingDays: true,
            startTime: true,
            endTime: true,
            hospital: {
              select: {
                id: true,
                name: true,
                slug: true,
                address: true,
                city: true,
              },
            },
          },
        },
      },
    });

    if (!doctor) {
      throw new NotFoundException('Không tìm thấy hồ sơ bác sĩ');
    }

    return doctor;
  }

  /**
   * GET /doctors/me/timeslots
   * Bác sĩ xem tất cả slot của mình — kể cả đã đặt, đã khóa.
   * Dùng AdminQueryTimeSlotsDto nhưng tự động filter theo doctorId của mình.
   */
  async getDoctorSlots(userId: string, query: AdminQueryTimeSlotsDto) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!doctor) {
      throw new NotFoundException('Không tìm thấy hồ sơ bác sĩ');
    }

    // Gọi lại adminFindAll nhưng lock doctorId = bác sĩ hiện tại
    return this.adminFindAll({ ...query, doctorId: doctor.id });
  }

  /**
   * PATCH /doctors/me/timeslots/:id/block
   * Bác sĩ tự khóa/mở 1 slot của mình.
   * Ownership check: slot phải thuộc về bác sĩ này.
   */
  async doctorSetBlock(userId: string, slotId: string, dto: BlockTimeSlotDto) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!doctor) {
      throw new NotFoundException('Không tìm thấy hồ sơ bác sĩ');
    }

    const slot = await this.findById(slotId);

    // Ownership check — bác sĩ chỉ được thao tác slot của mình
    if (slot.doctorId !== doctor.id) {
      throw new BadRequestException('Bạn không có quyền thao tác slot này');
    }

    if (dto.isBlocked && slot.isBooked) {
      throw new ConflictException(
        'Không thể khóa slot đã có lịch hẹn. Liên hệ admin để hủy lịch trước.',
      );
    }

    return this.prisma.timeSlot.update({
      where: { id: slotId },
      data: { isBlocked: dto.isBlocked },
    });
  }

  // ─── Internal helpers ──────────────────────────────────────

  async findById(id: string) {
    const slot = await this.prisma.timeSlot.findUnique({
      where: { id },
      include: { appointment: { select: { id: true, status: true } } },
    });
    if (!slot) {
      throw new NotFoundException(`Không tìm thấy time slot với id "${id}"`);
    }
    return slot;
  }
}
