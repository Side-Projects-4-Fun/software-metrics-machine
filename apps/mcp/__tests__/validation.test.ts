import { describe, expect, it } from 'vitest';
import {
  buildBigOAnalyzeInputSchema,
  buildBigOListInputSchema,
  buildChangeRequestMetricsInputSchema,
  buildCodeEntityInputSchema,
  buildCodeHistoryInputSchema,
  buildEngineeringHealthInputSchema,
  buildEvaluationInputSchema,
  buildHealthCheckInputSchema,
  buildPipelineDashboardInputSchema,
  buildSonarqubeComponentTreeInputSchema,
  parseArchitectureViewArguments,
  parseBigOAnalyzeArguments,
  parseBigOFileArguments,
  parseChangeRequestMetricsArguments,
  parseCodeEntityArguments,
  parseCodeHistoryArguments,
  parseCodeMetricsArguments,
  parseDoraMetricsArguments,
  parseEngineeringHealthArguments,
  parseHealthCheckArguments,
  parseIssueMetricsArguments,
  parseMetricsToolArguments,
  parsePipelineDashboardArguments,
  parseSonarqubeComponentTreeArguments,
} from '../src/validation';

describe('parseMetricsToolArguments', () => {
  it('returns an empty object for non-object input', () => {
    expect(parseMetricsToolArguments(null)).toEqual({});
    expect(parseMetricsToolArguments([])).toEqual({});
    expect(parseMetricsToolArguments(undefined)).toEqual({});
  });

  it('trims and returns string fields', () => {
    expect(
      parseMetricsToolArguments({
        project: ' owner/repo ',
        startDate: ' 2026-07-01 ',
        endDate: '2026-07-31',
        timezone: 'Europe/Madrid',
      })
    ).toEqual({
      project: 'owner/repo',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      timezone: 'Europe/Madrid',
    });
  });
});

describe('parseCodeMetricsArguments', () => {
  it('parses code metric filters', () => {
    expect(
      parseCodeMetricsArguments({
        project: 'owner/repo',
        authors: 'alice, bob',
        includePatterns: 'src/**',
        ignorePatterns: '**/*.spec.ts',
      })
    ).toEqual({
      project: 'owner/repo',
      authors: 'alice, bob',
      includePatterns: 'src/**',
      ignorePatterns: '**/*.spec.ts',
    });
  });
});

describe('parseIssueMetricsArguments', () => {
  it('parses the status filter', () => {
    expect(parseIssueMetricsArguments({ status: 'Done' })).toEqual({ status: 'Done' });
  });
});

describe('parseEngineeringHealthArguments', () => {
  it('normalizes enum values and parses csv metric ids', () => {
    const parsed = parseEngineeringHealthArguments({
      metric: 'deployment-frequency, lead-time',
      category: 'Delivery',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      compareStartDate: '2026-06-01',
      compareEndDate: '2026-06-30',
      weekends: 'Exclude',
      outlierMode: 'Flag',
      period: 'Week',
    });

    expect(parsed).toEqual({
      metric: 'deployment-frequency, lead-time',
      category: 'delivery',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      compareStartDate: '2026-06-01',
      compareEndDate: '2026-06-30',
      weekends: 'exclude',
      outlierMode: 'flag',
      period: 'week',
    });
  });

  it('throws for an unknown category', () => {
    expect(() => parseEngineeringHealthArguments({ category: 'unknown' })).toThrow(
      /category must be one of/
    );
  });

  it('builds an engineering health schema that lists enum values', () => {
    const schema = buildEngineeringHealthInputSchema();
    const properties = (schema.properties ?? {}) as Record<string, { enum?: string[] }>;

    expect(properties.category?.enum).toEqual([
      'delivery',
      'quality',
      'collaboration',
      'architecture',
    ]);
    expect(properties.weekends?.enum).toEqual(['include', 'exclude', 'weekends_only']);
    expect(properties.outlierMode?.enum).toEqual(['include', 'flag', 'exclude']);
  });
});

describe('parseDoraMetricsArguments', () => {
  it('parses pipeline and cleaning filters', () => {
    const parsed = parseDoraMetricsArguments({
      workflowPath: '.github/workflows/deploy.yml',
      status: 'completed',
      conclusion: 'success',
      branch: 'main',
      jobName: 'deploy',
      event: 'push',
      weekends: 'exclude',
      outlierMode: 'flag',
    });

    expect(parsed).toMatchObject({
      workflowPath: '.github/workflows/deploy.yml',
      status: 'completed',
      conclusion: 'success',
      branch: 'main',
      jobName: 'deploy',
      event: 'push',
      weekends: 'exclude',
      outlierMode: 'flag',
    });
  });
});

