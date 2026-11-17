import { Logger } from '@smmachine/utils';

let consoleRedirected = false;

export function redirectConsoleToStderr(): void {
  if (consoleRedirected) {
    return;
  }
  consoleRedirected = true;

  const originalInfo = Reflect.get(console, 'info').bind(console) as (...args: unknown[]) => void;
  const originalLog = Reflect.get(console, 'log').bind(console) as (...args: unknown[]) => void;

  Reflect.set(console, 'info', (...args: unknown[]): boolean =>
    process.stderr.write(formatLine(args))
  );
  Reflect.set(console, 'log', (...args: unknown[]): boolean =>
    process.stderr.write(formatLine(args))
  );

  Reflect.set(console, '__smmOriginalInfo', originalInfo);
  Reflect.set(console, '__smmOriginalLog', originalLog);
}

function formatLine(args: unknown[]): string {
  const text = args
    .map((arg) => {
      if (typeof arg === 'string') {
        return arg;
      }
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
  return `${text}\n`;
}

let mcpLogLevel = resolveInitialLogLevel();

function resolveInitialLogLevel(): 'DEBUG' | 'INFO' | 'CRITICAL' {
  if (process.env.DEBUG) {
    return 'DEBUG';
  }
  return 'CRITICAL';
}

export function configureMcpLogging(options: { debug?: boolean; quiet?: boolean }): void {
  if (options.quiet) {
    mcpLogLevel = 'CRITICAL';
    applyLogLevel('CRITICAL');
    return;
  }

  if (options.debug) {
    mcpLogLevel = 'DEBUG';
    applyLogLevel('DEBUG');
    return;
  }

  mcpLogLevel = resolveInitialLogLevel();
  applyLogLevel(mcpLogLevel);
}

export function resolveMcpLogLevel(): 'DEBUG' | 'INFO' | 'CRITICAL' {
  return mcpLogLevel;
}

function applyLogLevel(level: 'DEBUG' | 'INFO' | 'CRITICAL'): void {
  transportLogger.setLevel(level);
  operationLogger.setLevel(level);
  toolLogger.setLevel(level);
  resourceLogger.setLevel(level);
  promptLogger.setLevel(level);
}

export const transportLogger = new Logger('SmmMcpServer', mcpLogLevel);
export const operationLogger = new Logger('SmmMcpOperation', mcpLogLevel);
export const toolLogger = new Logger('SmmMcpTool', mcpLogLevel);
export const resourceLogger = new Logger('SmmMcpResource', mcpLogLevel);
export const promptLogger = new Logger('SmmMcpPrompt', mcpLogLevel);
