export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export type JsonObject = {
  [key: string]: JsonValue | undefined;
};

export type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: JsonObject;
};

export type JsonRpcResponse =
  | {
      jsonrpc: '2.0';
      id: string | number | null;
      result: JsonValue;
    }
  | {
      jsonrpc: '2.0';
      id: string | number | null;
      error: {
        code: number;
        message: string;
        data?: JsonValue;
      };
    };

export type McpTextContent = {
  type: 'text';
  text: string;
};

export type McpToolResult = {
  content: McpTextContent[];
  structuredContent?: JsonValue;
  isError?: boolean;
};

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonObject;
};

export type McpResourceDefinition = {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
};

export type McpResourceTemplateDefinition = {
  uriTemplate: string;
  name: string;
  description: string;
  mimeType?: string;
};

export type McpPromptArgument = {
  name: string;
  description: string;
  required?: boolean;
};

export type McpPromptDefinition = {
  name: string;
  description: string;
  arguments?: McpPromptArgument[];
};

export type McpPromptMessage = {
  role: 'user' | 'assistant';
  content: {
    type: 'text';
    text: string;
  };
};

export type McpPromptResult = {
  description?: string;
  messages: McpPromptMessage[];
};