describe('parseArchitectureViewArguments', () => {
  it('defaults level to undefined when omitted', () => {
    expect(parseArchitectureViewArguments({})).toEqual({});
  });

  it('parses the architecture level enum', () => {
    expect(parseArchitectureViewArguments({ level: 'Container' })).toEqual({ level: 'container' });
  });

  it('rejects an invalid architecture level', () => {
    expect(() => parseArchitectureViewArguments({ level: 'universe' })).toThrow(
      /level must be one of/
    );
  });
});

describe('parseBigOFileArguments', () => {
  it('returns an empty object for non-object input', () => {
    expect(parseBigOFileArguments(null)).toEqual({});
    expect(parseBigOFileArguments(undefined)).toEqual({});
  });

  it('parses search, patterns, and limit', () => {
    expect(
      parseBigOFileArguments({
        project: 'owner/repo',
        search: 'sort',
        ignorePatterns: '**/*.spec.ts',
        includePatterns: 'src/**',
        limit: 50,
      })
    ).toEqual({
      project: 'owner/repo',
      search: 'sort',
      ignorePatterns: '**/*.spec.ts',
      includePatterns: 'src/**',
      limit: 50,
    });
  });

  it('ignores non-number limit values', () => {
    expect(parseBigOFileArguments({ limit: 'fifty' })).toEqual({});
  });

  it('builds a Big-O list schema with expected properties', () => {
    const schema = buildBigOListInputSchema();
    const properties = (schema.properties ?? {}) as Record<string, { type: string }>;
    expect(properties.search?.type).toBe('string');
    expect(properties.limit?.type).toBe('number');
  });
});

describe('parseBigOAnalyzeArguments', () => {
  it('throws when filePath is missing', () => {
    expect(() => parseBigOAnalyzeArguments({})).toThrow(/filePath is required/);
    expect(() => parseBigOAnalyzeArguments(null)).toThrow(/filePath is required/);
  });

  it('parses the filePath and project', () => {
    expect(
      parseBigOAnalyzeArguments({
        project: 'owner/repo',
        filePath: 'src/sort.ts',
      })
    ).toEqual({
      project: 'owner/repo',
      filePath: 'src/sort.ts',
    });
  });

  it('builds a Big-O analyze schema with required filePath', () => {
    const schema = buildBigOAnalyzeInputSchema();
    expect(schema.required).toEqual(['filePath']);
    const properties = (schema.properties ?? {}) as Record<string, { type: string }>;
    expect(properties.filePath?.type).toBe('string');
  });
});

describe('parseHealthCheckArguments', () => {
  it('returns an empty object for non-object input', () => {
    expect(parseHealthCheckArguments(null)).toEqual({});
  });

  it('parses provider filter and max gap days', () => {
    expect(
      parseHealthCheckArguments({
        project: 'owner/repo',
        providerFilter: 'github',
        maxGapDays: 14,
      })
    ).toEqual({
      project: 'owner/repo',
      providerFilter: 'github',
      maxGapDays: 14,
    });
  });

  it('ignores non-number maxGapDays', () => {
    expect(parseHealthCheckArguments({ maxGapDays: 'fourteen' })).toEqual({});
  });

  it('builds a health check schema with expected properties', () => {
    const schema = buildHealthCheckInputSchema();
    const properties = (schema.properties ?? {}) as Record<string, { type: string }>;
    expect(properties.providerFilter?.type).toBe('string');
    expect(properties.maxGapDays?.type).toBe('number');
  });
});

describe('buildEvaluationInputSchema', () => {
  it('includes project, startDate, endDate, and timezone', () => {
    const schema = buildEvaluationInputSchema('Test evaluation.');
    const properties = (schema.properties ?? {}) as Record<string, { type: string }>;
    expect(properties.project?.type).toBe('string');
    expect(properties.startDate?.type).toBe('string');
    expect(properties.endDate?.type).toBe('string');
    expect(properties.timezone?.type).toBe('string');
    expect(schema.description).toBe('Test evaluation.');
  });
});

