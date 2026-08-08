import { describe, expect, it } from 'vitest';
import {
  buildBigOAnalyzeInputSchema,
  buildBigOListInputSchema,
  buildEngineeringHealthInputSchema,
  buildEvaluationInputSchema,
  buildHealthCheckInputSchema,
  parseArchitectureViewArguments,
  parseBigOAnalyzeArguments,
  parseBigOFileArguments,
  parseCodeMetricsArguments,
  parseDoraMetricsArguments,
  parseEngineeringHealthArguments,
  parseHealthCheckArguments,
  parseIssueMetricsArguments,
  parseMetricsToolArguments,
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
