import { vi } from 'vitest';
import { Logger, type LogLevel } from '@smmachine/utils';

export type MockLogger = Logger & {
  debug: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  critical: ReturnType<typeof vi.fn>;
};

export class MockLoggerBuilder {
  private name = 'MockLogger';
  private level: LogLevel = 'CRITICAL';
  private filePath: string | undefined;
  private storeLogs = false;

  withName(name: string): this {
    this.name = name;
    return this;
  }

  withLevel(level: LogLevel): this {
    this.level = level;
    return this;
  }

  withFilePath(filePath: string | undefined): this {
    this.filePath = filePath;
    return this;
  }

  withStoreLogs(storeLogs = true): this {
    this.storeLogs = storeLogs;
    return this;
  }

  build(): MockLogger {
    const logger = new Logger(this.name, {
      level: this.level,
      filePath: this.filePath,
      storeLogs: this.storeLogs,
    }) as MockLogger;

    logger.debug = vi.fn<(message: string, data?: unknown) => void>();
    logger.info = vi.fn<(message: string, data?: unknown) => void>();
    logger.warn = vi.fn<(message: string, data?: unknown) => void>();
    logger.error = vi.fn<(message: string, data?: unknown) => void>();
    logger.critical = vi.fn<(message: string, data?: unknown) => void>();

    return logger;
  }
}
