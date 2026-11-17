import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Logger as SmmLogger } from '@smmachine/utils';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new SmmLogger('HTTP', 'CRITICAL');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, query } = req;
    const start = Date.now();

    const queryString =
      Object.keys(query).length > 0
        ? '?' + new URLSearchParams(query as Record<string, string>).toString()
        : '';
    this.logger.info(`${method} ${originalUrl}${queryString}`);

    const originalSend = res.send;
    const logger = this.logger;

    res.send = function (data: unknown): ReturnType<typeof originalSend> {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;

      logger.info(`${method} ${originalUrl} ${statusCode} - ${duration}ms`);

      res.send = originalSend;
      return res.send(data);
    };

    next();
  }
}
