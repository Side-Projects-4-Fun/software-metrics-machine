import type { JsonObject } from './mcp-types';

export type MetricsToolArguments = {
  project?: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
};

export function readString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseMetricsToolArguments(argumentsValue: unknown): MetricsToolArguments {
  // Type guard to ensure we have a valid JsonObject
  if (
    argumentsValue === null ||
    typeof argumentsValue !== 'object' ||
    Array.isArray(argumentsValue)
  ) {
    return {};
  }

  const args = argumentsValue as JsonObject;

  return {
    project: readString(args.project, 'project'),
    startDate: readString(args.startDate, 'startDate'),
    endDate: readString(args.endDate, 'endDate'),
    timezone: readString(args.timezone, 'timezone'),
  };
}

export function buildMetricsInputSchema(description: string): JsonObject {
  return {
    type: 'object',
    description,
    additionalProperties: false,
    properties: {
      project: {
        type: 'string',
        description: 'Optional github_repository project name from smm_config.json.',
      },
      startDate: {
        type: 'string',
        description: 'Optional ISO 8601 start date.',
      },
      endDate: {
        type: 'string',
        description: 'Optional ISO 8601 end date.',
      },
      timezone: {
        type: 'string',
        description: 'Optional IANA timezone used for date boundaries.',
      },
    },
  };
}
