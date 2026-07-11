import { createInterface } from 'node:readline';
import { getApplicationVersion } from '@smmachine/utils';
import type { JsonObject, JsonRpcRequest, JsonRpcResponse, JsonValue } from './mcp-types';
import { listResources, readResource } from './resources';
import { findTool, tools } from './tools';

const SERVER_INFO = {
  name: 'software-metrics-machine',
  version: getApplicationVersion(),
};

type McpLog = (message: string) => void;

function stderrLog(message: string): void {
  process.stderr.write(`[${new Date().toISOString()}] [SMM MCP] ${message}\n`);
}

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
            resources: {},
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

        log?.(`Running tool: ${name}`);
        const result = await selectedTool.handler(request.params?.arguments);
        log?.(`Completed tool: ${name}`);

        return ok(request.id, result);
      }

      case 'resources/list':
        log?.('Listing MCP resources');
        return ok(request.id, {
          resources: listResources(),
        });

      case 'resources/read': {
        const uri = getStringParam(request.params, 'uri');
        if (!uri) {
          log?.('Rejected resources/read request without uri');
          return error(request.id, -32602, 'resources/read requires a uri parameter');
        }

        log?.(`Reading resource: ${uri}`);
        return ok(request.id, await readResource(uri));
      }

      case 'prompts/list':
        log?.('Listing MCP prompts');
        return ok(request.id, { prompts: [] });

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

export async function startMcpServer(): Promise<void> {
  stderrLog(`Starting Software Metrics Machine MCP server v${SERVER_INFO.version} over stdio`);
  stderrLog(`Configuration directory: ${process.env.SMM_STORE_DATA_AT || '<not set>'}`);
  stderrLog(`Available tools: ${tools.map((tool) => tool.name).join(', ')}`);

  const reader = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  reader.on('close', () => {
    stderrLog('MCP stdio input closed; server stopped');
  });

  for await (const line of reader) {
    if (!line.trim()) {
      continue;
    }

    let response: JsonRpcResponse | undefined;

    try {
      const parsed: unknown = JSON.parse(line);
      if (!isJsonRpcRequest(parsed)) {
        stderrLog('Rejected invalid JSON-RPC request');
        response = error(null, -32600, 'Invalid JSON-RPC request');
      } else {
        stderrLog(`Received request: ${parsed.method}`);
        response = await handleRequestWithLogging(parsed, stderrLog);
      }
    } catch (caught) {
      stderrLog(
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
