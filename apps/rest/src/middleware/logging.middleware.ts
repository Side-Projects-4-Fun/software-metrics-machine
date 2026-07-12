import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Logger as SmmLogger } from '@smmachine/utils';

/**
 * Request logging middleware
 * Logs incoming requests and outgoing responses
 */
@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new SmmLogger('HTTP', 'CRITICAL');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, query } = req;
    const start = Date.now();

    // Log incoming request
    const queryString =
      Object.keys(query).length > 0
        ? '?' + new URLSearchParams(query as Record<string, string>).toString()
        : '';
    this.logger.info(`${method} ${originalUrl}${queryString}`);

    // Capture response
    const originalSend = res.send;
    const logger = this.logger;

    res.send = function (data: unknown) {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;

      // Log response
      logger.info(`${method} ${originalUrl} ${statusCode} - ${duration}ms`);

      // Restore original send method
      res.send = originalSend;
      return res.send(data);
    };

    next();
  }
}
