import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponse } from '../dtos';
import { Logger as SmmLogger } from '@smmachine/utils';

function extractErrorMessage(exceptionResponse: string | object, exception: HttpException): string {
  if (typeof exceptionResponse === 'string') {
    return exceptionResponse;
  }

  const response = exceptionResponse as Record<string, unknown>;

  if (typeof response.message === 'string') {
    return response.message;
  }
  if (typeof response.error === 'string') {
    return response.error;
  }
  if (typeof response.message === 'object' && response.message !== null) {
    return String(response.message);
  }

  return exception.message;
}

/**
 * Global exception filter for all HTTP exceptions
 * Provides consistent error response format
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new SmmLogger('HttpExceptionFilter', 'CRITICAL');

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message: extractErrorMessage(exceptionResponse, exception),
      error: exception.name,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    this.logger.error(
      `HTTP Exception - Status: ${status}, Message: ${errorResponse.message}, Path: ${request.url}`,
      exception.stack
    );

    response.status(status).json(errorResponse);
  }
}

/**
 * Catch-all exception filter for unhandled exceptions
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new SmmLogger('AllExceptionsFilter', 'CRITICAL');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = HttpStatus.INTERNAL_SERVER_ERROR;

    const errorMessage = exception instanceof Error ? exception.message : 'Internal server error';
    const errorStack = exception instanceof Error ? exception.stack : '';

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message: errorMessage,
      error: 'InternalServerError',
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    this.logger.error(
      `Unhandled Exception - Status: ${status}, Message: ${errorMessage}, Path: ${request.url}`,
      errorStack
    );

    response.status(status).json(errorResponse);
  }
}
