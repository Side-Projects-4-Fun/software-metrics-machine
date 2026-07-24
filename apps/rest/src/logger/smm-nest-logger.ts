import type { LoggerService } from '@nestjs/common';
import type { LogLevel } from '@smmachine/utils';
import { Logger as SmmLogger } from '@smmachine/utils';

export class SmmNestLogger implements LoggerService {
  private readonly logger: SmmLogger;

  constructor(name: string = 'NestJS') {
    const level: LogLevel = process.env.DEBUG ? 'DEBUG' : 'CRITICAL';
    this.logger = new SmmLogger(name, level);
  }

  log(message: unknown, context?: string): void {
    this.logger.info(context ? `[${context}] ${message}` : String(message));
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.logger.error(context ? `[${context}] ${message}` : String(message));
    if (trace) {
      this.logger.debug(`Stack trace: ${trace}`);
    }
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn(context ? `[${context}] ${message}` : String(message));
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug(context ? `[${context}] ${message}` : String(message));
  }

  verbose(message: unknown, context?: string): void {
    this.logger.debug(context ? `[${context}] ${message}` : String(message));
  }
}
