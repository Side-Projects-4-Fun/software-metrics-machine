import { Logger } from '@smmachine/utils';

/**
 * MCP servers communicate over stdio: stdout is the JSON-RPC transport channel
 * and must remain free of log output. The SMM Logger writes through console.*,
 * which by default writes to stdout for info/debug levels. Redirecting those
 * streams to stderr keeps logs visible in the MCP client output panel without
 * corrupting JSON-RPC messages.
 */
let consoleRedirected = false;

export function redirectConsoleToStderr(): void {
  if (consoleRedirected) {
    return;
  }
  consoleRedirected = true;

  // Preserve a reference so the redirect can be re-applied safely in tests.
  const originalInfo = console.info.bind(console);
  const originalLog = console.log.bind(console);

  // eslint-disable-next-line no-console
  console.info = (...args: unknown[]) => process.stderr.write(formatLine(args));
  // eslint-disable-next-line no-console
  console.log = (...args: unknown[]) => process.stderr.write(formatLine(args));

  // Keep references so consumers that need the originals can access them.
  (console as unknown as { __smmOriginalInfo?: (...args: unknown[]) => void }).__smmOriginalInfo =
    originalInfo;
  (console as unknown as { __smmOriginalLog?: (...args: unknown[]) => void }).__smmOriginalLog =
    originalLog;
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

/**
 * Runtime MCP log level. The MCP server is quiet by default (CRITICAL) and
 * enables transport/operation/tool/resource/prompt logs when the CLI `--debug`
 * flag is passed via `smm --debug mcp server start`.
 *
 * Level priority:
 *   1. Explicit `debug: true` passed via configureMcpLogging (from the CLI --debug flag)
 *   2. DEBUG env var (for standalone smm-mcp usage, e.g. MCP client configs)
 *   3. Default CRITICAL (quiet, matching the rest of the SMM CLI)
 */
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

// Initialize the loggers with the initial level. The SMM Logger defaults to
// INFO when constructed with a string level.
export const transportLogger = new Logger('SmmMcpServer', mcpLogLevel);
export const operationLogger = new Logger('SmmMcpOperation', mcpLogLevel);
export const toolLogger = new Logger('SmmMcpTool', mcpLogLevel);
export const resourceLogger = new Logger('SmmMcpResource', mcpLogLevel);
export const promptLogger = new Logger('SmmMcpPrompt', mcpLogLevel);
