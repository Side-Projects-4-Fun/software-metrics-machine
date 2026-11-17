import type { McpServer } from '@modelcontextprotocol/server';
import {
  ResourceTemplate,
  type ReadResourceResult,
  type CallToolResult,
  type GetPromptResult,
} from '@modelcontextprotocol/server';
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

function jsonSchemaPropertyToZod(prop: JsonObject | undefined): z.ZodTypeAny {
  if (!prop) {
    return z.unknown();
  }

  const description = typeof prop.description === 'string' ? prop.description : undefined;

  if (Array.isArray(prop.enum)) {
    const values = prop.enum.filter((v): v is string => typeof v === 'string');
    if (values.length > 0) {
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

export function registerTools(server: McpServer): void {
  for (const tool of tools) {
    const zodShape = jsonSchemaToZodShape(tool.inputSchema);

    const inputSchema = z.object(zodShape) as z.ZodTypeAny;

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

export function registerResources(server: McpServer): void {
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

export function registerPrompts(server: McpServer): void {
  for (const prompt of prompts) {
    const argsShape: Record<string, z.ZodTypeAny> = {};

    if (prompt.arguments) {
      for (const arg of prompt.arguments) {
        argsShape[arg.name] = z.string().optional().describe(arg.description);
      }
    }

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

export function registerAll(server: McpServer): void {
  registerTools(server);
  registerResources(server);
  registerPrompts(server);
}

export { findTool };
