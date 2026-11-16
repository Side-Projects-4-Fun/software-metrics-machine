import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { FailureRateMetric } from '../adapters/delivery';
import { OwnershipMetric } from '../adapters/architecture';
import { KnowledgeDistributionMetric } from '../adapters/collaboration';
import type { EngineeringHealthDependencies } from '../dependencies';
import { PipelinesService } from '../../domain/pipelines/services/pipelines-service';
import type { PipelineRun } from '../../domain/pipelines/pipeline-types';
import { PipelineRunBuilder } from '../../test/domain/domain-builders';
import { PipelinesRepositoryBuilder } from '../../test/repositories/repository-builders';
import { MockLoggerBuilder } from '../../test/infrastructure/mock-logger-builder';
import { TimeZoneProvider } from '../../infrastructure/timezone-provider';

/**
 * Property-based tests for the engineering-health adapters that reduce a set
 * of rows into a single percentage. Each encodes the catalog formula as an
 * independent oracle and checks the running adapter against arbitrary inputs.
 *
 * - FailureRateMetric: failed ÷ total × 100
 * - OwnershipMetric:     top contributor's touched lines ÷ total × 100
 * - KnowledgeDistributionMetric: 100 − (top contributor's share)
 */

interface RunModel {
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | null;
}

interface OwnershipModel {
  author: string;
  added: number;
  deleted: number;
}

interface OwnershipRow extends OwnershipModel {
  entity: string;
}

const logger = new MockLoggerBuilder().build();

const runModelArbitrary = fc.array(
  fc.record({
    conclusion: fc.constantFrom('success', 'failure', 'cancelled', 'skipped', 'timed_out', null),
  }),
  { minLength: 1, maxLength: 40 }
);

const ownershipArbitrary = fc.array(
  fc.record({
    author: fc.constantFrom('alice', 'bob', 'carol'),
    added: fc.nat({ max: 100 }),
    deleted: fc.nat({ max: 100 }),
  }),
  { minLength: 1, maxLength: 30 }
);

function toRun(model: RunModel, index: number): PipelineRun {
  const run = new PipelineRunBuilder()
    .withId(`run-${index}`)
    .withNumber(index + 1)
    .withConclusion(model.conclusion ?? 'success')
    .build();
  if (model.conclusion === null) {
    run.conclusion = undefined;
  }
  return run;
}

function toOwnershipRows(models: OwnershipModel[]): OwnershipRow[] {
  return models.map((model, index) => ({ entity: `file-${index}`, ...model }));
}

function buildDependencies(
  overrides: Partial<EngineeringHealthDependencies>
): EngineeringHealthDependencies {
  return {
    deploymentTargets: [],
    pipelinesService: {} as never,
    deploymentFrequencyService: {} as never,
    pipelineImplementation: {} as never,
    changeRequestsService: {} as never,
    pairingService: {} as never,
    codemaatService: {} as never,
    sonarQubeService: {} as never,
    architectureService: {} as never,
    ...overrides,
  } as EngineeringHealthDependencies;
}

function buildFailureRateMetric(models: RunModel[]): FailureRateMetric {
  const repo = new PipelinesRepositoryBuilder().withPipelineRuns(models.map(toRun)).build();
  const pipelinesService = new PipelinesService(
    repo,
    undefined,
    logger,
    new TimeZoneProvider('UTC')
  );
  return new FailureRateMetric(buildDependencies({ pipelinesService }));
}

function buildOwnershipMetric(rows: OwnershipRow[]): OwnershipMetric {
  const codemaatService = { getEntityOwnership: vi.fn(async () => rows) } as never;
  return new OwnershipMetric(buildDependencies({ codemaatService }));
}

function buildKnowledgeDistributionMetric(rows: OwnershipRow[]): KnowledgeDistributionMetric {
  const codemaatService = { getEntityOwnership: vi.fn(async () => rows) } as never;
  return new KnowledgeDistributionMetric(buildDependencies({ codemaatService }));
}

function failedCount(models: RunModel[]): number {
  return models.filter((model) => model.conclusion === 'failure').length;
}

function topOwnerShare(rows: Array<{ author: string; added: number; deleted: number }>): number {
  let total = 0;
  const byAuthor = new Map<string, number>();
  for (const row of rows) {
    const touched = row.added + row.deleted;
    total += touched;
    byAuthor.set(row.author, (byAuthor.get(row.author) ?? 0) + touched);
  }
  if (total === 0) {
    return 0;
  }
  return Math.max(...Array.from(byAuthor.values()).map((value) => (value / total) * 100));
}

function requireNumber(value: number | null): number {
  if (value === null) {
    throw new Error('expected a numeric metric value');
  }
  return value;
}

function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.011);
}

describe('FailureRateMetric — semantic oracle', () => {
  it('computes failure rate as failed over total times 100', async () => {
    await fc.assert(
      fc.asyncProperty(runModelArbitrary, async (models) => {
        const result = await buildFailureRateMetric(models).calculate({});

        const expected = models.length > 0 ? (failedCount(models) / models.length) * 100 : 0;
        const value = requireNumber(result.value);

        expectClose(value, expected);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      })
    );
  });
});

describe('OwnershipMetric and KnowledgeDistributionMetric — semantic oracles', () => {
  it('reports the top contributor share as ownership', async () => {
    await fc.assert(
      fc.asyncProperty(ownershipArbitrary, async (models) => {
        const rows = toOwnershipRows(models);
        const result = await buildOwnershipMetric(rows).calculate({});
        const value = requireNumber(result.value);

        expectClose(value, topOwnerShare(rows));
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      })
    );
  });

  it('reports knowledge distribution as 100 minus the top contributor share', async () => {
    await fc.assert(
      fc.asyncProperty(ownershipArbitrary, async (models) => {
        const rows = toOwnershipRows(models);
        const result = await buildKnowledgeDistributionMetric(rows).calculate({});
        const value = requireNumber(result.value);

        expectClose(value, 100 - topOwnerShare(rows));
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      })
    );
  });

  it('keeps ownership and knowledge distribution complementary to 100', async () => {
    await fc.assert(
      fc.asyncProperty(ownershipArbitrary, async (models) => {
        const rows = toOwnershipRows(models);
        const ownership = requireNumber((await buildOwnershipMetric(rows).calculate({})).value);
        const knowledge = requireNumber(
          (await buildKnowledgeDistributionMetric(rows).calculate({})).value
        );

        expectClose(ownership + knowledge, 100);
      })
    );
  });
});
