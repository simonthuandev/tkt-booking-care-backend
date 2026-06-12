import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import type { Request } from 'express';

const ALLOWED_TYPES = [
  'specialties',
  'hospitals',
  'doctors',
  'avatars',
] as const;
const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

type UploadType = (typeof ALLOWED_TYPES)[number];

export interface UploadedImageFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@Injectable()
export class UploadService {
  async saveImage(type: string, file: UploadedImageFile, req: Request) {
    const uploadType = this.assertUploadType(type);
    this.assertImageFile(file);

    const extension = MIME_EXTENSION_MAP[file.mimetype];
    const filename = `${randomUUID()}.${extension}`;
    const relativePath = `/uploads/${uploadType}/${filename}`;
    const uploadDir = join(process.cwd(), 'uploads', uploadType);
    const filePath = join(uploadDir, filename);

    try {
      await mkdir(uploadDir, { recursive: true });
      await writeFile(filePath, file.buffer);
    } catch (error) {
      console.error('Lỗi lưu file upload:', error);
      throw new InternalServerErrorException('Không thể lưu file upload');
    }

    return {
      url: `${this.getPublicBaseUrl(req)}${relativePath}`,
      path: relativePath,
      filename,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  private assertUploadType(type: string): UploadType {
    if (!ALLOWED_TYPES.includes(type as UploadType)) {
      throw new BadRequestException('Loại upload không hợp lệ');
    }

    return type as UploadType;
  }

  private assertImageFile(file: UploadedImageFile | undefined) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file ảnh để upload');
    }

    if (!MIME_EXTENSION_MAP[file.mimetype]) {
      throw new BadRequestException('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP');
    }

    if (!file.buffer?.length) {
      throw new BadRequestException('File upload không hợp lệ');
    }
  }

  private getPublicBaseUrl(req: Request) {
    const configuredUrl = process.env.PUBLIC_BASE_URL?.trim();
    if (configuredUrl) return configuredUrl.replace(/\/$/, '');

    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : forwardedProto || req.protocol;

    return `${protocol}://${req.get('host')}`;
  }
}
