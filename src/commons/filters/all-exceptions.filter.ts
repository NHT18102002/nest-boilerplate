import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { LoggerService } from '../logger/logger.service';
import { getCorrelationId } from '../middlewares/correlation-id.middleware';

/**
 * Global catch-all exception filter.
 * Catches any exception that is NOT handled by other specific filters
 * (e.g., TypeError, ReferenceError, or any unexpected error).
 *
 * MUST be registered FIRST in useGlobalFilters() so it runs LAST (NestJS checks in reverse order).
 */
@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new LoggerService(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const correlationId = getCorrelationId(request);

    const isError = exception instanceof Error;
    const message = isError ? exception.message : 'Unknown error';
    const stack = isError ? exception.stack : '';

    // Always log unhandled exceptions to file — these are critical
    this.logger.error(
      `[UnhandledException] ${message}`,
      undefined,
      correlationId,
      stack || '',
    );

    // Never leak stack trace or internal details to the client
    response.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}
