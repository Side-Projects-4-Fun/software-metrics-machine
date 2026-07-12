import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4,
};

export interface LoggerOptions {
  level?: LogLevel;
  filePath?: string;
  storeLogs?: boolean;
}

export class Logger {
  private level: LogLevel | undefined;
  private readonly name: string;
  private filePath?: string;
  private readonly storeLogs?: boolean;

  constructor(
    name: string,
    levelOrOptions?: LogLevel | LoggerOptions,
    options: LoggerOptions = {}
  ) {
    this.name = name;
    if (!levelOrOptions) {
      return;
    }

    if (typeof levelOrOptions === 'string') {
      this.level = levelOrOptions;
      this.filePath = options.filePath;
      this.storeLogs = options.storeLogs;
      return;
    }

    this.level = levelOrOptions.level;
    this.filePath = levelOrOptions.filePath;
    this.storeLogs = levelOrOptions.storeLogs;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.getLevel()];
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${this.name}] ${message}`;
  }

  private formatData(data?: unknown): string {
    if (data === undefined) {
      return '';
    }

    if (data instanceof Error) {
      return data.stack || data.message;
    }

    if (typeof data === 'string') {
      return data;
    }

    try {
      return JSON.stringify(data);
    } catch {
      return String(data);
    }
  }

  private appendToFile(formattedMessage: string, data?: unknown): void {
    if (!this.storeLogs || !this.filePath) {
      return;
    }

    const formattedData = this.formatData(data);
    const line = formattedData ? `${formattedMessage} ${formattedData}` : formattedMessage;

    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      appendFileSync(this.filePath, `${line}\n`, 'utf8');
    } catch {
      // Logging should never make the main application fail.
    }
  }

  private write(
    level: LogLevel,
    message: string,
    data: unknown,
    consoleWriter: (message?: unknown, ...optionalParams: unknown[]) => void
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message);
    if (data !== undefined) {
      consoleWriter(formattedMessage, data);
    } else {
      consoleWriter(formattedMessage);
    }
    this.appendToFile(formattedMessage, data);
  }

  debug(message: string, data?: unknown): void {
    // eslint-disable-next-line no-console
    this.write('DEBUG', message, data, console.info);
  }

  info(message: string, data?: unknown): void {
    // eslint-disable-next-line no-console
    this.write('INFO', message, data, console.log);
  }

  warn(message: string, data?: unknown): void {
    this.write('WARN', message, data, console.warn);
  }

  error(message: string, error?: Error | unknown): void {
    this.write('ERROR', message, error, console.error);
  }

  critical(message: string, error?: Error | unknown): void {
    this.write('CRITICAL', message, error, console.error);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level || 'INFO';
  }

  setFilePath(filePath?: string): void {
    this.filePath = filePath;
  }

  getFilePath(): string | undefined {
    return this.filePath;
  }
}