describe('parseChangeRequestMetricsArguments', () => {
  it('returns an empty object for non-object input', () => {
    expect(parseChangeRequestMetricsArguments(null)).toEqual({});
    expect(parseChangeRequestMetricsArguments(undefined)).toEqual({});
    expect(parseChangeRequestMetricsArguments([])).toEqual({});
  });

  it('parses change request filters including csv lists and enums', () => {
    expect(
      parseChangeRequestMetricsArguments({
        project: 'owner/repo',
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        timezone: 'Europe/Madrid',
        authors: 'alice, bob',
        excludeAuthors: 'carol',
        excludeCommenters: 'dave',
        labels: 'bug, urgent',
        status: 'open',
        aggregateBy: 'week',
        top: 10,
        method: 'median',
        weekends: 'exclude',
        outlierMode: 'flag',
      })
    ).toEqual({
      project: 'owner/repo',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      timezone: 'Europe/Madrid',
      authors: 'alice, bob',
      excludeAuthors: 'carol',
      excludeCommenters: 'dave',
      labels: 'bug, urgent',
      status: 'open',
      aggregateBy: 'week',
      top: 10,
      method: 'median',
      weekends: 'exclude',
      outlierMode: 'flag',
    });
  });

  it('rejects an unknown aggregateBy value', () => {
    expect(() => parseChangeRequestMetricsArguments({ aggregateBy: 'quarter' })).toThrow(
      /aggregateBy must be one of/
    );
  });

  it('rejects an unknown method value', () => {
    expect(() => parseChangeRequestMetricsArguments({ method: 'fastest' })).toThrow(
      /method must be one of/
    );
  });

  it('rejects an unknown weekends value', () => {
    expect(() => parseChangeRequestMetricsArguments({ weekends: 'sometimes' })).toThrow(
      /weekends must be one of/
    );
  });

  it('ignores non-number top values', () => {
    expect(parseChangeRequestMetricsArguments({ top: 'ten' })).toEqual({});
  });

  it('builds a schema that includes change request filter properties', () => {
    const schema = buildChangeRequestMetricsInputSchema('CR filters.');
    const properties = (schema.properties ?? {}) as Record<
      string,
      { type?: string; enum?: string[] }
    >;
    expect(properties.authors?.type).toBe('string');
    expect(properties.excludeAuthors?.type).toBe('string');
    expect(properties.excludeCommenters?.type).toBe('string');
    expect(properties.labels?.type).toBe('string');
    expect(properties.status?.type).toBe('string');
    expect(properties.top?.type).toBe('number');
    expect(properties.aggregateBy?.enum).toEqual(['day', 'week', 'month']);
    expect(properties.method?.enum).toEqual([
      'average',
      'median',
      'p75',
      'p90',
      'p95',
      'min',
      'max',
    ]);
    expect(schema.description).toBe('CR filters.');
  });
});

describe('parsePipelineDashboardArguments', () => {
  it('returns an empty object for non-object input', () => {
    expect(parsePipelineDashboardArguments(null)).toEqual({});
    expect(parsePipelineDashboardArguments(undefined)).toEqual({});
  });

  it('parses pipeline dashboard filters', () => {
    expect(
      parsePipelineDashboardArguments({
        project: 'owner/repo',
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        timezone: 'Europe/Madrid',
        workflowPath: '.github/workflows/ci.yml',
        status: 'completed',
        conclusion: 'success',
        branch: 'main',
        jobName: 'build',
        jobConclusion: 'success',
        event: 'push',
        method: 'p95',
        weekends: 'exclude',
        outlierMode: 'flag',
      })
    ).toEqual({
      project: 'owner/repo',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      timezone: 'Europe/Madrid',
      workflowPath: '.github/workflows/ci.yml',
      status: 'completed',
      conclusion: 'success',
      branch: 'main',
      jobName: 'build',
      jobConclusion: 'success',
      event: 'push',
      method: 'p95',
      weekends: 'exclude',
      outlierMode: 'flag',
    });
  });

  it('rejects an unknown method value', () => {
    expect(() => parsePipelineDashboardArguments({ method: 'fastest' })).toThrow(
      /method must be one of/
    );
  });

  it('builds a pipeline dashboard schema with expected properties', () => {
    const schema = buildPipelineDashboardInputSchema('Pipeline dashboard.');
    const properties = (schema.properties ?? {}) as Record<
      string,
      { type?: string; enum?: string[] }
    >;
    expect(properties.workflowPath?.type).toBe('string');
    expect(properties.jobName?.type).toBe('string');
    expect(properties.jobConclusion?.type).toBe('string');
    expect(properties.method?.enum).toEqual([
      'average',
      'median',
      'p75',
      'p90',
      'p95',
      'min',
      'max',
    ]);
    expect(schema.description).toBe('Pipeline dashboard.');
  });
});

