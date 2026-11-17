import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
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
  debug?: boolean;
};

export async function startMcpServer(options: StartMcpServerOptions = {}): Promise<void> {
  redirectConsoleToStderr();

  configureMcpLogging({ debug: options.debug });

  log(`Starting Software Metrics Machine MCP server v${SERVER_INFO.version} over stdio`);
  log(`Configuration directory: ${resolveStoreDataAt(process.env) || '<not set>'}`);
  log(`Available tools: ${tools.map((tool) => tool.name).join(', ')}`);

  await serveStdio(() => createMcpServer());

  log('MCP server connected to stdio transport');
}
