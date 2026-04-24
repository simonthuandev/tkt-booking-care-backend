import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp(); // Chuyển đổi context để lấy đối tượng Response
    const response = ctx.getResponse<Response>(); // Lấy đối tượng Response từ context

    let code = HttpStatus.INTERNAL_SERVER_ERROR; // Mặc định là lỗi hệ thống nếu không xác định được lỗi cụ thể
    let message = 'Lỗi hệ thống cơ sở dữ liệu';

    switch (exception.code) {
      case 'P2002': // Lỗi trùng lặp dữ liệu (Unique constraint violation)
        code = HttpStatus.BAD_REQUEST;
        const field = exception.meta?.target;
        message = `Dữ liệu bị trùng lặp. Cột ${field} đã tồn tại!`;
        break;
      case 'P2025': // Lỗi không tìm thấy dữ liệu (Record not found)
        code = HttpStatus.NOT_FOUND;
        message = 'Không tìm thấy dữ liệu yêu cầu.';
        break;
      // case khác ...
    }

    // Trả về phản hồi JSON với mã lỗi và thông điệp lỗi
    response.status(code).json({
      status: 'error',
      statusCode: code,
      message: message,
    });
  }
}