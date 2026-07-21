import { describe, expect, it } from 'vitest';
import { PipelinesService } from '..';
import { TimeZoneProvider } from '../../../infrastructure';
import { PipelineJobBuilder, PipelineRunBuilder } from '../../../test/domain/domain-builders';
import { TestConfigurationBuilder } from '../../../test/domain/configuration-builder';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';
import { PipelinesRepositoryBuilder } from '../../../test/repositories/repository-builders';

const logger = new MockLoggerBuilder().build();

function buildDeploymentTargetConfig() {
  return new TestConfigurationBuilder()
    .withExtra('getDeploymentFrequencyTargets', () => [
      { pipeline: '.github/workflows/release.yml', job: 'deploy-production' },
    ])
    .build();
}

describe('PipelinesService behavior', () => {
  it('calculates exact run totals and success rate from repository data', async () => {
    const repository = new PipelinesRepositoryBuilder()
      .withPipelineRuns([
        new PipelineRunBuilder()
          .withId('success-run')
          .withNumber(1)
          .withConclusion('success')
          .withCreatedAt('2025-01-01T10:00:00Z')
          .withCompletedAt('2025-01-01T10:15:00Z')
          .withBranch('main')
          .build(),
        new PipelineRunBuilder()
          .withId('failure-run')
          .withNumber(2)
          .withConclusion('failure')
          .withCreatedAt('2025-01-02T10:00:00Z')
          .withCompletedAt('2025-01-02T10:20:00Z')
          .withBranch('develop')
          .build(),
      ])
      .build();
    const service = new PipelinesService(
      repository,
      undefined,
      logger,
      new TimeZoneProvider('UTC')
    );

    const metrics = await service.getMetrics();

    expect(metrics.totalRuns).toBe(2);
    expect(metrics.successfulRuns).toBe(1);
    expect(metrics.failedRuns).toBe(1);
    expect(metrics.successRate).toBe(50);
    expect(metrics.averageDurationMinutes).toBe(0);
  });

  it('filters repository runs by target branch before calculating metrics', async () => {
    const repository = new PipelinesRepositoryBuilder()
      .withPipelineRuns([
        new PipelineRunBuilder()
          .withId('main-run')
          .withConclusion('success')
          .withBranch('main')
          .build(),
        new PipelineRunBuilder()
          .withId('develop-run')
          .withConclusion('failure')
          .withBranch('develop')
          .build(),
      ])
      .build();
    const service = new PipelinesService(
      repository,
      undefined,
      logger,
      new TimeZoneProvider('UTC')
    );

    const metrics = await service.getMetrics({ targetBranch: 'main' });

    expect(metrics.totalRuns).toBe(1);
    expect(metrics.successfulRuns).toBe(1);
    expect(metrics.failedRuns).toBe(0);
    expect(metrics.successRate).toBe(100);
  });

  it('fills daily deployment gaps for configured deployment targets', async () => {
    const repository = new PipelinesRepositoryBuilder()
      .withPipelineRuns([
        buildDeployRun('deploy-1', 1, '2025-01-01T08:00:00Z', 'job-1'),
        buildDeployRun('deploy-3', 2, '2025-01-03T08:00:00Z', 'job-3'),
      ])
      .build();
    const service = new PipelinesService(
      repository,
      buildDeploymentTargetConfig(),
      logger,
      new TimeZoneProvider('UTC')
    );

    const frequency = await service.getDeploymentFrequency('day');

    expect(frequency).toEqual([
      { period: '2025-01-01', count: 1 },
      { period: '2025-01-02', count: 0 },
      { period: '2025-01-03', count: 1 },
    ]);
  });

  it('aggregates deployment frequency by week using the timezone provider keys', async () => {
    const repository = new PipelinesRepositoryBuilder()
      .withPipelineRuns([
        buildDeployRun('deploy-1', 1, '2025-01-01T08:00:00Z', 'job-1'),
        buildDeployRun('deploy-3', 2, '2025-01-03T08:00:00Z', 'job-3'),
      ])
      .build();
    const service = new PipelinesService(
      repository,
      buildDeploymentTargetConfig(),
      logger,
      new TimeZoneProvider('UTC')
    );

    const frequency = await service.getDeploymentFrequency('week');

    expect(frequency).toEqual([{ period: '2024-W53', count: 2 }]);
  });

  it('aggregates deployment frequency by month', async () => {
    const repository = new PipelinesRepositoryBuilder()
      .withPipelineRuns([
        buildDeployRun('deploy-1', 1, '2025-01-01T08:00:00Z', 'job-1'),
        buildDeployRun('deploy-3', 2, '2025-01-03T08:00:00Z', 'job-3'),
      ])
      .build();
    const service = new PipelinesService(
      repository,
      buildDeploymentTargetConfig(),
      logger,
      new TimeZoneProvider('UTC')
    );

    const frequency = await service.getDeploymentFrequency('month');

    expect(frequency).toEqual([{ period: '2025-01', count: 2 }]);
  });

  it('calculates exact job metrics for workflow jobs', async () => {
    const repository = new PipelinesRepositoryBuilder()
      .withPipelineRuns([
        new PipelineRunBuilder()
          .withId('success-run')
          .withPath('.github/workflows/ci.yml')
          .withJobs([
            new PipelineJobBuilder()
              .withName('test')
              .withConclusion('success')
              .withStartedAt('2025-01-01T10:00:00Z')
              .withCompletedAt('2025-01-01T10:05:00Z')
              .build(),
          ])
          .build(),
        new PipelineRunBuilder()
          .withId('failure-run')
          .withPath('.github/workflows/ci.yml')
          .withJobs([
            new PipelineJobBuilder()
              .withName('test')
              .withConclusion('failure')
              .withStartedAt('2025-01-02T10:00:00Z')
              .withCompletedAt('2025-01-02T10:10:00Z')
              .build(),
          ])
          .build(),
      ])
      .build();
    const service = new PipelinesService(
      repository,
      undefined,
      logger,
      new TimeZoneProvider('UTC')
    );

    const jobMetrics = await service.getJobMetrics();

    expect(jobMetrics).toEqual([
      expect.objectContaining({
        jobName: 'test',
        workflowName: '.github/workflows/ci.yml',
        totalRuns: 2,
        successCount: 1,
        failureCount: 1,
        successRate: 50,
        failureRate: 50,
        averageDurationMinutes: 7.5,
      }),
    ]);
  });
});

function buildDeployRun(id: string, number: number, completedAt: string, jobId: string) {
  return new PipelineRunBuilder()
    .withId(id)
    .withNumber(number)
    .withStatus('completed')
    .withConclusion('success')
    .withCreatedAt(completedAt)
    .withUpdatedAt(completedAt)
    .withBranch('main')
    .withPath('.github/workflows/release.yml')
    .withJobs([
      new PipelineJobBuilder()
        .withId(jobId)
        .withName('deploy-production')
        .withStatus('completed')
        .withConclusion('success')
        .withStartedAt(completedAt)
        .withCompletedAt(completedAt)
        .build(),
    ])
    .build();
}
