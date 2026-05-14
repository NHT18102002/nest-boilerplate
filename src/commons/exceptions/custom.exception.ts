import { HttpException } from '@nestjs/common';
import type { ErrorCode } from './error-codes';

export interface CustomExceptionOptions {
  code: ErrorCode;
  statusCode: number;
  message: string;
  context?: string;
  trace?: string;
}

export class CustomException extends HttpException {
  public readonly code: ErrorCode;
  public readonly context?: string;
  public readonly trace?: string;

  constructor(options: CustomExceptionOptions) {
    super(
      {
        statusCode: options.statusCode,
        message: options.message,
        code: options.code,
      },
      options.statusCode,
    );

    this.code = options.code;
    this.context = options.context;
    this.trace = options.trace;

    Object.setPrototypeOf(this, CustomException.prototype);
  }
}