describe('parseCodeEntityArguments', () => {
  it('returns an empty object for non-object input', () => {
    expect(parseCodeEntityArguments(null)).toEqual({});
    expect(parseCodeEntityArguments(undefined)).toEqual({});
  });

  it('parses entity filter options', () => {
    expect(
      parseCodeEntityArguments({
        project: 'owner/repo',
        ignorePatterns: '**/*.spec.ts',
        includePatterns: 'src/**',
        top: 15,
        authors: 'alice',
      })
    ).toEqual({
      project: 'owner/repo',
      ignorePatterns: '**/*.spec.ts',
      includePatterns: 'src/**',
      top: 15,
      authors: 'alice',
    });
  });

  it('ignores non-number top value', () => {
    expect(parseCodeEntityArguments({ top: 'fifteen' })).toEqual({});
  });

  it('builds a code entity schema with expected properties', () => {
    const schema = buildCodeEntityInputSchema('Entity filters.');
    const properties = (schema.properties ?? {}) as Record<string, { type?: string }>;
    expect(properties.ignorePatterns?.type).toBe('string');
    expect(properties.includePatterns?.type).toBe('string');
    expect(properties.top?.type).toBe('number');
    expect(properties.authors?.type).toBe('string');
    expect(schema.description).toBe('Entity filters.');
  });
});

describe('parseCodeHistoryArguments', () => {
  it('returns an empty object for non-object input', () => {
    expect(parseCodeHistoryArguments(null)).toEqual({});
    expect(parseCodeHistoryArguments(undefined)).toEqual({});
  });

  it('parses start/end date filters', () => {
    expect(
      parseCodeHistoryArguments({
        project: 'owner/repo',
        startDate: '2026-01-01',
        endDate: '2026-07-31',
      })
    ).toEqual({
      project: 'owner/repo',
      startDate: '2026-01-01',
      endDate: '2026-07-31',
    });
  });

  it('builds a code history schema with date properties', () => {
    const schema = buildCodeHistoryInputSchema('History filters.');
    const properties = (schema.properties ?? {}) as Record<string, { type?: string }>;
    expect(properties.startDate?.type).toBe('string');
    expect(properties.endDate?.type).toBe('string');
    expect(schema.description).toBe('History filters.');
  });
});

describe('parseSonarqubeComponentTreeArguments', () => {
  it('returns an empty object for non-object input', () => {
    expect(parseSonarqubeComponentTreeArguments(null)).toEqual({});
    expect(parseSonarqubeComponentTreeArguments(undefined)).toEqual({});
  });

  it('parses component tree filters and numeric depth', () => {
    expect(
      parseSonarqubeComponentTreeArguments({
        project: 'owner/repo',
        component: 'acme:widgets',
        depth: -1,
        metrics: 'complexity,coverage',
        ignoreFiles: '*.spec.ts',
        includeFiles: 'src/**',
        removeFolders: true,
      })
    ).toEqual({
      project: 'owner/repo',
      component: 'acme:widgets',
      depth: -1,
      metrics: 'complexity,coverage',
      ignoreFiles: '*.spec.ts',
      includeFiles: 'src/**',
      removeFolders: true,
    });
  });

  it('ignores non-number depth value', () => {
    expect(parseSonarqubeComponentTreeArguments({ depth: 'all' })).toEqual({});
  });

  it('normalizes removeFolders to a boolean', () => {
    expect(parseSonarqubeComponentTreeArguments({ removeFolders: 'true' })).toEqual({
      removeFolders: true,
    });
    expect(parseSonarqubeComponentTreeArguments({ removeFolders: 'false' })).toEqual({
      removeFolders: false,
    });
    expect(parseSonarqubeComponentTreeArguments({ removeFolders: true })).toEqual({
      removeFolders: true,
    });
  });

  it('builds a component tree schema with expected properties', () => {
    const schema = buildSonarqubeComponentTreeInputSchema('Component tree.');
    const properties = (schema.properties ?? {}) as Record<string, { type?: string }>;
    expect(properties.component?.type).toBe('string');
    expect(properties.depth?.type).toBe('number');
    expect(properties.metrics?.type).toBe('string');
    expect(properties.ignoreFiles?.type).toBe('string');
    expect(properties.includeFiles?.type).toBe('string');
    expect(properties.removeFolders?.type).toBe('boolean');
    expect(schema.description).toBe('Component tree.');
  });
});
