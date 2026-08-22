/**
 * Bridges the existing SMM tool, resource, and prompt definitions to the
 * `@modelcontextprotocol/sdk` high-level `McpServer` API.
 *
 * The existing `tools.ts`, `resources.ts`, and `prompts.ts` modules contain the
 * business logic (handlers, read callbacks, prompt builders). This module
 * converts their JSON-Schema-based definitions into zod schemas (required by the
 * SDK) and registers them on a `McpServer` instance.
 *
 * The existing `validation.ts` parsers remain the authoritative validation
 * layer — they perform normalisation (trimming, CSV parsing, enum lower-casing)
 * that zod alone cannot replicate. The zod schemas advertised to MCP clients
 * mirror the hand-crafted JSON Schemas so `tools/list` output is unchanged.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  ReadResourceResult,
  CallToolResult,
  GetPromptResult,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { tools, findTool } from './tools';
import {
  listResources,
  listResourceTemplates,
  readResource,
  type ResourceReadResult,
} from './resources';
import { prompts, getPrompt } from './prompts';
import type { JsonObject, JsonValue } from './mcp-types';

/**
 * Converts a JSON-Schema property definition into the equivalent zod schema.
 * Supports the subset used by the SMM MCP input schemas: string, number,
 * boolean, and string enums. Descriptions are preserved.
 */
function jsonSchemaPropertyToZod(prop: JsonObject | undefined): z.ZodTypeAny {
  if (!prop) {
    return z.unknown();
  }

  const description = typeof prop.description === 'string' ? prop.description : undefined;

  if (Array.isArray(prop.enum)) {
    const values = prop.enum.filter((v): v is string => typeof v === 'string');
    if (values.length > 0) {
      // Build a union of z.literal schemas. z.enum triggers TS2589 (excessive
      // type instantiation) with TypeScript 6, so we construct the union
      // manually and cast through unknown to keep the compiler happy.
      const literals = values.map((v) => z.literal(v));
      const schema = (
        literals.length === 1
          ? literals[0]
          : (z.union(
              literals as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]
            ) as z.ZodTypeAny)
      ) as z.ZodTypeAny;
      return description ? schema.describe(description) : schema;
    }
  }

  switch (prop.type) {
    case 'string':
      return description ? z.string().describe(description) : z.string();
    case 'number':
      return description ? z.number().describe(description) : z.number();
    case 'boolean':
      return description ? z.boolean().describe(description) : z.boolean();
    default:
      return z.unknown();
  }
}

/**
 * Converts a JSON-Schema object (as produced by the `buildXxxInputSchema`
 * helpers) into a zod raw shape suitable for `McpServer.registerTool`.
 *
 * Every property is optional — the SDK validates required fields separately,
 * and the existing `parseXxxArguments` validators enforce required fields with
 * richer error messages.
 */
function jsonSchemaToZodShape(schema: JsonObject | undefined): Record<string, z.ZodTypeAny> {
  if (!schema || typeof schema !== 'object') {
    return {};
  }

  const properties = (schema.properties ?? {}) as JsonObject;
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries(properties)) {
    const propSchema = prop as JsonObject;
    shape[key] = jsonSchemaPropertyToZod(propSchema).optional();
  }

  return shape;
}

/**
 * Wraps a tool handler result so it conforms to the SDK's `CallToolResult`
 * shape. The existing `asToolResult` helper in `tools.ts` already produces the
 * correct structure; this function is a thin adapter that ensures the
 * `structuredContent` field is compatible with the SDK's expected type.
 */
function adaptToolResult(result: {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: JsonValue;
  isError?: boolean;
}): CallToolResult {
  return {
    content: result.content,
    ...(result.structuredContent !== undefined
      ? { structuredContent: result.structuredContent as Record<string, unknown> }
      : {}),
    ...(result.isError !== undefined ? { isError: result.isError } : {}),
  };
}

/**
 * Registers all SMM tools on the given `McpServer`.
 *
 * Each tool's existing JSON-Schema `inputSchema` is converted to a zod raw
 * shape so the SDK can both validate input and advertise the schema to clients.
 * The original handler is invoked with the raw (untyped) arguments so the
 * existing `parseXxxArguments` validators remain the source of truth for
 * normalisation and domain-specific validation.
 */
