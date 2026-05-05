// all-exceptions.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    
    // Log unknown errors
    console.error('Unhandled exception:', exception);
    
    response.status(500).json({
      status: 'error',
      statusCode: 500,
      message: 'Lỗi hệ thống, vui lòng thử lại sau',
    });
  }
}