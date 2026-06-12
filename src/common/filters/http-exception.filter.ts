// http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message = 'Có lỗi xảy ra';

    if (typeof exceptionResponse === 'string') {
      // Trường hợp: throw new HttpException('message', 400)
      message = exceptionResponse;
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
    ) {
      const body = exceptionResponse as Record<string, any>;

      if (typeof body.message === 'string') {
        message = body.message;
      } else if (Array.isArray(body.message) && body.message.length > 0) {
        // Class-validator trả về array các lỗi
        message = body.message[0];
      } else if (typeof body.error === 'string') {
        // Fallback sang field error
        message = body.error;
      }
    }

    response.status(statusCode).json({
      status: 'error',
      statusCode,
      message,
    });
  }
}
