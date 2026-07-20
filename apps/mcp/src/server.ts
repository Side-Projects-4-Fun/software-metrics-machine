import { createInterface } from 'node:readline';
import { getApplicationVersion } from '@smmachine/utils';
import type { JsonObject, JsonRpcRequest, JsonRpcResponse, JsonValue } from './mcp-types';
import { configureMcpLogging, redirectConsoleToStderr, transportLogger } from './mcp-logger';
import { getPrompt, prompts } from './prompts';
import { listResources, listResourceTemplates, readResource } from './resources';
import { findTool, tools } from './tools';

const SERVER_INFO = {
  name: 'software-metrics-machine',
  version: getApplicationVersion(),
};

type McpLog = (message: string) => void;

const log: McpLog = (message) => transportLogger.info(message);

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'jsonrpc' in value &&
    value.jsonrpc === '2.0' &&
    'method' in value &&
    typeof value.method === 'string' &&
    // Optional: check id is string, number, null, or undefined
    (!('id' in value) ||
      value.id === undefined ||
      value.id === null ||
      typeof value.id === 'string' ||
      typeof value.id === 'number')
  );
}

function ok(id: string | number | null | undefined, result: JsonValue): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    result,
  };
}

function error(
  id: string | number | null | undefined,
  code: number,
  message: string,
  data?: JsonValue
): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: {
      code,
      message,
      data,
    },
  };
}

function getStringParam(params: JsonObject | undefined, fieldName: string): string | undefined {
  const value = params?.[fieldName];
  return typeof value === 'string' ? value : undefined;
}

export async function handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse | undefined> {
  return handleRequestWithLogging(request);
}

async function handleRequestWithLogging(
  request: JsonRpcRequest,
  log?: McpLog
): Promise<JsonRpcResponse | undefined> {
  if (request.id === undefined && request.method.startsWith('notifications/')) {
    log?.(`Received notification: ${request.method}`);
    return undefined;
  }

  try {
    switch (request.method) {
      case 'initialize':
        log?.('Client initialized MCP session');
        return ok(request.id, {
          protocolVersion: '2025-06-18',
          capabilities: {
            tools: {},
            resources: {
              list: true,
              read: true,
              listChanged: false,
            },
            prompts: {
              list: true,
              get: true,
              listChanged: false,
            },
          },
          serverInfo: SERVER_INFO,
        });

      case 'ping':
        log?.('Received ping');
        return ok(request.id, {});

      case 'tools/list':
        log?.(`Listing ${tools.length} MCP tools`);
        return ok(request.id, {
          tools: tools.map(({ handler: _handler, ...tool }) => tool),
        });

      case 'tools/call': {
        const name = getStringParam(request.params, 'name');
        const selectedTool = name ? findTool(name) : undefined;
        if (!selectedTool) {
          log?.(`Rejected unknown tool call: ${name || '<missing>'}`);
          return error(request.id, -32602, `Unknown tool: ${name || '<missing>'}`);
        }

        const toolStartedAt = Date.now();
        log?.(`Running tool: ${name}`);
        try {
          const result = await selectedTool.handler(request.params?.arguments);
          log?.(`Completed tool: ${name} in ${Date.now() - toolStartedAt}ms`);
          return ok(request.id, result);
        } catch (toolError) {
          const toolMessage = toolError instanceof Error ? toolError.message : String(toolError);
          log?.(`Failed tool: ${name} after ${Date.now() - toolStartedAt}ms (${toolMessage})`);
          throw toolError;
        }
      }

      case 'resources/list':
        log?.('Listing MCP resources');
        return ok(request.id, {
          resources: listResources(),
        });

      case 'resources/templates/list':
        log?.('Listing MCP resource templates');
        return ok(request.id, {
          resourceTemplates: listResourceTemplates(),
        });

      case 'resources/read': {
        const uri = getStringParam(request.params, 'uri');
        if (!uri) {
          log?.('Rejected resources/read request without uri');
          return error(request.id, -32602, 'resources/read requires a uri parameter');
        }

        const resourceStartedAt = Date.now();
        log?.(`Reading resource: ${uri}`);
        try {
          const resourceResult = await readResource(uri);
          log?.(`Read resource: ${uri} in ${Date.now() - resourceStartedAt}ms`);
          return ok(request.id, resourceResult);
        } catch (resourceError) {
          const resourceMessage =
            resourceError instanceof Error ? resourceError.message : String(resourceError);
          log?.(
            `Failed resource: ${uri} after ${Date.now() - resourceStartedAt}ms (${resourceMessage})`
          );
          throw resourceError;
        }
      }

      case 'prompts/list':
        log?.(`Listing ${prompts.length} MCP prompts`);
        return ok(request.id, { prompts });

      case 'prompts/get': {
        const name = getStringParam(request.params, 'name');
        if (!name) {
          log?.('Rejected prompts/get request without name');
          return error(request.id, -32602, 'prompts/get requires a name parameter');
        }

        const knownPrompt = prompts.find((prompt) => prompt.name === name);
        if (!knownPrompt) {
          log?.(`Rejected unknown prompt: ${name}`);
          return error(request.id, -32602, `Unknown prompt: ${name}`);
        }

        log?.(`Reading prompt: ${name}`);
        return ok(request.id, await getPrompt(name, request.params?.arguments));
      }

      default:
        log?.(`Rejected unknown method: ${request.method}`);
        return error(request.id, -32601, `Method not found: ${request.method}`);
    }
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    log?.(`Request failed for ${request.method}: ${message}`);
    return error(request.id, -32000, message);
  }
}

export type StartMcpServerOptions = {
  /**
   * Enables DEBUG-level logging for transport, operation, tool, resource, and
   * prompt loggers. Mirrors the CLI `--debug` global flag so callers that start
   * the server through the CLI do not need to also set the DEBUG env var.
   */
  debug?: boolean;
};

export async function startMcpServer(options: StartMcpServerOptions = {}): Promise<void> {
  // MCP uses stdout as the JSON-RPC transport. Ensure logs go to stderr even
  // when the server is started through the CLI (smm mcp server start) which
  // imports this module directly instead of the bin entry point.
  redirectConsoleToStderr();
  // Apply the CLI --debug flag (or env fallback) before any logs are emitted.
  configureMcpLogging({ debug: options.debug });

  log(`Starting Software Metrics Machine MCP server v${SERVER_INFO.version} over stdio`);
  log(`Configuration directory: ${process.env.SMM_STORE_DATA_AT || '<not set>'}`);
  log(`Available tools: ${tools.map((tool) => tool.name).join(', ')}`);

  const reader = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  reader.on('close', () => {
    log('MCP stdio input closed; server stopped');
  });

  for await (const line of reader) {
    if (!line.trim()) {
      continue;
    }

    let response: JsonRpcResponse | undefined;

    try {
      const parsed: unknown = JSON.parse(line);
      if (!isJsonRpcRequest(parsed)) {
        log('Rejected invalid JSON-RPC request');
        response = error(null, -32600, 'Invalid JSON-RPC request');
      } else {
        log(`Received request: ${parsed.method}`);
        response = await handleRequestWithLogging(parsed, log);
      }
    } catch (caught) {
      log(
        `Failed to parse request: ${caught instanceof Error ? caught.message : 'Invalid JSON payload'}`
      );
      response = error(
        null,
        -32700,
        caught instanceof Error ? caught.message : 'Invalid JSON payload'
      );
    }

    if (response) {
      process.stdout.write(`${JSON.stringify(response)}\n`);
    }
  }
}
