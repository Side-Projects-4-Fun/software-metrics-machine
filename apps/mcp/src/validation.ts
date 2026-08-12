import type { JsonObject } from './mcp-types';

export type MetricsToolArguments = {
  project?: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
};

export type ChangeRequestMetricsArguments = MetricsToolArguments & {
  authors?: string;
  excludeAuthors?: string;
  excludeCommenters?: string;
  labels?: string;
  status?: string;
  aggregateBy?: 'day' | 'week' | 'month';
  top?: number;
  method?: 'average' | 'median' | 'p75' | 'p90' | 'p95' | 'min' | 'max';
  weekends?: 'include' | 'exclude' | 'weekends_only';
  outlierMode?: 'include' | 'flag' | 'exclude';
};

export type PipelineDashboardArguments = MetricsToolArguments & {
  workflowPath?: string;
  status?: string;
  conclusion?: string;
  branch?: string;
  jobName?: string;
  jobConclusion?: string;
  event?: string;
  method?: 'average' | 'median' | 'p75' | 'p90' | 'p95' | 'min' | 'max';
  weekends?: 'include' | 'exclude' | 'weekends_only';
  outlierMode?: 'include' | 'flag' | 'exclude';
};

export type CodeEntityArguments = MetricsToolArguments & {
  ignorePatterns?: string;
  includePatterns?: string;
  top?: number;
  authors?: string;
};

export type CodeHistoryArguments = MetricsToolArguments;

