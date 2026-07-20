import type { JsonObject } from './mcp-types';

export type MetricsToolArguments = {
  project?: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
};

export type EngineeringHealthArguments = {
  project?: string;
  timezone?: string;
  metric?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  compareStartDate?: string;
  compareEndDate?: string;
  prLabels?: string;
  rawFilters?: string;
  period?: 'day' | 'week' | 'month';
  weekends?: 'include' | 'exclude' | 'weekends_only';
  outlierMode?: 'include' | 'flag' | 'exclude';
};

export type DoraMetricsArguments = {
  project?: string;
  timezone?: string;
  startDate?: string;
  endDate?: string;
  workflowPath?: string;
  status?: string;
  conclusion?: string;
  branch?: string;
  jobName?: string;
  event?: string;
  weekends?: 'include' | 'exclude' | 'weekends_only';
  outlierMode?: 'include' | 'flag' | 'exclude';
};

export type CodeMetricsArguments = MetricsToolArguments & {
  authors?: string;
  includePatterns?: string;
  ignorePatterns?: string;
};

export type IssueMetricsArguments = MetricsToolArguments & {
  status?: string;
};

export type ArchitectureViewArguments = {
  project?: string;
  level?: 'context' | 'container' | 'component' | 'code';
  snapshotId?: string;
  includePatterns?: string;
  ignorePatterns?: string;
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

function readEnum<T extends string>(
  value: unknown,
  fieldName: string,
  allowed: readonly T[]
): T | undefined {
  const raw = readString(value, fieldName);
  if (raw === undefined) {
    return undefined;
  }

  const normalized = raw.toLowerCase() as T;
  if (!allowed.includes(normalized)) {
    throw new Error(`${fieldName} must be one of: ${allowed.join(', ')}`);
  }

  return normalized;
}

function parseCsvList(value: unknown, fieldName: string): string[] | undefined {
  const raw = readString(value, fieldName);
  if (raw === undefined) {
    return undefined;
  }

  const parsed = raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return parsed.length > 0 ? parsed : undefined;
}

function readObject(value: unknown): JsonObject | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as JsonObject;
}

export function parseMetricsToolArguments(argumentsValue: unknown): MetricsToolArguments {
  const args = readObject(argumentsValue);
  if (!args) {
    return {};
  }

  return {
    project: readString(args.project, 'project'),
    startDate: readString(args.startDate, 'startDate'),
    endDate: readString(args.endDate, 'endDate'),
    timezone: readString(args.timezone, 'timezone'),
  };
}

export function parseCodeMetricsArguments(argumentsValue: unknown): CodeMetricsArguments {
  const args = readObject(argumentsValue);
  if (!args) {
    return {};
  }

  return {
    ...parseMetricsToolArguments(args),
    authors: readString(args.authors, 'authors'),
    includePatterns: readString(args.includePatterns, 'includePatterns'),
    ignorePatterns: readString(args.ignorePatterns, 'ignorePatterns'),
  };
}

export function parseIssueMetricsArguments(argumentsValue: unknown): IssueMetricsArguments {
  const args = readObject(argumentsValue);
  if (!args) {
    return {};
  }

  return {
    ...parseMetricsToolArguments(args),
    status: readString(args.status, 'status'),
  };
}

export function parseEngineeringHealthArguments(
  argumentsValue: unknown
): EngineeringHealthArguments {
  const args = readObject(argumentsValue);
  if (!args) {
    return {};
  }

  return {
    project: readString(args.project, 'project'),
    timezone: readString(args.timezone, 'timezone'),
    metric: readString(args.metric, 'metric'),
    category: readEnum(args.category, 'category', [
      'delivery',
      'quality',
      'collaboration',
      'architecture',
    ] as const),
    startDate: readString(args.startDate, 'startDate'),
    endDate: readString(args.endDate, 'endDate'),
    compareStartDate: readString(args.compareStartDate, 'compareStartDate'),
    compareEndDate: readString(args.compareEndDate, 'compareEndDate'),
    prLabels: readString(args.prLabels, 'prLabels'),
    rawFilters: readString(args.rawFilters, 'rawFilters'),
    period: readEnum(args.period, 'period', ['day', 'week', 'month'] as const),
    weekends: readEnum(args.weekends, 'weekends', ['include', 'exclude', 'weekends_only'] as const),
    outlierMode: readEnum(args.outlierMode, 'outlierMode', ['include', 'flag', 'exclude'] as const),
  };
}

