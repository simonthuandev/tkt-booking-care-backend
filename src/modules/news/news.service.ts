import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateNewsDto,
  UpdateNewsDto,
  PublishNewsDto,
  QueryNewsDto,
  QueryAdminNewsDto,
} from './dto/news.dto';

@Injectable()
export class NewsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ───────────────────────────────────────────────

  /**
   * Sinh slug từ tiêu đề tiếng Việt.
   * VD: "Tim mạch và sức khỏe" → "tim-mach-va-suc-khoe"
   */
  private toSlug(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  /**
   * Sinh slug duy nhất bằng cách thêm suffix số nếu slug gốc đã tồn tại.
   * VD: "bai-viet" → "bai-viet-2" → "bai-viet-3"
   */
  private async generateUniqueSlug(
    baseSlug: string,
    excludeId?: string,
  ): Promise<string> {
    let slug = baseSlug;
    let counter = 2;

    while (true) {
      const existing = await this.prisma.news.findUnique({
        where: { slug },
        select: { id: true },
      });

      // Không tồn tại hoặc chính là record đang update → slug hợp lệ
      if (!existing || existing.id === excludeId) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  /**
   * Kiểm tra slug đã tồn tại chưa, bỏ qua record có excludeId.
   */
  private async assertSlugUnique(
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.news.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Slug "${slug}" đã được sử dụng`);
    }
  }

  private getPagination(page = 1, limit = 10) {
    return { take: limit, skip: (page - 1) * limit };
  }

  // ─── Select shapes ─────────────────────────────────────────

  /**
   * Select dùng cho listing — không lấy content đầy đủ (nặng).
   */
  private readonly NEWS_LIST_SELECT = {
    id: true,
    title: true,
    slug: true,
    excerpt: true,
    thumbnail: true,
    category: true,
    isPublished: true,
    publishedAt: true,
    createdAt: true,
    updatedAt: true,
    author: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
      },
    },
  } as const;

  /**
   * Select dùng cho detail page — bao gồm cả content.
   */
  private readonly NEWS_DETAIL_SELECT = {
    ...this.NEWS_LIST_SELECT,
    content: true,
  } as const;

  // ─── Public APIs ───────────────────────────────────────────

  /**
   * GET /news?category&search&page&limit
   * Danh sách bài viết đã published — public.
   * Mặc định sort theo publishedAt desc (mới nhất đứng đầu).
   */
  async findAll(query: QueryNewsDto) {
    const { category, search, page, limit } = query;
    const { take, skip } = this.getPagination(page, limit);

    const where = {
      isPublished: true,
      ...(category && {
        category: { contains: category, mode: 'insensitive' as const },
      }),
      ...(search && {
        title: { contains: search, mode: 'insensitive' as const },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.news.findMany({
        where,
        select: this.NEWS_LIST_SELECT,
        orderBy: { publishedAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.news.count({ where }),
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
   * GET /news/:slug
   * Chi tiết 1 bài viết đã published — public.
   */
  async findBySlug(slug: string) {
    const news = await this.prisma.news.findUnique({
      where: { slug },
      select: this.NEWS_DETAIL_SELECT,
    });

    if (!news) {
      throw new NotFoundException(`Không tìm thấy bài viết "${slug}"`);
    }

    if (!news.isPublished) {
      throw new NotFoundException('Bài viết này chưa được xuất bản');
    }

    return news;
  }

  /**
   * GET /news/categories
   * Danh sách category có bài viết đã published — dùng cho filter dropdown.
   */
  async getCategories(): Promise<string[]> {
    const result = await this.prisma.news.findMany({
      where: {
        isPublished: true,
        category: { not: null },
      },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    return result
      .map((r) => r.category)
      .filter((c): c is string => c !== null);
  }

  // ─── Admin APIs ────────────────────────────────────────────

  /**
   * GET /admin/news?search&category&isPublished&page&limit
   * Admin xem tất cả — kể cả bản nháp, có pagination.
   */
  async adminFindAll(query: QueryAdminNewsDto) {
    const { search, category, isPublished, page, limit } = query;
    const { take, skip } = this.getPagination(page, limit);

    const where = {
      ...(isPublished !== undefined && { isPublished }),
      ...(category && {
        category: { contains: category, mode: 'insensitive' as const },
      }),
      ...(search && {
        title: { contains: search, mode: 'insensitive' as const },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.news.findMany({
        where,
        select: this.NEWS_LIST_SELECT,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.news.count({ where }),
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
   * GET /admin/news/:id
   * Admin xem chi tiết 1 bài viết (kể cả bản nháp).
   */
  async adminFindById(id: string) {
    const news = await this.prisma.news.findUnique({
      where: { id },
      select: this.NEWS_DETAIL_SELECT,
    });

    if (!news) {
      throw new NotFoundException(`Không tìm thấy bài viết với id "${id}"`);
    }

    return news;
  }

  /**
   * POST /admin/news
   * Admin tạo bài viết mới.
   *
   * - Nếu không truyền slug → tự sinh từ title
   * - Nếu isPublished = true → set publishedAt = now()
   */
  async create(authorId: string, dto: CreateNewsDto) {
    // Sinh slug
    const baseSlug = dto.slug ?? this.toSlug(dto.title);

    // Nếu admin truyền slug tường minh → check unique chặt chẽ
    // Nếu tự sinh → tự động thêm suffix để tránh conflict
    let slug: string;
    if (dto.slug) {
      await this.assertSlugUnique(dto.slug);
      slug = dto.slug;
    } else {
      slug = await this.generateUniqueSlug(baseSlug);
    }

    const isPublished = dto.isPublished ?? false;

    return this.prisma.news.create({
      data: {
        title: dto.title,
        slug,
        content: dto.content,
        excerpt: dto.excerpt,
        thumbnail: dto.thumbnail,
        category: dto.category,
        authorId,
        isPublished,
        publishedAt: isPublished ? new Date() : null,
      },
      select: this.NEWS_DETAIL_SELECT,
    });
  }

  /**
   * PATCH /admin/news/:id
   * Admin cập nhật nội dung bài viết.
   *
   * - KHÔNG thay đổi isPublished ở đây — dùng endpoint /publish riêng
   * - Nếu đổi title mà không truyền slug → tự sinh slug mới từ title mới
   * - Nếu truyền slug tường minh → check unique
   */
  async update(id: string, dto: UpdateNewsDto) {
    await this.adminFindById(id); // throw 404 nếu không tìm thấy

    let slug: string | undefined;

    if (dto.slug) {
      // Admin truyền slug tường minh → check unique (bỏ qua chính nó)
      await this.assertSlugUnique(dto.slug, id);
      slug = dto.slug;
    } else if (dto.title) {
      // Đổi title mà không kèm slug → tự sinh slug mới
      const baseSlug = this.toSlug(dto.title);
      slug = await this.generateUniqueSlug(baseSlug, id);
    }

    return this.prisma.news.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(slug && { slug }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.excerpt !== undefined && { excerpt: dto.excerpt }),
        ...(dto.thumbnail !== undefined && { thumbnail: dto.thumbnail }),
        ...(dto.category !== undefined && { category: dto.category }),
      },
      select: this.NEWS_DETAIL_SELECT,
    });
  }

  /**
   * DELETE /admin/news/:id
   * Xóa cứng bài viết.
   * Chỉ cho phép xóa bản nháp (isPublished = false).
   * Bài đã publish phải unpublish trước để tránh xóa nhầm.
   */
  async remove(id: string) {
    const news = await this.adminFindById(id);

    if (news.isPublished) {
      throw new BadRequestException(
        'Không thể xóa bài viết đã xuất bản. Vui lòng hủy xuất bản trước.',
      );
    }

    await this.prisma.news.delete({ where: { id } });

    return { id, deleted: true };
  }

  /**
   * PATCH /admin/news/:id/publish
   * Admin publish hoặc unpublish bài viết.
   *
   * - publish (isPublished: true)  → set publishedAt = now() (nếu chưa có)
   * - unpublish (isPublished: false) → giữ nguyên publishedAt để audit trail
   */
  async togglePublish(id: string, dto: PublishNewsDto) {
    const news = await this.adminFindById(id);

    // Không làm gì nếu trạng thái không thay đổi
    if (news.isPublished === dto.isPublished) {
      throw new BadRequestException(
        `Bài viết này đã ở trạng thái ${dto.isPublished ? 'xuất bản' : 'nháp'} rồi`,
      );
    }

    return this.prisma.news.update({
      where: { id },
      data: {
        isPublished: dto.isPublished,
        // Chỉ set publishedAt khi publish lần đầu (publishedAt === null)
        // Lần publish lại sau unpublish → cập nhật thời gian mới
        publishedAt: dto.isPublished ? new Date() : null,
      },
      select: this.NEWS_DETAIL_SELECT,
    });
  }
}