export type EngineeringHealthArguments = {
  project?: string;
  timezone?: string;
  metric?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  compareStartDate?: string;
  compareEndDate?: string;
  changeRequestLabels?: string;
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

export type BigOFileArguments = {
  project?: string;
  search?: string;
  ignorePatterns?: string;
  includePatterns?: string;
  limit?: number;
};

export type BigOAnalyzeArguments = {
  project?: string;
  filePath: string;
};

export type HealthCheckArguments = {
  project?: string;
  providerFilter?: string;
  maxGapDays?: number;
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

function readNumber(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  // Non-numeric inputs (e.g. "ten", "all") are ignored rather than rejected so
  // the caller can fall back to the service default.
  void fieldName;
  return undefined;
}

function readBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  throw new Error(`${fieldName} must be a boolean`);
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
    changeRequestLabels: readString(args.changeRequestLabels, 'changeRequestLabels'),
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

export const METRIC_METHOD_VALUES = [
  'average',
  'median',
  'p75',
  'p90',
  'p95',
  'min',
  'max',
] as const;

export type MetricMethodValue = (typeof METRIC_METHOD_VALUES)[number];

export function parseChangeRequestMetricsArguments(
  argumentsValue: unknown
): ChangeRequestMetricsArguments {
  const args = readObject(argumentsValue);
  if (!args) {
    return {};
  }

  return {
    ...parseMetricsToolArguments(args),
    authors: readString(args.authors, 'authors'),
    excludeAuthors: readString(args.excludeAuthors, 'excludeAuthors'),
    excludeCommenters: readString(args.excludeCommenters, 'excludeCommenters'),
    labels: readString(args.labels, 'labels'),
    status: readString(args.status, 'status'),
    aggregateBy: readEnum(args.aggregateBy, 'aggregateBy', ['day', 'week', 'month'] as const),
    top: readNumber(args.top, 'top'),
    method: readEnum(args.method, 'method', METRIC_METHOD_VALUES),
    weekends: readEnum(args.weekends, 'weekends', ['include', 'exclude', 'weekends_only'] as const),
    outlierMode: readEnum(args.outlierMode, 'outlierMode', ['include', 'flag', 'exclude'] as const),
  };
}

export function parsePipelineDashboardArguments(
  argumentsValue: unknown
): PipelineDashboardArguments {
  const args = readObject(argumentsValue);
  if (!args) {
    return {};
  }

  return {
    ...parseMetricsToolArguments(args),
    workflowPath: readString(args.workflowPath, 'workflowPath'),
    status: readString(args.status, 'status'),
    conclusion: readString(args.conclusion, 'conclusion'),
    branch: readString(args.branch, 'branch'),
    jobName: readString(args.jobName, 'jobName'),
    jobConclusion: readString(args.jobConclusion, 'jobConclusion'),
    event: readString(args.event, 'event'),
    method: readEnum(args.method, 'method', METRIC_METHOD_VALUES),
    weekends: readEnum(args.weekends, 'weekends', ['include', 'exclude', 'weekends_only'] as const),
    outlierMode: readEnum(args.outlierMode, 'outlierMode', ['include', 'flag', 'exclude'] as const),
  };
}

export function parseCodeEntityArguments(argumentsValue: unknown): CodeEntityArguments {
  const args = readObject(argumentsValue);
  if (!args) {
    return {};
  }

  return {
    ...parseMetricsToolArguments(args),
    ignorePatterns: readString(args.ignorePatterns, 'ignorePatterns'),
    includePatterns: readString(args.includePatterns, 'includePatterns'),
    top: readNumber(args.top, 'top'),
    authors: readString(args.authors, 'authors'),
  };
}

export function parseCodeHistoryArguments(argumentsValue: unknown): CodeHistoryArguments {
  const args = readObject(argumentsValue);
  if (!args) {
    return {};
  }

  return parseMetricsToolArguments(args);
}

export type SonarqubeComponentTreeArguments = {
  project?: string;
  component?: string;
  depth?: number;
  metrics?: string;
  ignoreFiles?: string;
  includeFiles?: string;
  removeFolders?: boolean;
};

export function parseSonarqubeComponentTreeArguments(
  argumentsValue: unknown
): SonarqubeComponentTreeArguments {
  const args = readObject(argumentsValue);
  if (!args) {
    return {};
  }

  return {
    project: readString(args.project, 'project'),
    component: readString(args.component, 'component'),
    depth: readNumber(args.depth, 'depth'),
    metrics: readString(args.metrics, 'metrics'),
    ignoreFiles: readString(args.ignoreFiles, 'ignoreFiles'),
    includeFiles: readString(args.includeFiles, 'includeFiles'),
    removeFolders: readBoolean(args.removeFolders, 'removeFolders'),
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

export function parseBigOFileArguments(argumentsValue: unknown): BigOFileArguments {
  const args = readObject(argumentsValue);
  if (!args) {
    return {};
  }

  return {
    project: readString(args.project, 'project'),
    search: readString(args.search, 'search'),
    ignorePatterns: readString(args.ignorePatterns, 'ignorePatterns'),
    includePatterns: readString(args.includePatterns, 'includePatterns'),
    limit: typeof args.limit === 'number' ? args.limit : undefined,
  };
}

export function parseBigOAnalyzeArguments(argumentsValue: unknown): BigOAnalyzeArguments {
  const args = readObject(argumentsValue);
  if (!args) {
    throw new Error('filePath is required');
  }

  const filePath = readString(args.filePath, 'filePath');
  if (!filePath) {
    throw new Error('filePath is required');
  }

  return {
    project: readString(args.project, 'project'),
    filePath,
  };
}

export function parseHealthCheckArguments(argumentsValue: unknown): HealthCheckArguments {
  const args = readObject(argumentsValue);
  if (!args) {
    return {};
  }

  return {
    project: readString(args.project, 'project'),
    providerFilter: readString(args.providerFilter, 'providerFilter'),
    maxGapDays: typeof args.maxGapDays === 'number' ? args.maxGapDays : undefined,
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
      changeRequestLabels: {
        type: 'string',
        description:
          'Optional comma-separated change request labels filter (change request metrics only).',
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

export function buildBigOListInputSchema(): JsonObject {
  return {
    type: 'object',
    description: 'Big-O file listing filters.',
    additionalProperties: false,
    properties: {
      project: {
        type: 'string',
        description: 'Optional github_repository project name from smm_config.json.',
      },
      search: {
        type: 'string',
        description: 'Optional search string to filter file paths.',
      },
      ignorePatterns: {
        type: 'string',
        description: 'Optional comma or newline separated file patterns to ignore.',
      },
      includePatterns: {
        type: 'string',
        description: 'Optional comma or newline separated file patterns to include.',
      },
      limit: {
        type: 'number',
        description: 'Optional maximum number of files to return. Defaults to 200.',
      },
    },
  };
}

export function buildBigOAnalyzeInputSchema(): JsonObject {
  return {
    type: 'object',
    description: 'Big-O file analysis input.',
    additionalProperties: false,
    required: ['filePath'],
    properties: {
      project: {
        type: 'string',
        description: 'Optional github_repository project name from smm_config.json.',
      },
      filePath: {
        type: 'string',
        description: 'Required path to the file to analyze for Big-O complexity.',
      },
    },
  };
}

export function buildHealthCheckInputSchema(): JsonObject {
  return {
    type: 'object',
    description: 'Health check report filters.',
    additionalProperties: false,
    properties: {
      project: {
        type: 'string',
        description: 'Optional github_repository project name from smm_config.json.',
      },
      providerFilter: {
        type: 'string',
        description: 'Optional provider filter (e.g. github, jira, sonarqube). Defaults to all.',
      },
      maxGapDays: {
        type: 'number',
        description: 'Optional maximum gap days threshold for warnings. Defaults to 30.',
      },
    },
  };
}

export function buildEvaluationInputSchema(description: string): JsonObject {
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

export function buildChangeRequestMetricsInputSchema(description: string): JsonObject {
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
      authors: {
        type: 'string',
        description: 'Optional comma-separated change request authors to include.',
      },
      excludeAuthors: {
        type: 'string',
        description: 'Optional comma-separated change request authors to exclude.',
      },
      excludeCommenters: {
        type: 'string',
        description: 'Optional comma-separated change request commenters to exclude.',
      },
      labels: {
        type: 'string',
        description: 'Optional comma-separated change request labels to filter by.',
      },
      status: {
        type: 'string',
        description: 'Optional change request state filter (open, closed, merged, draft).',
      },
      aggregateBy: {
        type: 'string',
        enum: ['day', 'week', 'month'],
        description: 'Optional aggregation period for through-time / open-time metrics.',
      },
      top: {
        type: 'number',
        description: 'Optional maximum number of authors/rows to return. Defaults to 10.',
      },
      method: {
        type: 'string',
        enum: [...METRIC_METHOD_VALUES],
        description: 'Optional statistical method for review/open/comments metrics.',
      },
      weekends: {
        type: 'string',
        enum: ['include', 'exclude', 'weekends_only'],
        description: 'Optional weekend handling mode.',
      },
      outlierMode: {
        type: 'string',
        enum: ['include', 'flag', 'exclude'],
        description: 'Optional outlier handling mode.',
      },
    },
  };
}

export function buildPipelineDashboardInputSchema(description: string): JsonObject {
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
      jobConclusion: {
        type: 'string',
        description: 'Optional job conclusion filter (e.g. success, failure).',
      },
      event: {
        type: 'string',
        description: 'Optional event trigger filter (e.g. push, pull_request).',
      },
      method: {
        type: 'string',
        enum: [...METRIC_METHOD_VALUES],
        description: 'Optional statistical method for duration metrics.',
      },
      weekends: {
        type: 'string',
        enum: ['include', 'exclude', 'weekends_only'],
        description: 'Optional weekend handling mode.',
      },
      outlierMode: {
        type: 'string',
        enum: ['include', 'flag', 'exclude'],
        description: 'Optional outlier handling mode.',
      },
    },
  };
}

export function buildCodeEntityInputSchema(description: string): JsonObject {
  return {
    type: 'object',
    description,
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
      ignorePatterns: {
        type: 'string',
        description: 'Optional comma or newline separated file patterns to ignore.',
      },
      includePatterns: {
        type: 'string',
        description: 'Optional comma or newline separated file patterns to include.',
      },
      top: {
        type: 'number',
        description: 'Optional maximum number of entities to return.',
      },
      authors: {
        type: 'string',
        description: 'Optional comma-separated authors filter (entity ownership only).',
      },
    },
  };
}

export function buildCodeHistoryInputSchema(description: string): JsonObject {
  return {
    type: 'object',
    description,
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
    },
  };
}

export function buildSonarqubeComponentTreeInputSchema(description: string): JsonObject {
  return {
    type: 'object',
    description,
    additionalProperties: false,
    properties: {
      project: {
        type: 'string',
        description: 'Optional github_repository project name from smm_config.json.',
      },
      component: {
        type: 'string',
        description: 'Optional SonarQube component key (defaults to configured project).',
      },
      depth: {
        type: 'number',
        description: 'Optional depth of tree traversal (-1 for all depths).',
      },
      metrics: {
        type: 'string',
        description: 'Optional comma-separated SonarQube metrics (e.g. complexity,coverage).',
      },
      ignoreFiles: {
        type: 'string',
        description: 'Optional comma-separated file/component ignore patterns (glob).',
      },
      includeFiles: {
        type: 'string',
        description: 'Optional comma-separated file/component include patterns (glob).',
      },
      removeFolders: {
        type: 'boolean',
        description: 'Optional. Remove directory components (type=DIR) from results.',
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
