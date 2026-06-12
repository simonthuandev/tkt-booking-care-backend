import {
  BadRequestException,
  Controller,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { Roles } from '@modules/auth/decorators';
import { UserRole } from '@modules/auth/interfaces';
import { UploadService, UploadedImageFile } from './upload.service';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.USER)
@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post(':type')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_SIZE },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
          return callback(
            new BadRequestException('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP'),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  async uploadImage(
    @Param('type') type: string,
    @UploadedFile() file: UploadedImageFile,
    @Req() req: Request,
  ) {
    const data = await this.uploadService.saveImage(type, file, req);
    return {
      message: 'Upload ảnh thành công',
      data,
    };
  }
}
