import { describe, it, expect, vi } from 'vitest';
import { DeploymentFrequencyService } from '../deployment-frequency-service';
import { TimeZoneProvider } from '../../../../infrastructure/timezone-provider';
import { PipelineJobBuilder, PipelineRunBuilder } from '../../../../test/domain/domain-builders';
import { MockLoggerBuilder } from '../../../../test/infrastructure/mock-logger-builder';
import { PipelinesRepositoryBuilder } from '../../../../test/repositories/repository-builders';
import { PipelinesRepository } from '../../repositories/pipeline-repository';

describe('DeploymentFrequencyService', () => {
  it('should warn and return empty array when no deployment targets are configured', async () => {
    const logger = new MockLoggerBuilder().build();
    const repository = new PipelinesRepositoryBuilder().withPipelineRuns([]).build();
    const service = new DeploymentFrequencyService(
      repository,
      [],
      logger,
      new TimeZoneProvider('UTC')
    );

    const frequency = await service.getDeploymentFrequencyWithAllIntervals();

    expect(frequency).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      'Deployment frequency requested without deployment_frequency_targets configured'
    );
  });

  it('should request repository runs with target-specific and caller filters', async () => {
    const logger = new MockLoggerBuilder().build();
    const loadPipelines = vi.fn().mockResolvedValue([]);
    const repository: PipelinesRepository = {
      loadPipelines,
      loadPipelineJobs: vi.fn(),
    };

    const service = new DeploymentFrequencyService(
      repository,
      [
        { pipeline: '.github/workflows/release.yml', job: 'deploy-production' },
        { pipeline: '.github/workflows/mobile.yml', job: 'deploy-mobile' },
      ],
      logger,
      new TimeZoneProvider('UTC')
    );

    await service.getDeploymentFrequencyWithAllIntervals({
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      cleaning: { weekends: 'exclude' },
      targetBranch: 'main',
      event: 'push',
      rawFilters: 'foo=bar',
    });

    expect(loadPipelines).toHaveBeenCalledTimes(2);
    expect(loadPipelines).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        includeJobs: true,
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        weekends: 'exclude',
        targetBranch: 'main',
        event: 'push',
        workflowPath: '.github/workflows/release.yml',
        status: 'completed',
        conclusion: 'success',
        jobName: 'deploy-production',
        jobConclusion: 'success',
        rawFilters: 'foo=bar',
      })
    );
    expect(loadPipelines).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        includeJobs: true,
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        weekends: 'exclude',
        targetBranch: 'main',
        event: 'push',
        workflowPath: '.github/workflows/mobile.yml',
        status: 'completed',
        conclusion: 'success',
        jobName: 'deploy-mobile',
        jobConclusion: 'success',
        rawFilters: 'foo=bar',
      })
    );
  });

  it('should fill date gaps with zero daily counts while preserving weekly and monthly totals', async () => {
    const logger = new MockLoggerBuilder().build();
    const runs = [
      new PipelineRunBuilder()
        .withId('release-run-1')
        .withNumber(1)
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2025-01-01T08:00:00Z')
        .withUpdatedAt('2025-01-01T08:15:00Z')
        .withPath('.github/workflows/release.yml')
        .withJobs([
          new PipelineJobBuilder()
            .withId('release-job-1')
            .withName('deploy-production')
            .withStatus('completed')
            .withConclusion('success')
            .withStartedAt('2025-01-01T08:05:00Z')
            .withCompletedAt('2025-01-01T08:15:00Z')
            .build(),
        ])
        .build(),
      new PipelineRunBuilder()
        .withId('release-run-3')
        .withNumber(2)
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2025-01-03T08:00:00Z')
        .withUpdatedAt('2025-01-03T08:15:00Z')
        .withPath('.github/workflows/release.yml')
        .withJobs([
          new PipelineJobBuilder()
            .withId('release-job-3')
            .withName('deploy-production')
            .withStatus('completed')
            .withConclusion('success')
            .withStartedAt('2025-01-03T08:05:00Z')
            .withCompletedAt('2025-01-03T08:15:00Z')
            .build(),
        ])
        .build(),
    ];

    const repository = new PipelinesRepositoryBuilder().withPipelineRuns(runs).build();
    const service = new DeploymentFrequencyService(
      repository,
      [{ pipeline: '.github/workflows/release.yml', job: 'deploy-production' }],
      logger,
      new TimeZoneProvider('UTC')
    );

    const frequency = await service.getDeploymentFrequencyWithAllIntervals();
    const jan2 = frequency.find((row) => row.days === '2025-01-02');

    expect(frequency).toHaveLength(3);
    expect(jan2).toEqual(
      expect.objectContaining({
        pipeline: '.github/workflows/release.yml',
        job: 'deploy-production',
        days: '2025-01-02',
        daily_counts: 0,
        weekly_counts: 2,
        monthly_counts: 2,
      })
    );
    expect(logger.info).toHaveBeenCalledWith('Jobs only for deployment frequency calculation: 2');
  });

  it('should use startedAt when completedAt is missing', async () => {
    const logger = new MockLoggerBuilder().build();
    const runs = [
      new PipelineRunBuilder()
        .withId('release-run-started-only')
        .withNumber(1)
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2025-01-05T08:00:00Z')
        .withUpdatedAt('2025-01-05T08:15:00Z')
        .withPath('.github/workflows/release.yml')
        .withJobs([
          new PipelineJobBuilder()
            .withId('release-job-started-only')
            .withName('deploy-production')
            .withStatus('completed')
            .withConclusion('success')
            .withStartedAt('2025-01-05T08:05:00Z')
            .withCompletedAt(undefined)
            .build(),
        ])
        .build(),
    ];

    const repository = new PipelinesRepositoryBuilder().withPipelineRuns(runs).build();
    const service = new DeploymentFrequencyService(
      repository,
      [{ pipeline: '.github/workflows/release.yml', job: 'deploy-production' }],
      logger,
      new TimeZoneProvider('UTC')
    );

    const frequency = await service.getDeploymentFrequencyWithAllIntervals();

    expect(frequency).toHaveLength(1);
    expect(frequency[0]).toEqual(
      expect.objectContaining({
        days: '2025-01-05',
        daily_counts: 1,
        weekly_counts: 1,
        monthly_counts: 1,
      })
    );
  });
});
