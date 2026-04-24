import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Response } from 'express';

// Bắt lỗi HttpException và trả về phản hồi JSON chuẩn cho client
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp(); // Chuyển đổi context để lấy đối tượng Response
    const response = ctx.getResponse<Response>(); // Lấy đối tượng Response từ context
    const statusCode = exception.getStatus(); // Lấy mã trạng thái HTTP từ exception
    const exceptionResponse: any = exception.getResponse(); // Lấy thông tin chi tiết về lỗi từ exception

    // Trả về phản hồi JSON với mã lỗi và thông điệp lỗi
    response
      .status(statusCode)
      .json({
        status: 'error',
        statusCode: statusCode,
        message: typeof exceptionResponse.message === 'string' 
            ? exceptionResponse.message 
            : exceptionResponse.message[0] || 'Có lỗi xảy ra',
      });
  }
}