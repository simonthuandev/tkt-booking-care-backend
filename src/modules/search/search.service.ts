import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { QuerySearchDto, SearchType } from './dto/search.dto';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  private getPagination(page = 1, limit = 10) {
    return { take: limit, skip: (page - 1) * limit };
  }

  private async searchDoctors(query: QuerySearchDto) {
    const { q, city, page, limit } = query;
    const { take, skip } = this.getPagination(page, limit);

    const where: Prisma.DoctorWhereInput = {
      isActive: true,
      isVerified: true,
      user: {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
        ],
      },
      ...(city && {
        hospitals: {
          some: {
            isActive: true,
            hospital: {
              city: { contains: city, mode: 'insensitive' },
            },
          },
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.doctor.findMany({
        where,
        select: {
          id: true,
          slug: true,
          bio: true,
          experience: true,
          consultationFee: true,
          rating: true,
          totalReviews: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          specialties: {
            where: { isPrimary: true },
            select: {
              specialty: {
                select: { id: true, name: true, slug: true },
              },
            },
            take: 1,
          },
          hospitals: {
            where: { isActive: true },
            select: {
              hospital: {
                select: { id: true, name: true, slug: true, city: true },
              },
            },
            take: 3,
          },
        },
        orderBy: [{ rating: 'desc' }, { totalReviews: 'desc' }],
        take,
        skip,
      }),
      this.prisma.doctor.count({ where }),
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

  private async searchHospitals(query: QuerySearchDto) {
    const { q, city, page, limit } = query;
    const { take, skip } = this.getPagination(page, limit);

    const where: Prisma.HospitalWhereInput = {
      isActive: true,
      name: { contains: q, mode: 'insensitive' },
      ...(city && { city: { contains: city, mode: 'insensitive' } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.hospital.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          address: true,
          city: true,
          type: true,
          avatar: true,
          description: true,
          rating: true,
          totalReviews: true,
          _count: {
            select: {
              doctors: {
                where: {
                  isActive: true,
                  doctor: { isActive: true, isVerified: true },
                },
              },
            },
          },
        },
        orderBy: [{ rating: 'desc' }, { name: 'asc' }],
        take,
        skip,
      }),
      this.prisma.hospital.count({ where }),
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

  private async searchSpecialties(query: QuerySearchDto) {
    const { q, page, limit } = query;
    const { take, skip } = this.getPagination(page, limit);

    const where: Prisma.SpecialtyWhereInput = {
      isActive: true,
      name: { contains: q, mode: 'insensitive' },
    };

    const [data, total] = await Promise.all([
      this.prisma.specialty.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          icon: true,
          _count: {
            select: {
              doctors: {
                where: {
                  doctor: { isActive: true, isVerified: true },
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
        take,
        skip,
      }),
      this.prisma.specialty.count({ where }),
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

  async search(query: QuerySearchDto) {
    const type = query.type ?? SearchType.ALL;

    if (type === SearchType.DOCTOR) {
      const result = await this.searchDoctors(query);
      return { type, ...result };
    }

    if (type === SearchType.HOSPITAL) {
      const result = await this.searchHospitals(query);
      return { type, ...result };
    }

    if (type === SearchType.SPECIALTY) {
      const result = await this.searchSpecialties(query);
      return { type, ...result };
    }

    const [doctors, hospitals, specialties] = await Promise.all([
      this.searchDoctors(query),
      this.searchHospitals(query),
      this.searchSpecialties(query),
    ]);

    return {
      type: SearchType.ALL,
      data: {
        doctors: doctors.data,
        hospitals: hospitals.data,
        specialties: specialties.data,
      },
      meta: {
        page: query.page ?? 1,
        limit: query.limit ?? 10,
        totals: {
          doctors: doctors.meta.total,
          hospitals: hospitals.meta.total,
          specialties: specialties.meta.total,
        },
        total:
          doctors.meta.total + hospitals.meta.total + specialties.meta.total,
      },
    };
  }
}