export function parseDoraMetricsArguments(argumentsValue: unknown): DoraMetricsArguments {
  const args = readObject(argumentsValue);
  if (!args) {
    return {};
  }

  return {
    project: readString(args.project, 'project'),
    timezone: readString(args.timezone, 'timezone'),
    startDate: readString(args.startDate, 'startDate'),
    endDate: readString(args.endDate, 'endDate'),
    workflowPath: readString(args.workflowPath, 'workflowPath'),
    status: readString(args.status, 'status'),
    conclusion: readString(args.conclusion, 'conclusion'),
    branch: readString(args.branch, 'branch'),
    jobName: readString(args.jobName, 'jobName'),
    event: readString(args.event, 'event'),
    weekends: readEnum(args.weekends, 'weekends', ['include', 'exclude', 'weekends_only'] as const),
    outlierMode: readEnum(args.outlierMode, 'outlierMode', ['include', 'flag', 'exclude'] as const),
  };
}

export function parseArchitectureViewArguments(argumentsValue: unknown): ArchitectureViewArguments {
  const args = readObject(argumentsValue);
  if (!args) {
    return {};
  }

  return {
    project: readString(args.project, 'project'),
    level: readEnum(args.level, 'level', ['context', 'container', 'component', 'code'] as const),
    snapshotId: readString(args.snapshotId, 'snapshotId'),
    includePatterns: readString(args.includePatterns, 'includePatterns'),
    ignorePatterns: readString(args.ignorePatterns, 'ignorePatterns'),
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

function baseMetricsProperties(): JsonObject {
  const schema = buildMetricsInputSchema('base');
  return (schema.properties ?? {}) as JsonObject;
}

export function buildCodeMetricsInputSchema(): JsonObject {
  return {
    ...buildMetricsInputSchema('Code metric filters.'),
    properties: {
      ...baseMetricsProperties(),
      authors: {
        type: 'string',
        description: 'Optional comma-separated list of authors to filter code churn and coupling.',
      },
      includePatterns: {
        type: 'string',
        description: 'Optional comma or newline separated file patterns to include.',
      },
      ignorePatterns: {
        type: 'string',
        description: 'Optional comma or newline separated file patterns to ignore.',
      },
    } as JsonObject,
  };
}

export function buildIssueMetricsInputSchema(): JsonObject {
  return {
    ...buildMetricsInputSchema('Issue metric filters.'),
    properties: {
      ...baseMetricsProperties(),
      status: {
        type: 'string',
        description: 'Optional Jira issue status filter (e.g. Done, In Progress).',
      },
    } as JsonObject,
  };
}

export function buildEngineeringHealthInputSchema(): JsonObject {
  return {
    type: 'object',
    description:
      'Engineering health evaluation filters. Supports comparing a current window against a previous window.',
    additionalProperties: false,
    properties: {
      project: {
        type: 'string',
        description: 'Optional github_repository project name from smm_config.json.',
      },
      timezone: {
        type: 'string',
        description: 'Optional IANA timezone used for date boundaries.',
      },
      metric: {
        type: 'string',
        description:
          'Optional comma-separated metric ids. When omitted, all metrics (or those in the category) are evaluated.',
      },
      category: {
        type: 'string',
        enum: ['delivery', 'quality', 'collaboration', 'architecture'],
        description: 'Optional category filter to evaluate only metrics in that category.',
      },
      startDate: {
        type: 'string',
        description: 'Current window start date (YYYY-MM-DD or ISO 8601).',
      },
      endDate: {
        type: 'string',
        description: 'Current window end date (YYYY-MM-DD or ISO 8601).',
      },
      compareStartDate: {
        type: 'string',
        description: 'Previous window start date to compute trend deltas.',
      },
      compareEndDate: {
        type: 'string',
        description: 'Previous window end date to compute trend deltas.',
      },
      prLabels: {
        type: 'string',
        description: 'Optional comma-separated PR labels filter (PR metrics only).',
      },
      rawFilters: {
        type: 'string',
        description: 'Optional raw provider filters string passed through to the provider.',
      },
      period: {
        type: 'string',
        enum: ['day', 'week', 'month'],
        description: 'Aggregation period for time series. Defaults to week.',
      },
      weekends: {
        type: 'string',
        enum: ['include', 'exclude', 'weekends_only'],
        description: 'Weekend handling mode. Defaults to include.',
      },
      outlierMode: {
        type: 'string',
        enum: ['include', 'flag', 'exclude'],
        description: 'Outlier handling mode. Defaults to include.',
      },
    },
  };
}

export function buildDoraMetricsInputSchema(): JsonObject {
  return {
    type: 'object',
    description: 'DORA and pipeline metric filters.',
    additionalProperties: false,
    properties: {
      project: {
        type: 'string',
        description: 'Optional github_repository project name from smm_config.json.',
      },
      timezone: {
        type: 'string',
        description: 'Optional IANA timezone used for date boundaries.',
      },
      startDate: {
        type: 'string',
        description: 'Optional ISO 8601 start date.',
      },
      endDate: {
        type: 'string',
        description: 'Optional ISO 8601 end date.',
      },
      workflowPath: {
        type: 'string',
        description: 'Optional workflow file path filter (e.g. .github/workflows/ci.yml).',
      },
      status: {
        type: 'string',
        description: 'Optional pipeline run status filter (e.g. completed, in_progress).',
      },
      conclusion: {
        type: 'string',
        description: 'Optional pipeline run conclusion filter (e.g. success, failure).',
      },
      branch: {
        type: 'string',
        description: 'Optional target branch filter (e.g. main).',
      },
      jobName: {
        type: 'string',
        description: 'Optional job name filter.',
      },
      event: {
        type: 'string',
        description: 'Optional event trigger filter (e.g. push, pull_request).',
      },
      weekends: {
        type: 'string',
        enum: ['include', 'exclude', 'weekends_only'],
        description: 'Weekend handling mode. Defaults to include.',
      },
      outlierMode: {
        type: 'string',
        enum: ['include', 'flag', 'exclude'],
        description: 'Outlier handling mode. Defaults to include.',
      },
    },
  };
}

export function buildArchitectureViewInputSchema(): JsonObject {
  return {
    type: 'object',
    description: 'Architecture view filters.',
    additionalProperties: false,
    properties: {
      project: {
        type: 'string',
        description: 'Optional github_repository project name from smm_config.json.',
      },
      level: {
        type: 'string',
        enum: ['context', 'container', 'component', 'code'],
        description: 'Architecture view level. Defaults to container.',
      },
      snapshotId: {
        type: 'string',
        description: 'Optional snapshot id. Defaults to the latest snapshot when omitted.',
      },
      includePatterns: {
        type: 'string',
        description: 'Optional comma or newline separated file patterns to include.',
      },
      ignorePatterns: {
        type: 'string',
        description: 'Optional comma or newline separated file patterns to ignore.',
      },
    },
  };
}

export const ENGINEERING_HEALTH_CATEGORIES = [
  'delivery',
  'quality',
  'collaboration',
  'architecture',
] as const;

export const ENGINEERING_HEALTH_METRICS = [
  { id: 'deployment-frequency', category: 'delivery', label: 'Deployment frequency' },
  { id: 'lead-time', category: 'delivery', label: 'Lead time for changes' },
  { id: 'pipeline-duration', category: 'delivery', label: 'Pipeline duration' },
  { id: 'failure-rate', category: 'delivery', label: 'Change failure rate' },
  { id: 'complexity', category: 'quality', label: 'Cognitive complexity' },
  { id: 'duplication', category: 'quality', label: 'Code duplication' },
  { id: 'coverage', category: 'quality', label: 'Test coverage' },
  { id: 'review-time', category: 'collaboration', label: 'Review time' },
  { id: 'review-participation', category: 'collaboration', label: 'Review participation' },
  { id: 'pair-programming', category: 'collaboration', label: 'Pair programming index' },
  { id: 'knowledge-distribution', category: 'collaboration', label: 'Knowledge distribution' },
  { id: 'coupling', category: 'architecture', label: 'File coupling' },
  { id: 'ownership', category: 'architecture', label: 'Code ownership' },
  { id: 'components', category: 'architecture', label: 'Component structure' },
] as const;

export type EngineeringHealthMetricCatalogEntry = {
  id: string;
  category: string;
  label: string;
};

export function listEngineeringHealthMetricCatalog(): EngineeringHealthMetricCatalogEntry[] {
  return ENGINEERING_HEALTH_METRICS.map((entry) => ({
    id: entry.id,
    category: entry.category,
    label: entry.label,
  }));
}

export { parseCsvList };
