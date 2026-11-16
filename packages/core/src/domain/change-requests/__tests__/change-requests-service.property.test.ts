import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ChangeRequestsService } from '..';
import type { ChangeRequestDetails } from '../change-request-types';
import { ChangeRequestBuilder } from '../../../test/domain/domain-builders';
import { ReadChangeRequestsRepositoryBuilder } from '../../../test/repositories/repository-builders';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';
import { TimeZoneProvider } from '../../../infrastructure/timezone-provider';

/**
 * Property-based tests for ChangeRequestsService.
 *
 * These encode the semantic contract from the metric catalog (e.g.
 * "total = merged + closed + open", "comments = mean of comments",
 * "open days = mean of creation-to-merge days") as an independent oracle and
 * check the running service against it for arbitrary inputs. The generated
 * model uses whole-day offsets so every date arithmetic is exact.
 *
 * Test bodies stay declarative: each is a single `fc.assert(...)` call, and
 * all model/oracle logic lives in the named helpers below.
 */

interface CrModel {
  author: string;
  comments: number;
  createdOffsetDays: number;
  conclusion: 'open' | 'merged' | 'closed';
  afterDays: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const BASE_MS = Date.UTC(2025, 0, 1);

const logger = new MockLoggerBuilder().build();

const crModelArbitrary = fc.array(
  fc.record({
    author: fc.constantFrom('alice', 'bob', 'carol'),
    comments: fc.nat({ max: 50 }),
    createdOffsetDays: fc.nat({ max: 365 }),
    conclusion: fc.constantFrom('open', 'merged', 'closed'),
    afterDays: fc.nat({ max: 30 }),
  }),
  { minLength: 1, maxLength: 30 }
);

function isoAt(offsetDays: number): string {
  return new Date(BASE_MS + offsetDays * DAY_MS).toISOString();
}

function toChangeRequest(model: CrModel, index: number): ChangeRequestDetails {
  const createdAt = isoAt(model.createdOffsetDays);
  const builder = new ChangeRequestBuilder()
    .withId(index + 1)
    .withNumber(index + 1)
    .withAuthor(model.author, index + 1)
    .withTitle(`Change request ${index + 1}`)
    .withCreatedAt(createdAt)
    .withUpdatedAt(createdAt)
    .withComments(model.comments);

  if (model.conclusion === 'merged') {
    builder.withMergedAt(isoAt(model.createdOffsetDays + model.afterDays));
  } else if (model.conclusion === 'closed') {
    builder.withClosedAt(isoAt(model.createdOffsetDays + model.afterDays));
  }

  return builder.build();
}

function buildService(models: CrModel[]): ChangeRequestsService {
  const changeRequests = models.map(toChangeRequest);
  const repo = new ReadChangeRequestsRepositoryBuilder().withChangeRequests(changeRequests).build();
  return new ChangeRequestsService(repo, new TimeZoneProvider('UTC'), logger);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function meanOf(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function countOf(models: CrModel[], conclusion: CrModel['conclusion']): number {
  return models.filter((model) => model.conclusion === conclusion).length;
}

function expectedComments(models: CrModel[]): number {
  return round2(meanOf(models.map((model) => model.comments)));
}

function expectedOpenDays(models: CrModel[]): number {
  const mergedAfterDays = models
    .filter((model) => model.conclusion === 'merged')
    .map((model) => model.afterDays);
  return round2(meanOf(mergedAfterDays));
}

async function assertMetricsMatchOracle(models: CrModel[]): Promise<void> {
  const metrics = await buildService(models).getMetrics();

  expect(metrics.totalChangeRequests).toBe(models.length);
  expect(metrics.mergedChangeRequests).toBe(countOf(models, 'merged'));
  expect(metrics.closedChangeRequests).toBe(countOf(models, 'closed'));
  expect(metrics.openChangeRequests).toBe(countOf(models, 'open'));
  expect(metrics.comments).toBeCloseTo(expectedComments(models), 5);
  expect(metrics.openDays).toBeCloseTo(expectedOpenDays(models), 5);
  expect(metrics.leadTime).toBe(metrics.openDays);
}

async function assertReviewTimeMatchesOracle(models: CrModel[]): Promise<void> {
  const rows = await buildService(models).getReviewTime(undefined, 100);

  const daysByAuthor = new Map<string, number[]>();
  for (const model of models) {
    if (model.conclusion === 'open') {
      continue;
    }
    const existing = daysByAuthor.get(model.author) ?? [];
    existing.push(model.afterDays);
    daysByAuthor.set(model.author, existing);
  }

  for (const row of rows) {
    expect(row.value).toBeCloseTo(meanOf(daysByAuthor.get(row.author) ?? []), 5);
  }
}

async function assertByAuthorSumsToTotal(models: CrModel[]): Promise<void> {
  const rows = await buildService(models).getByAuthor(undefined, 100);
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  expect(total).toBe(models.length);
}

async function assertThroughTimeSumsToTotal(models: CrModel[]): Promise<void> {
  const rows = await buildService(models).getThroughTime(undefined, 'day');
  const opened = rows
    .filter((row) => row.kind === 'Opened')
    .reduce((sum, row) => sum + row.count, 0);
  const closed = rows
    .filter((row) => row.kind === 'Closed')
    .reduce((sum, row) => sum + row.count, 0);
  const concluded = countOf(models, 'merged') + countOf(models, 'closed');

  expect(opened).toBe(models.length);
  expect(closed).toBe(concluded);
}

describe('ChangeRequestsService — semantic oracles', () => {
  it('partitions every change request into exactly one state', async () => {
    await fc.assert(
      fc.asyncProperty(crModelArbitrary, async (models) => {
        const metrics = await buildService(models).getMetrics();
        expect(metrics.totalChangeRequests).toBe(
          metrics.mergedChangeRequests + metrics.closedChangeRequests + metrics.openChangeRequests
        );
      })
    );
  });

  it('computes comments as the mean of change-request comment counts', async () => {
    await fc.assert(
      fc.asyncProperty(crModelArbitrary, async (models) => {
        const metrics = await buildService(models).getMetrics();
        expect(metrics.comments).toBeCloseTo(expectedComments(models), 5);
      })
    );
  });

  it('computes open days from merged change requests only', async () => {
    await fc.assert(
      fc.asyncProperty(crModelArbitrary, async (models) => {
        const metrics = await buildService(models).getMetrics();
        expect(metrics.openDays).toBeCloseTo(expectedOpenDays(models), 5);
        expect(metrics.leadTime).toBe(metrics.openDays);
      })
    );
  });

  it('computes review time per author from concluded change requests', async () => {
    await fc.assert(
      fc.asyncProperty(crModelArbitrary, async (models) => {
        await assertReviewTimeMatchesOracle(models);
      })
    );
  });

  it('reports author counts that sum to the total', async () => {
    await fc.assert(
      fc.asyncProperty(crModelArbitrary, async (models) => {
        await assertByAuthorSumsToTotal(models);
      })
    );
  });

  it('reports throughput counts that sum to totals', async () => {
    await fc.assert(
      fc.asyncProperty(crModelArbitrary, async (models) => {
        await assertThroughTimeSumsToTotal(models);
      })
    );
  });

  it('matches the full metrics oracle', async () => {
    await fc.assert(
      fc.asyncProperty(crModelArbitrary, async (models) => {
        await assertMetricsMatchOracle(models);
      })
    );
  });
});
