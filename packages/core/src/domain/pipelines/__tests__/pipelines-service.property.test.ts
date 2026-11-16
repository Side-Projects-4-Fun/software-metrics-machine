import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { PipelinesService } from '../services/pipelines-service';
import type { PipelineRun } from '../pipeline-types';
import { PipelineRunBuilder } from '../../../test/domain/domain-builders';
import { PipelinesRepositoryBuilder } from '../../../test/repositories/repository-builders';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';
import { TimeZoneProvider } from '../../../infrastructure/timezone-provider';

/**
 * Property-based tests for PipelinesService.getMetrics.
 *
 * These encode the catalog contract — total runs, successful/failed counts,
 * and success rate = successful ÷ completed × 100 — as an independent oracle
 * and check the running service against arbitrary run sets. The generated
 * conclusion set includes non-completed runs (null) and non-success/failure
 * completions (cancelled, skipped, timed_out) to exercise the bucketing.
 */

interface RunModel {
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | null;
}

const logger = new MockLoggerBuilder().build();

const runModelArbitrary = fc.array(
  fc.record({
    conclusion: fc.constantFrom('success', 'failure', 'cancelled', 'skipped', 'timed_out', null),
  }),
  { minLength: 1, maxLength: 40 }
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

function buildService(models: RunModel[]): PipelinesService {
  const repo = new PipelinesRepositoryBuilder().withPipelineRuns(models.map(toRun)).build();
  return new PipelinesService(repo, undefined, logger, new TimeZoneProvider('UTC'));
}

function countWith(models: RunModel[], conclusion: string): number {
  return models.filter((model) => model.conclusion === conclusion).length;
}

function completedCount(models: RunModel[]): number {
  return models.filter((model) => model.conclusion !== null).length;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

describe('PipelinesService.getMetrics — semantic oracles', () => {
  it('reports exact counts of total, successful, and failed runs', async () => {
    await fc.assert(
      fc.asyncProperty(runModelArbitrary, async (models) => {
        const metrics = await buildService(models).getMetrics();

        expect(metrics.totalRuns).toBe(models.length);
        expect(metrics.successfulRuns).toBe(countWith(models, 'success'));
        expect(metrics.failedRuns).toBe(countWith(models, 'failure'));
      })
    );
  });

  it('computes success rate as successful over completed times 100', async () => {
    await fc.assert(
      fc.asyncProperty(runModelArbitrary, async (models) => {
        const metrics = await buildService(models).getMetrics();
        const completed = completedCount(models);
        const expected =
          completed > 0 ? round2((countWith(models, 'success') / completed) * 100) : 0;

        expect(metrics.successRate).toBe(expected);
      })
    );
  });

  it('keeps successful and failed runs within the total', async () => {
    await fc.assert(
      fc.asyncProperty(runModelArbitrary, async (models) => {
        const metrics = await buildService(models).getMetrics();

        expect(metrics.successfulRuns + metrics.failedRuns).toBeLessThanOrEqual(metrics.totalRuns);
        expect(metrics.successRate).toBeGreaterThanOrEqual(0);
        expect(metrics.successRate).toBeLessThanOrEqual(100);
      })
    );
  });
});
