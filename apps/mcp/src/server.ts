import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getApplicationVersion } from '@smmachine/utils';
import { resolveStoreDataAt } from '@smmachine/core';
import { configureMcpLogging, redirectConsoleToStderr, transportLogger } from './mcp-logger';
import { registerAll } from './registration';
import { tools } from './tools';

const SERVER_INFO = {
  name: 'software-metrics-machine',
  version: getApplicationVersion(),
};

const log = (message: string): void => {
  transportLogger.info(message);
};

/**
 * Creates and configures a `McpServer` with all SMM tools, resources, and
 * prompts registered. Exposed for testing — production usage goes through
 * `startMcpServer` which attaches a `StdioServerTransport`.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer(SERVER_INFO, {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
      logging: {},
    },
  });

  registerAll(server);

  return server;
}

export type StartMcpServerOptions = {
  /**
   * Enables DEBUG-level logging for transport, operation, tool, resource, and
   * prompt loggers. Mirrors the CLI `--debug` global flag so callers that start
   * the server through the CLI do not need to also set the DEBUG env var.
   */
  debug?: boolean;
};

/**
 * Starts the Software Metrics Machine MCP server over stdio using the official
 * `@modelcontextprotocol/sdk` `McpServer` and `StdioServerTransport`.
 *
 * The server is read-only — it exposes tools, resources, and prompts that read
 * from the SMM data store but never writes. Data collection remains the
 * responsibility of the SMM CLI.
 */
export async function startMcpServer(options: StartMcpServerOptions = {}): Promise<void> {
  // MCP uses stdout as the JSON-RPC transport. Ensure logs go to stderr even
  // when the server is started through the CLI (smm mcp server start) which
  // imports this module directly instead of the bin entry point.
  redirectConsoleToStderr();
  // Apply the CLI --debug flag (or env fallback) before any logs are emitted.
  configureMcpLogging({ debug: options.debug });

  log(`Starting Software Metrics Machine MCP server v${SERVER_INFO.version} over stdio`);
  log(`Configuration directory: ${resolveStoreDataAt(process.env) || '<not set>'}`);
  log(`Available tools: ${tools.map((tool) => tool.name).join(', ')}`);

  const server = createMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  log('MCP server connected to stdio transport');
}