export function registerTools(server: McpServer): void {
  for (const tool of tools) {
    const zodShape = jsonSchemaToZodShape(tool.inputSchema);
    // Wrap the raw shape in a z.object schema and cast to ZodTypeAny to avoid
    // TS2589 (excessive type instantiation) that occurs when the SDK's
    // registerTool generic tries to infer InputArgs from a large raw shape.
    const inputSchema = z.object(zodShape) as z.ZodTypeAny;

    // Cast the server to a minimal interface to avoid TS2589. The SDK's
    // registerTool generic conditional types trigger excessive instantiation
    // with TypeScript 6 when InputArgs is a complex ZodTypeAny. The runtime
    // behaviour is identical — we just bypass the compiler's type inference.
    type MinimalToolRegistrar = {
      registerTool(
        name: string,
        config: {
          description?: string;
          inputSchema?: z.ZodTypeAny;
        },
        cb: (args: Record<string, unknown>) => Promise<CallToolResult>
      ): unknown;
    };
    (server as unknown as MinimalToolRegistrar).registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema,
      },
      async (args: Record<string, unknown>): Promise<CallToolResult> => {
        const result = await tool.handler(args);
        return adaptToolResult(result);
      }
    );
  }
}

/**
 * Registers all SMM resources on the given `McpServer`.
 *
 * - Static resources (`smm://projects`, `smm://engineering-health/metrics`, and
 *   per-project resources) are registered with fixed URIs.
 * - Resource templates are registered with `ResourceTemplate` so clients can
 *   discover them via `resources/templates/list` and read them by URI.
 *
 * The per-project resources are enumerated at registration time from the current
 * configuration, matching the previous hand-crafted `resources/list` behaviour.
 */
export function registerResources(server: McpServer): void {
  // Static resources — registered with fixed URIs.
  const staticResources = listResources();

  for (const resource of staticResources) {
    server.registerResource(
      resource.name,
      resource.uri,
      {
        description: resource.description,
        mimeType: resource.mimeType,
      },
      async (uri: URL): Promise<ReadResourceResult> => {
        const result: ResourceReadResult = await readResource(uri.toString());
        return {
          contents: result.contents.map((entry) => ({
            uri: entry.uri,
            mimeType: entry.mimeType,
            text: entry.text,
          })),
        };
      }
    );
  }

  // Resource templates — registered with URI templates so clients can read by
  // constructing URIs from the template pattern.
  const templates = listResourceTemplates();

  for (const template of templates) {
    server.registerResource(
      template.name,
      new ResourceTemplate(template.uriTemplate, {
        list: undefined,
      }),
      {
        description: template.description,
        mimeType: template.mimeType,
      },
      async (uri: URL): Promise<ReadResourceResult> => {
        const result: ResourceReadResult = await readResource(uri.toString());
        return {
          contents: result.contents.map((entry) => ({
            uri: entry.uri,
            mimeType: entry.mimeType,
            text: entry.text,
          })),
        };
      }
    );
  }
}

/**
 * Registers all SMM prompts on the given `McpServer`.
 *
 * Each prompt's arguments are converted to a zod raw shape (all optional
 * strings) so the SDK can advertise them in `prompts/list`. The original
 * `getPrompt` builder is invoked with the raw arguments.
 */
export function registerPrompts(server: McpServer): void {
  for (const prompt of prompts) {
    const argsShape: Record<string, z.ZodTypeAny> = {};

    if (prompt.arguments) {
      for (const arg of prompt.arguments) {
        argsShape[arg.name] = z.string().optional().describe(arg.description);
      }
    }

    // Cast the server to a minimal interface to avoid TS2589. The SDK's
    // registerPrompt generic conditional types trigger excessive instantiation
    // with TypeScript 6 when ArgsSchema is a complex raw shape.
    type MinimalPromptRegistrar = {
      registerPrompt(
        name: string,
        config: {
          description?: string;
          argsSchema?: Record<string, z.ZodTypeAny>;
        },
        cb: (args: Record<string, unknown> | undefined) => Promise<GetPromptResult>
      ): unknown;
    };
    (server as unknown as MinimalPromptRegistrar).registerPrompt(
      prompt.name,
      {
        description: prompt.description,
        argsSchema: argsShape,
      },
      async (args: Record<string, unknown> | undefined): Promise<GetPromptResult> => {
        const result = await getPrompt(prompt.name, args);
        return {
          ...(result.description !== undefined ? { description: result.description } : {}),
          messages: result.messages.map((message) => ({
            role: message.role,
            content: {
              type: 'text',
              text: message.content.text,
            },
          })),
        };
      }
    );
  }
}

/**
 * Registers all SMM tools, resources, and prompts on the given `McpServer`.
 * This is the single entry point used by `startMcpServer`.
 */
export function registerAll(server: McpServer): void {
  registerTools(server);
  registerResources(server);
  registerPrompts(server);
}

export { findTool };
