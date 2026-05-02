import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  Prisma,
  UserRole as PrismaUserRole,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  QueryAdminReportsDto,
  QueryAdminUsersDto,
  UpdateUserBanDto,
  UpdateUserRoleDto,
} from './dto/admin.dto';

const APPOINTMENT_ACTIVE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.pending,
  AppointmentStatus.confirmed,
  AppointmentStatus.processing,
];

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private getPagination(page = 1, limit = 20) {
    return { take: limit, skip: (page - 1) * limit };
  }

  private parseDateStart(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  }

  private parseDateEnd(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  }

  private toSlug(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private async generateUniqueDoctorSlug(
    firstName: string,
    lastName: string,
  ): Promise<string> {
    const baseSlug = this.toSlug(`${lastName} ${firstName}`) || 'doctor';
    let slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

    while (true) {
      const existing = await this.prisma.doctor.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existing) return slug;

      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    }
  }

  private async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        role: true,
        provider: true,
        isActive: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
        doctorProfile: {
          select: {
            id: true,
            slug: true,
            isActive: true,
            isVerified: true,
            licenseNumber: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Không tìm thấy user với id "${id}"`);
    }

    return user;
  }

  async getStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeUsers,
      usersByRole,
      totalDoctors,
      verifiedDoctors,
      activeDoctors,
      totalHospitals,
      activeHospitals,
      totalSpecialties,
      activeSpecialties,
      totalAppointments,
      todayAppointments,
      appointmentsByStatus,
      totalReviews,
      totalNews,
      publishedNews,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.groupBy({
        by: ['role'],
        _count: { _all: true },
      }),
      this.prisma.doctor.count(),
      this.prisma.doctor.count({ where: { isVerified: true } }),
      this.prisma.doctor.count({ where: { isActive: true } }),
      this.prisma.hospital.count(),
      this.prisma.hospital.count({ where: { isActive: true } }),
      this.prisma.specialty.count(),
      this.prisma.specialty.count({ where: { isActive: true } }),
      this.prisma.appointment.count(),
      this.prisma.appointment.count({
        where: { createdAt: { gte: todayStart } },
      }),
      this.prisma.appointment.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.review.count(),
      this.prisma.news.count(),
      this.prisma.news.count({ where: { isPublished: true } }),
    ]);

    const roleMap = usersByRole.reduce(
      (acc, item) => {
        acc[item.role] = item._count._all;
        return acc;
      },
      {} as Record<PrismaUserRole, number>,
    );

    const statusMap = appointmentsByStatus.reduce(
      (acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
      },
      {} as Record<AppointmentStatus, number>,
    );

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        byRole: {
          user: roleMap.user ?? 0,
          doctor: roleMap.doctor ?? 0,
          admin: roleMap.admin ?? 0,
        },
      },
      doctors: {
        total: totalDoctors,
        active: activeDoctors,
        verified: verifiedDoctors,
      },
      hospitals: {
        total: totalHospitals,
        active: activeHospitals,
      },
      specialties: {
        total: totalSpecialties,
        active: activeSpecialties,
      },
      appointments: {
        total: totalAppointments,
        today: todayAppointments,
        byStatus: {
          pending: statusMap.pending ?? 0,
          confirmed: statusMap.confirmed ?? 0,
          processing: statusMap.processing ?? 0,
          completed: statusMap.completed ?? 0,
          cancelled: statusMap.cancelled ?? 0,
          no_show: statusMap.no_show ?? 0,
        },
      },
      content: {
        reviews: totalReviews,
        news: {
          total: totalNews,
          published: publishedNews,
          draft: totalNews - publishedNews,
        },
      },
    };
  }

  async getReports(query: QueryAdminReportsDto) {
    const fromDate = this.parseDateStart(query.from);
    const toDate = this.parseDateEnd(query.to);

    if (fromDate > toDate) {
      throw new BadRequestException('from không được lớn hơn to');
    }

    const dateWhere: Prisma.DateTimeFilter = {
      gte: fromDate,
      lte: toDate,
    };

    const appointmentWhere: Prisma.AppointmentWhereInput = {
      createdAt: dateWhere,
    };

    const [
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      noShowAppointments,
      appointmentsByStatus,
      newUsers,
      newDoctors,
      newHospitals,
      newReviews,
      publishedNews,
      completedForRevenue,
      topDoctorsRaw,
      topHospitalsRaw,
      reportAppointments,
    ] = await Promise.all([
      this.prisma.appointment.count({ where: appointmentWhere }),
      this.prisma.appointment.count({
        where: { ...appointmentWhere, status: AppointmentStatus.completed },
      }),
      this.prisma.appointment.count({
        where: { ...appointmentWhere, status: AppointmentStatus.cancelled },
      }),
      this.prisma.appointment.count({
        where: { ...appointmentWhere, status: AppointmentStatus.no_show },
      }),
      this.prisma.appointment.groupBy({
        by: ['status'],
        where: appointmentWhere,
        _count: { _all: true },
      }),
      this.prisma.user.count({ where: { createdAt: dateWhere } }),
      this.prisma.doctor.count({ where: { createdAt: dateWhere } }),
      this.prisma.hospital.count({ where: { createdAt: dateWhere } }),
      this.prisma.review.count({ where: { createdAt: dateWhere } }),
      this.prisma.news.count({
        where: {
          isPublished: true,
          publishedAt: dateWhere,
        },
      }),
      this.prisma.appointment.findMany({
        where: {
          ...appointmentWhere,
          status: AppointmentStatus.completed,
        },
        select: {
          doctor: {
            select: { consultationFee: true },
          },
        },
      }),
      this.prisma.appointment.groupBy({
        by: ['doctorId'],
        where: appointmentWhere,
        _count: { _all: true },
        orderBy: {
          _count: { doctorId: 'desc' },
        },
        take: 5,
      }),
      this.prisma.appointment.groupBy({
        by: ['hospitalId'],
        where: appointmentWhere,
        _count: { _all: true },
        orderBy: {
          _count: { hospitalId: 'desc' },
        },
        take: 5,
      }),
      this.prisma.appointment.findMany({
        where: appointmentWhere,
        select: { createdAt: true, status: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const appointmentStatusMap = appointmentsByStatus.reduce(
      (acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
      },
      {} as Record<AppointmentStatus, number>,
    );

    const estimatedRevenue = completedForRevenue.reduce(
      (sum, item) => sum + item.doctor.consultationFee,
      0,
    );

    const [topDoctorProfiles, topHospitalProfiles] = await Promise.all([
      this.prisma.doctor.findMany({
        where: { id: { in: topDoctorsRaw.map((d) => d.doctorId) } },
        select: {
          id: true,
          slug: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.hospital.findMany({
        where: { id: { in: topHospitalsRaw.map((h) => h.hospitalId) } },
        select: {
          id: true,
          name: true,
          slug: true,
          city: true,
        },
      }),
    ]);

    const doctorById = new Map(topDoctorProfiles.map((item) => [item.id, item]));
    const hospitalById = new Map(
      topHospitalProfiles.map((item) => [item.id, item]),
    );

    const topDoctors = topDoctorsRaw.map((item) => ({
      ...doctorById.get(item.doctorId),
      appointmentCount: item._count._all,
    }));

    const topHospitals = topHospitalsRaw.map((item) => ({
      ...hospitalById.get(item.hospitalId),
      appointmentCount: item._count._all,
    }));

    const timelineMap = new Map<
      string,
      { total: number; completed: number; cancelled: number; noShow: number }
    >();

    reportAppointments.forEach((item) => {
      const day = item.createdAt.toISOString().slice(0, 10);
      const current = timelineMap.get(day) ?? {
        total: 0,
        completed: 0,
        cancelled: 0,
        noShow: 0,
      };

      current.total += 1;
      if (item.status === AppointmentStatus.completed) current.completed += 1;
      if (item.status === AppointmentStatus.cancelled) current.cancelled += 1;
      if (item.status === AppointmentStatus.no_show) current.noShow += 1;
      timelineMap.set(day, current);
    });

    const dailyTimeline = Array.from(timelineMap.entries()).map(
      ([date, values]) => ({
        date,
        ...values,
      }),
    );

    return {
      range: { from: query.from, to: query.to },
      overview: {
        appointments: totalAppointments,
        completedAppointments,
        cancelledAppointments,
        noShowAppointments,
        completionRate:
          totalAppointments === 0
            ? 0
            : Math.round((completedAppointments / totalAppointments) * 10000) /
              100,
        cancellationRate:
          totalAppointments === 0
            ? 0
            : Math.round((cancelledAppointments / totalAppointments) * 10000) /
              100,
        estimatedRevenue,
      },
      growth: {
        newUsers,
        newDoctors,
        newHospitals,
        newReviews,
        publishedNews,
      },
      appointmentsByStatus: {
        pending: appointmentStatusMap.pending ?? 0,
        confirmed: appointmentStatusMap.confirmed ?? 0,
        processing: appointmentStatusMap.processing ?? 0,
        completed: appointmentStatusMap.completed ?? 0,
        cancelled: appointmentStatusMap.cancelled ?? 0,
        no_show: appointmentStatusMap.no_show ?? 0,
      },
      topDoctors,
      topHospitals,
      dailyTimeline,
    };
  }

  async findAllUsers(query: QueryAdminUsersDto) {
    const {
      search,
      role,
      provider,
      isActive,
      isEmailVerified,
      page,
      limit,
    } = query;
    const { take, skip } = this.getPagination(page, limit);

    const where: Prisma.UserWhereInput = {
      ...(role && { role }),
      ...(provider && { provider }),
      ...(isActive !== undefined && { isActive }),
      ...(isEmailVerified !== undefined && { isEmailVerified }),
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatar: true,
          role: true,
          provider: true,
          isActive: true,
          isEmailVerified: true,
          createdAt: true,
          updatedAt: true,
          doctorProfile: {
            select: {
              id: true,
              slug: true,
              isVerified: true,
              isActive: true,
            },
          },
          _count: {
            select: {
              patientProfiles: true,
              newsArticles: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.user.count({ where }),
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

  async updateUserRole(userId: string, dto: UpdateUserRoleDto) {
    const user = await this.getUserById(userId);

    if (user.role === dto.role) {
      throw new BadRequestException(`User đã có role "${dto.role}"`);
    }

    if (user.doctorProfile && dto.role !== PrismaUserRole.doctor) {
      const activeAppointments = await this.prisma.appointment.count({
        where: {
          doctorId: user.doctorProfile.id,
          status: { in: APPOINTMENT_ACTIVE_STATUSES },
        },
      });

      if (activeAppointments > 0) {
        throw new ConflictException(
          `Không thể đổi role khi bác sĩ còn ${activeAppointments} lịch hẹn chưa hoàn tất`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { role: dto.role },
      });

      if (dto.role === PrismaUserRole.doctor) {
        if (!user.doctorProfile) {
          const slug = await this.generateUniqueDoctorSlug(
            user.firstName,
            user.lastName,
          );

          await tx.doctor.create({
            data: {
              userId,
              slug,
              isActive: true,
              isVerified: false,
              experience: 0,
              consultationFee: 0,
            },
          });
        } else {
          await tx.doctor.update({
            where: { id: user.doctorProfile.id },
            data: { isActive: true },
          });
        }
      } else if (user.doctorProfile) {
        await tx.doctor.update({
          where: { id: user.doctorProfile.id },
          data: { isActive: false, isVerified: false },
        });
      }
    });

    return this.getUserById(userId);
  }

  async updateUserBanStatus(userId: string, dto: UpdateUserBanDto) {
    const user = await this.getUserById(userId);

    if (user.isActive === dto.isActive) {
      throw new BadRequestException(
        `User đã ở trạng thái ${dto.isActive ? 'hoạt động' : 'bị khóa'}`,
      );
    }

    if (user.role === PrismaUserRole.admin && dto.isActive === false) {
      const activeAdminCount = await this.prisma.user.count({
        where: { role: PrismaUserRole.admin, isActive: true },
      });

      if (activeAdminCount <= 1) {
        throw new ConflictException('Không thể khóa admin cuối cùng của hệ thống');
      }
    }

    if (user.doctorProfile && dto.isActive === false) {
      const activeAppointments = await this.prisma.appointment.count({
        where: {
          doctorId: user.doctorProfile.id,
          status: { in: APPOINTMENT_ACTIVE_STATUSES },
        },
      });

      if (activeAppointments > 0) {
        throw new ConflictException(
          `Không thể khóa tài khoản khi bác sĩ còn ${activeAppointments} lịch hẹn chưa hoàn tất`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { isActive: dto.isActive },
      });

      if (user.doctorProfile) {
        await tx.doctor.update({
          where: { id: user.doctorProfile.id },
          data: { isActive: dto.isActive },
        });
      }
    });

    return this.getUserById(userId);
  }
}

