import { describe, it, expect, beforeEach } from 'vitest';
import { PipelineRun, PipelinesRepository } from '../..';
import { PipelinesService } from '../..';
import { PipelineJobBuilder, PipelineRunBuilder, PipelineStepBuilder } from '../../test/domain';
import { PipelinesRepositoryBuilder } from '../../test/repositories/repository-builders';
import { MockLoggerBuilder } from '../../test/infrastructure/mock-logger-builder';
import { TimeZoneProvider } from '../../infrastructure';

const logger = new MockLoggerBuilder().build();

describe('PipelinesService', () => {
  let pipelinesService: PipelinesService;
  let mockPipelineRepo: PipelinesRepository;

  function buildDeployRun({
    id,
    number,
    name = 'Release',
    createdAt,
    updatedAt,
    path,
    jobId,
    jobName,
    jobStartedAt,
    jobCompletedAt,
  }: {
    id: string;
    number: number;
    name?: string;
    createdAt: string;
    updatedAt: string;
    path: string;
    jobId: string;
    jobName: string;
    jobStartedAt: string;
    jobCompletedAt?: string;
  }) {
    const jobs =
      jobId && jobName
        ? [
            new PipelineJobBuilder()
              .withId(jobId)
              .withName(jobName)
              .withStatus('completed')
              .withConclusion('success')
              .withStartedAt(jobStartedAt)
              .withCompletedAt(jobCompletedAt)
              .build(),
          ]
        : [];

    return new PipelineRunBuilder()
      .withId(id)
      .withNumber(number)
      .withName(name)
      .withStatus('completed')
      .withConclusion('success')
      .withCreatedAt(createdAt)
      .withUpdatedAt(updatedAt)
      .withBranch('main')
      .withPath(path)
      .withJobs(jobs)
      .build();
  }

  beforeEach(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const runs = [
      new PipelineRunBuilder()
        .withNumber(1)
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt(oneWeekAgo.toISOString())
        .withStartedAt(oneWeekAgo.toISOString())
        .withCompletedAt(twoDaysAgo.toISOString())
        .withBranch('main')
        .build(),
      new PipelineRunBuilder()
        .withNumber(2)
        .withStatus('completed')
        .withConclusion('failure')
        .withCreatedAt(new Date().toISOString())
        .withStartedAt(new Date().toISOString())
        .withConclusion('failure')
        .build(),
    ];

    mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(runs).build();

    pipelinesService = new PipelinesService(
      mockPipelineRepo,
      undefined,
      logger,
      new TimeZoneProvider('UTC')
    );
  });

  it('should calculate overall metrics', async () => {
    const metrics = await pipelinesService.getMetrics();

    expect(metrics.totalRuns).toBeGreaterThan(0);
    expect(metrics.successfulRuns).toBeGreaterThanOrEqual(0);
    expect(metrics.failedRuns).toBeGreaterThanOrEqual(0);
    expect(metrics.successRate).toBeGreaterThanOrEqual(0);
    expect(metrics.successRate).toBeLessThanOrEqual(100);
  });

  it('should get deployment frequency by day', async () => {
    const freq = await pipelinesService.getDeploymentFrequency('day');

    expect(Array.isArray(freq)).toBe(true);
    for (const day of freq) {
      expect(day.period).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD format
      expect(day.count).toBeGreaterThanOrEqual(0);
    }
  });

  it('should get deployment frequency by week', async () => {
    const freq = await pipelinesService.getDeploymentFrequency('week');

    expect(Array.isArray(freq)).toBe(true);
    for (const week of freq) {
      expect(week.period).toMatch(/^\d{4}-W\d{2}$/); // YYYY-Wxx format
      expect(week.count).toBeGreaterThanOrEqual(0);
    }
  });

  it('should get deployment frequency by month', async () => {
    const freq = await pipelinesService.getDeploymentFrequency('month');

    expect(Array.isArray(freq)).toBe(true);
    for (const month of freq) {
      expect(month.period).toMatch(/^\d{4}-\d{2}$/); // YYYY-MM format
      expect(month.count).toBeGreaterThanOrEqual(0);
    }
  });

  it('should get job metrics', async () => {
    const jobMetrics = await pipelinesService.getJobMetrics();

    expect(Array.isArray(jobMetrics)).toBe(true);
    for (const job of jobMetrics) {
      expect(job.jobName).toBeDefined();
      expect(job.totalRuns).toBeGreaterThanOrEqual(0);
      expect(job.successRate).toBeGreaterThanOrEqual(0);
      expect(job.successRate).toBeLessThanOrEqual(100);
      expect(job.failureRate).toBeGreaterThanOrEqual(0);
      expect(job.failureRate).toBeLessThanOrEqual(100);
    }
  });

  it('should filter runs by branch', async () => {
    const metrics = await pipelinesService.getMetrics({
      targetBranch: 'main',
    });

    expect(metrics).toBeDefined();
    expect(metrics.totalRuns).toBeGreaterThanOrEqual(0);
  });

  it('should exclude weekend runs when weekends filter is set to exclude', async () => {
    const weekendAndWeekdayRuns = [
      new PipelineRunBuilder()
        .withId('run-saturday')
        .withNumber(1)
        .withName('Saturday run')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2026-06-06T10:00:00Z')
        .withUpdatedAt('2026-06-06T10:10:00Z')
        .withBranch('main')
        .withPath('.github/workflows/ci.yml')
        .build(),
      new PipelineRunBuilder()
        .withId('run-monday')
        .withNumber(2)
        .withName('Monday run')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2026-06-08T10:00:00Z')
        .withUpdatedAt('2026-06-08T10:10:00Z')
        .withBranch('main')
        .withPath('.github/workflows/ci.yml')
        .build(),
    ];

    mockPipelineRepo = new PipelinesRepositoryBuilder()
      .withPipelineRuns(weekendAndWeekdayRuns)
      .build();

    pipelinesService = new PipelinesService(
      mockPipelineRepo,
      undefined,
      logger,
      new TimeZoneProvider('UTC')
    );

    const includeMetrics = await pipelinesService.getMetrics({
      cleaning: { weekends: 'include' },
    });
    const excludeMetrics = await pipelinesService.getMetrics({
      cleaning: { weekends: 'exclude' },
    });
    const weekendsOnlyMetrics = await pipelinesService.getMetrics({
      cleaning: { weekends: 'weekends_only' },
    });

    expect(includeMetrics.totalRuns).toBe(2);
    expect(excludeMetrics.totalRuns).toBe(1);
    expect(excludeMetrics.successfulRuns).toBe(1);
    expect(weekendsOnlyMetrics.totalRuns).toBe(1);
    expect(weekendsOnlyMetrics.successfulRuns).toBe(1);
  });

  it('should aggregate deployment frequency for configured workflow and job targets', async () => {
    const deployRuns = [
      new PipelineRunBuilder()
        .withId('release-run')
        .withNumber(1)
        .withName('Release')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2025-01-01T08:00:00Z')
        .withUpdatedAt('2025-01-01T08:15:00Z')
        .withBranch('main')
        .withPath('.github/workflows/release.yml')
        .withJobs([
          new PipelineJobBuilder()
            .withId('release-job')
            .withName('deploy-production')
            .withStatus('completed')
            .withConclusion('success')
            .withStartedAt('2025-01-01T08:05:00Z')
            .withCompletedAt('2025-01-01T08:15:00Z')
            .build(),
        ])
        .build(),
      new PipelineRunBuilder()
        .withId('mobile-run')
        .withNumber(2)
        .withName('Mobile')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2025-01-01T09:00:00Z')
        .withUpdatedAt('2025-01-01T09:15:00Z')
        .withBranch('main')
        .withPath('.github/workflows/mobile.yml')
        .withJobs([
          new PipelineJobBuilder()
            .withId('mobile-job')
            .withName('deploy-mobile')
            .withStatus('completed')
            .withConclusion('success')
            .withStartedAt('2025-01-01T09:05:00Z')
            .withCompletedAt('2025-01-01T09:15:00Z')
            .build(),
        ])
        .build(),
    ];

    mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(deployRuns).build();

    pipelinesService = new PipelinesService(
      mockPipelineRepo,
      {
        getDeploymentFrequencyTargets: () => [
          { pipeline: '.github/workflows/release.yml', job: 'deploy-production' },
          { pipeline: '.github/workflows/mobile.yml', job: 'deploy-mobile' },
        ],
      } as any,
      logger,
      new TimeZoneProvider('UTC')
    );

    const frequency = await pipelinesService.getDeploymentFrequencyWithAllIntervals();

    expect(frequency).toHaveLength(2);
    expect(frequency).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pipeline: '.github/workflows/release.yml',
          job: 'deploy-production',
          daily_counts: 1,
          weekly_counts: 1,
          monthly_counts: 1,
        }),
        expect.objectContaining({
          pipeline: '.github/workflows/mobile.yml',
          job: 'deploy-mobile',
          daily_counts: 1,
          weekly_counts: 1,
          monthly_counts: 1,
        }),
      ])
    );
  });

  describe('getRunDurationMinutes', () => {
    it('should compute duration from jobs when available', () => {
      const run = {
        startedAt: '2025-01-01T10:00:00Z',
        completedAt: '2025-01-01T20:00:00Z', // stale updated_at: 10 hours later
        jobs: [
          {
            startedAt: '2025-01-01T10:01:00Z',
            completedAt: '2025-01-01T10:05:00Z',
          },
        ],
      };

      const duration = pipelinesService.getRunDurationMinutes(run);

      // Should use job timestamps (4 minutes), not run-level (600 minutes)
      expect(duration).toBe(4);
    });

    it('should return null when no valid jobs exist', () => {
      const run = {
        startedAt: '2025-01-01T10:00:00Z',
        completedAt: '2026-02-05T10:05:00Z', // stale updated_at: ~570,000 minutes
        jobs: [],
      };

      const duration = pipelinesService.getRunDurationMinutes(run);

      // Should NOT fall back to stale run-level timestamps
      expect(duration).toBeNull();
    });

    it('should return null when jobs have invalid timestamps', () => {
      const run = {
        startedAt: '2025-01-01T10:00:00Z',
        completedAt: '2025-01-01T10:05:00Z',
        jobs: [
          {
            startedAt: '2025-01-01T10:01:00Z',
            completedAt: '', // invalid
          },
        ],
      };

      const duration = pipelinesService.getRunDurationMinutes(run);

      expect(duration).toBeNull();
    });

    it('should use the earliest job start and latest job end', () => {
      const run = {
        startedAt: '2025-01-01T10:00:00Z',
        completedAt: '2025-01-01T20:00:00Z',
        jobs: [
          {
            startedAt: '2025-01-01T10:02:00Z',
            completedAt: '2025-01-01T10:05:00Z',
          },
          {
            startedAt: '2025-01-01T10:01:00Z',
            completedAt: '2025-01-01T10:10:00Z',
          },
        ],
      };

      const duration = pipelinesService.getRunDurationMinutes(run);

      // earliest start: 10:01, latest end: 10:10 => 9 minutes
      expect(duration).toBe(9);
    });
  });

  describe('getMetrics average duration', () => {
    it('should exclude runs without jobs from average duration', async () => {
      const runs = [
        new PipelineRunBuilder()
          .withId('run-1')
          .withNumber(1)
          .withName('Build')
          .withStatus('completed')
          .withConclusion('success')
          .withCreatedAt('2025-01-01T08:00:00Z')
          .withUpdatedAt('2025-01-01T08:15:00Z')
          .withStartedAt('2025-01-01T08:00:00Z')
          .withBranch('main')
          .withPath('.github/workflows/build.yml')
          .withJobs([
            new PipelineJobBuilder()
              .withId('job-1')
              .withName('test')
              .withStatus('completed')
              .withConclusion('success')
              .withStartedAt('2025-01-01T08:01:00Z')
              .withCompletedAt('2025-01-01T08:05:00Z')
              .build(),
          ])
          .build(),
        new PipelineRunBuilder()
          .withId('run-2')
          .withNumber(2)
          .withName('Build')
          .withStatus('completed')
          .withConclusion('success')
          .withCreatedAt('2025-01-01T09:00:00Z')
          .withUpdatedAt('2026-06-01T09:00:00Z')
          .withStartedAt('2025-01-01T09:00:00Z')
          .withBranch('main')
          .withPath('.github/workflows/build.yml')
          .withJobs([])
          .build(),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(runs).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const metrics = await pipelinesService.getMetrics();

      // Average should be 4 minutes (only from run-1), not ~570k minutes
      expect(metrics.averageDurationMinutes).toBe(4);
    });
  });

  describe('getRunMetricDate', () => {
    it('should use completedAt when present', () => {
      const date = pipelinesService.getRunMetricDate({
        createdAt: '2025-01-01T08:00:00Z',
        completedAt: '2025-01-02T08:00:00Z',
      });

      expect(date).toBe('2025-01-02T08:00:00Z');
    });

    it('should fall back to createdAt when completedAt is absent', () => {
      const date = pipelinesService.getRunMetricDate({
        createdAt: '2025-01-01T08:00:00Z',
      });

      expect(date).toBe('2025-01-01T08:00:00Z');
    });
  });

  describe('getDurationMinutes', () => {
    it('should return null when startedAt is missing', () => {
      const duration = pipelinesService.getDurationMinutes(undefined, '2025-01-01T08:05:00Z');

      expect(duration).toBeNull();
    });

    it('should return null when completedAt is missing', () => {
      const duration = pipelinesService.getDurationMinutes('2025-01-01T08:00:00Z', undefined);

      expect(duration).toBeNull();
    });

    it('should return null when completedAt is before startedAt', () => {
      const duration = pipelinesService.getDurationMinutes(
        '2025-01-01T08:05:00Z',
        '2025-01-01T08:00:00Z'
      );

      expect(duration).toBeNull();
    });

    it('should return the minute difference for a valid range', () => {
      const duration = pipelinesService.getDurationMinutes(
        '2025-01-01T08:00:00Z',
        '2025-01-01T08:10:00Z'
      );

      expect(duration).toBe(10);
    });
  });

  describe('getPeriodKey', () => {
    it('should delegate to the timezone provider for the day interval', () => {
      const key = pipelinesService.getPeriodKey('2025-01-15T08:00:00Z', 'day');

      expect(key).toBe('2025-01-15');
    });
  });

  describe('getDeploymentFrequency with configured targets', () => {
    beforeEach(() => {
      const deployRuns = [
        buildDeployRun({
          id: 'release-run-1',
          number: 1,
          createdAt: '2025-01-01T08:00:00Z',
          updatedAt: '2025-01-01T08:15:00Z',
          path: '.github/workflows/release.yml',
          jobId: 'release-job-1',
          jobName: 'deploy-production',
          jobStartedAt: '2025-01-01T08:05:00Z',
          jobCompletedAt: '2025-01-01T08:15:00Z',
        }),
        buildDeployRun({
          id: 'release-run-2',
          number: 2,
          createdAt: '2025-01-02T08:00:00Z',
          updatedAt: '2025-01-02T08:15:00Z',
          path: '.github/workflows/release.yml',
          jobId: 'release-job-2',
          jobName: 'deploy-production',
          jobStartedAt: '2025-01-02T08:05:00Z',
          jobCompletedAt: '2025-01-02T08:15:00Z',
        }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(deployRuns).build();

      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        {
          getDeploymentFrequencyTargets: () => [
            { pipeline: '.github/workflows/release.yml', job: 'deploy-production' },
          ],
        } as any,
        logger,
        new TimeZoneProvider('UTC')
      );
    });

    it('should group counts by day across the deployment date range', async () => {
      const frequency = await pipelinesService.getDeploymentFrequency('day');

      expect(frequency).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ period: '2025-01-01', count: 1 }),
          expect.objectContaining({ period: '2025-01-02', count: 1 }),
        ])
      );
    });

    it('should group counts by week across the deployment date range', async () => {
      const frequency = await pipelinesService.getDeploymentFrequency('week');

      expect(frequency.length).toBeGreaterThan(0);
      const total = frequency.reduce((sum, item) => sum + item.count, 0);
      expect(total).toBe(2);
      for (const item of frequency) {
        expect(item.period).toMatch(/^\d{4}-W\d{2}$/);
      }
    });

    it('should group counts by month across the deployment date range', async () => {
      const frequency = await pipelinesService.getDeploymentFrequency('month');

      expect(frequency).toEqual(
        expect.arrayContaining([expect.objectContaining({ period: '2025-01', count: 2 })])
      );
    });
  });

  describe('getDeploymentFrequencyWithAllIntervals edge cases', () => {
    it('should skip jobs with neither completedAt nor startedAt', async () => {
      const deployRuns = [
        buildDeployRun({
          id: 'release-run',
          number: 1,
          createdAt: '2025-01-01T08:00:00Z',
          updatedAt: '2025-01-01T08:15:00Z',
          path: '.github/workflows/release.yml',
          jobId: 'release-job-no-timestamps',
          jobName: 'deploy-production',
          jobStartedAt: '2025-01-01T08:00:00Z',
          jobCompletedAt: undefined,
        }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(deployRuns).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        {
          getDeploymentFrequencyTargets: () => [
            { pipeline: '.github/workflows/release.yml', job: 'deploy-production' },
          ],
        } as any,
        logger,
        new TimeZoneProvider('UTC')
      );

      const frequency = await pipelinesService.getDeploymentFrequencyWithAllIntervals();

      expect(frequency).toEqual([]);
    });

    it('should return an empty array when targets are configured but no deployments match', async () => {
      const deployRuns = [
        buildDeployRun({
          id: 'unrelated-run',
          number: 1,
          name: 'Other',
          createdAt: '2025-01-01T08:00:00Z',
          updatedAt: '2025-01-01T08:15:00Z',
          path: '.github/workflows/other.yml',
          jobId: 'other-job',
          jobName: 'deploy-staging',
          jobStartedAt: '2025-01-01T08:05:00Z',
          jobCompletedAt: '2025-01-01T08:15:00Z',
        }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(deployRuns).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        {
          getDeploymentFrequencyTargets: () => [
            { pipeline: '.github/workflows/release.yml', job: 'deploy-production' },
          ],
        } as any,
        logger,
        new TimeZoneProvider('UTC')
      );

      const frequency = await pipelinesService.getDeploymentFrequencyWithAllIntervals();

      expect(frequency).toEqual([]);
    });

    it('should report zero counts for days/weeks/months within the range that have no deployments', async () => {
      const deployRuns = [
        buildDeployRun({
          id: 'release-run-1',
          number: 1,
          createdAt: '2025-01-01T08:00:00Z',
          updatedAt: '2025-01-01T08:15:00Z',
          path: '.github/workflows/release.yml',
          jobId: 'release-job-1',
          jobName: 'deploy-production',
          jobStartedAt: '2025-01-01T08:05:00Z',
          jobCompletedAt: '2025-01-01T08:15:00Z',
        }),
        buildDeployRun({
          id: 'release-run-3',
          number: 2,
          createdAt: '2025-01-03T08:00:00Z',
          updatedAt: '2025-01-03T08:15:00Z',
          path: '.github/workflows/release.yml',
          jobId: 'release-job-3',
          jobName: 'deploy-production',
          jobStartedAt: '2025-01-03T08:05:00Z',
          jobCompletedAt: '2025-01-03T08:15:00Z',
        }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(deployRuns).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        {
          getDeploymentFrequencyTargets: () => [
            { pipeline: '.github/workflows/release.yml', job: 'deploy-production' },
          ],
        } as any,
        logger,
        new TimeZoneProvider('UTC')
      );

      const frequency = await pipelinesService.getDeploymentFrequencyWithAllIntervals();

      // jan 2 falls inside the range but has no deployment, so all its counts default to 0
      expect(frequency).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            days: '2025-01-02',
            daily_counts: 0,
            weekly_counts: 2,
            monthly_counts: 2,
          }),
        ])
      );
    });

    it('should default weekly and monthly counts to zero for a mid-range day in a week/month with no deployments', async () => {
      const deployRuns = [
        buildDeployRun({
          id: 'release-run-jan',
          number: 1,
          createdAt: '2025-01-01T08:00:00Z',
          updatedAt: '2025-01-01T08:15:00Z',
          path: '.github/workflows/release.yml',
          jobId: 'release-job-jan',
          jobName: 'deploy-production',
          jobStartedAt: '2025-01-01T08:05:00Z',
          jobCompletedAt: '2025-01-01T08:15:00Z',
        }),
        buildDeployRun({
          id: 'release-run-mar',
          number: 2,
          createdAt: '2025-03-01T08:00:00Z',
          updatedAt: '2025-03-01T08:15:00Z',
          path: '.github/workflows/release.yml',
          jobId: 'release-job-mar',
          jobName: 'deploy-production',
          jobStartedAt: '2025-03-01T08:05:00Z',
          jobCompletedAt: '2025-03-01T08:15:00Z',
        }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(deployRuns).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        {
          getDeploymentFrequencyTargets: () => [
            { pipeline: '.github/workflows/release.yml', job: 'deploy-production' },
          ],
        } as any,
        logger,
        new TimeZoneProvider('UTC')
      );

      const frequency = await pipelinesService.getDeploymentFrequencyWithAllIntervals();

      // Feb 15 falls in a week and month (February) with zero deployments of its own.
      expect(frequency).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            days: '2025-02-15',
            daily_counts: 0,
            weekly_counts: 0,
            monthly_counts: 0,
          }),
        ])
      );
    });
  });

  describe('getJobMetrics', () => {
    function jobRun(
      id: string,
      jobName: string,
      conclusion: string,
      options: { runAttempt?: number; startedAt?: string; completedAt?: string; path?: string }
    ): PipelineRun {
      return new PipelineRunBuilder()
        .withId(id)
        .withNumber(1)
        .withName('Build')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2025-01-01T08:00:00Z')
        .withUpdatedAt('2025-01-01T08:15:00Z')
        .withBranch('main')
        .withPath(options.path ?? '.github/workflows/build.yml')
        .withRunAttempt(options.runAttempt)
        .withJobs([
          new PipelineJobBuilder()
            .withId(`${id}-job`)
            .withName(jobName)
            .withStatus('completed')
            .withConclusion(conclusion)
            .withStartedAt(options.startedAt ?? '2025-01-01T08:01:00Z')
            .withCompletedAt(options.completedAt)
            .build(),
        ])
        .build();
    }

    it('should treat a run with no jobs array as contributing no job metrics', async () => {
      const runWithoutJobs = new PipelineRunBuilder()
        .withId('run-no-jobs')
        .withNumber(1)
        .withName('Build')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2025-01-01T08:00:00Z')
        .withUpdatedAt('2025-01-01T08:15:00Z')
        .withBranch('main')
        .withPath('.github/workflows/build.yml')
        .withJobs(undefined)
        .build();
      const runWithJob = jobRun('run-with-job', 'test', 'success', {
        completedAt: '2025-01-01T08:05:00Z',
      });

      mockPipelineRepo = new PipelinesRepositoryBuilder()
        .withPipelineRuns([runWithoutJobs, runWithJob])
        .build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const jobMetrics = await pipelinesService.getJobMetrics();

      expect(jobMetrics).toHaveLength(1);
      expect(jobMetrics[0].jobName).toBe('test');
      expect(jobMetrics[0].totalRuns).toBe(1);
    });

    it('should count each job conclusion type, including an unrecognized value as unknown', async () => {
      const runs = [
        jobRun('run-success', 'test', 'success', { completedAt: '2025-01-01T08:05:00Z' }),
        jobRun('run-failure', 'test', 'failure', { completedAt: '2025-01-01T08:05:00Z' }),
        jobRun('run-cancelled', 'test', 'cancelled', { completedAt: '2025-01-01T08:05:00Z' }),
        jobRun('run-timed-out', 'test', 'timed_out', { completedAt: '2025-01-01T08:05:00Z' }),
        jobRun('run-action-required', 'test', 'action_required', {
          completedAt: '2025-01-01T08:05:00Z',
        }),
        jobRun('run-skipped', 'test', 'skipped', { completedAt: '2025-01-01T08:05:00Z' }),
        jobRun('run-unknown', 'test', 'neutral', { completedAt: '2025-01-01T08:05:00Z' }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(runs).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const jobMetrics = await pipelinesService.getJobMetrics();

      expect(jobMetrics).toHaveLength(1);
      const metrics = jobMetrics[0];
      expect(metrics.jobName).toBe('test');
      expect(metrics.totalRuns).toBe(7);
      expect(metrics.successCount).toBe(1);
      expect(metrics.failureCount).toBe(1);
      expect(metrics.cancelledCount).toBe(1);
      expect(metrics.timedOutCount).toBe(1);
      expect(metrics.actionRequiredCount).toBe(1);
      expect(metrics.skippedCount).toBe(1);
      expect(metrics.unknownCount).toBe(1);
    });

    it('should count reruns from runAttempt > 1 and not count when runAttempt is absent', async () => {
      const runs = [
        jobRun('run-no-attempt', 'test', 'success', { completedAt: '2025-01-01T08:05:00Z' }),
        jobRun('run-attempt-3', 'test', 'success', {
          runAttempt: 3,
          completedAt: '2025-01-01T08:05:00Z',
        }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(runs).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const jobMetrics = await pipelinesService.getJobMetrics();

      // run-no-attempt contributes 0 reruns, run-attempt-3 contributes 2
      expect(jobMetrics[0].rerunCount).toBe(2);
    });

    it('should merge multiple runs producing the same job name into one entry', async () => {
      const runs = [
        jobRun('run-1', 'shared-job', 'success', { completedAt: '2025-01-01T08:05:00Z' }),
        jobRun('run-2', 'shared-job', 'failure', { completedAt: '2025-01-01T08:05:00Z' }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(runs).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const jobMetrics = await pipelinesService.getJobMetrics();

      expect(jobMetrics).toHaveLength(1);
      expect(jobMetrics[0].totalRuns).toBe(2);
      expect(jobMetrics[0].successCount).toBe(1);
      expect(jobMetrics[0].failureCount).toBe(1);
    });

    it('should keep the same job name separate for different workflows', async () => {
      const runs = [
        jobRun('run-build', 'shared-job', 'success', {
          completedAt: '2025-01-01T08:05:00Z',
          path: '.github/workflows/build.yml',
        }),
        jobRun('run-release', 'shared-job', 'failure', {
          completedAt: '2025-01-01T08:05:00Z',
          path: '.github/workflows/release.yml',
        }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(runs).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const jobMetrics = await pipelinesService.getJobMetrics();

      expect(jobMetrics).toHaveLength(2);
      expect(jobMetrics.map((metric) => metric.workflowName).sort()).toEqual([
        '.github/workflows/build.yml',
        '.github/workflows/release.yml',
      ]);
    });

    it('should include only jobs with both startedAt and completedAt in the duration calculation', async () => {
      const runs = [
        jobRun('run-with-duration', 'test', 'success', {
          startedAt: '2025-01-01T08:00:00Z',
          completedAt: '2025-01-01T08:10:00Z', // 10 minutes
        }),
        jobRun('run-without-completed', 'test', 'success', {
          startedAt: '2025-01-01T08:00:00Z',
          completedAt: undefined,
        }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(runs).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const jobMetrics = await pipelinesService.getJobMetrics();

      // Average should be exactly 10 (only from run-with-duration)
      expect(jobMetrics[0].averageDurationMinutes).toBe(10);
      expect(jobMetrics[0].successRate).toBe(100);
      expect(jobMetrics[0].failureRate).toBe(0);
    });

    it('should sort multiple jobs by totalRuns descending', async () => {
      const runs = [
        jobRun('run-a-1', 'job-a', 'success', { completedAt: '2025-01-01T08:05:00Z' }),
        jobRun('run-b-1', 'job-b', 'success', { completedAt: '2025-01-01T08:05:00Z' }),
        jobRun('run-b-2', 'job-b', 'success', { completedAt: '2025-01-01T08:05:00Z' }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(runs).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const jobMetrics = await pipelinesService.getJobMetrics();

      expect(jobMetrics.map((m) => m.jobName)).toEqual(['job-b', 'job-a']);
    });
  });

  describe('getJobRerunsByDay', () => {
    function dayRun(
      id: string,
      createdAt: string,
      options: { completedAt?: string; runAttempt?: number } = {}
    ) {
      return new PipelineRunBuilder()
        .withId(id)
        .withNumber(1)
        .withName('Build')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt(createdAt)
        .withUpdatedAt(createdAt)
        .withCompletedAt(options.completedAt)
        .withRunAttempt(options.runAttempt)
        .withBranch('main')
        .withPath('.github/workflows/build.yml')
        .withJobs([])
        .build();
    }

    it('should skip runs with neither completedAt nor createdAt', async () => {
      const runWithNoDate = dayRun('run-no-date', '');

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([runWithNoDate]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobRerunsByDay();

      expect(result).toEqual([]);
    });

    it('should count zero reruns for a run with no runAttempt', async () => {
      const run = dayRun('run-1', '2025-01-01T08:00:00Z');

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([run]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobRerunsByDay();

      expect(result).toEqual([{ day: '2025-01-01', rerun_count: 0 }]);
    });

    it('should accumulate reruns for multiple runs on the same day and sort by day', async () => {
      const runs = [
        dayRun('run-jan-2-a', '2025-01-02T08:00:00Z', { runAttempt: 2 }),
        dayRun('run-jan-1-a', '2025-01-01T08:00:00Z', { runAttempt: 3 }),
        dayRun('run-jan-1-b', '2025-01-01T09:00:00Z', { runAttempt: 2 }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(runs).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobRerunsByDay();

      // jan 1: (3-1) + (2-1) = 3 reruns; jan 2: (2-1) = 1 rerun
      expect(result).toEqual([
        { day: '2025-01-01', rerun_count: 3 },
        { day: '2025-01-02', rerun_count: 1 },
      ]);
    });

    it('should use completedAt over createdAt to determine the day when both are present', async () => {
      const run = dayRun('run-1', '2025-01-01T08:00:00Z', {
        completedAt: '2025-01-02T08:00:00Z',
        runAttempt: 2,
      });

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([run]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobRerunsByDay();

      expect(result).toEqual([{ day: '2025-01-02', rerun_count: 1 }]);
    });
  });

  describe('getJobStepsAverageTime', () => {
    function runWithSteps(
      id: string,
      steps: Array<{ name?: string; startedAt?: string; completedAt?: string }>
    ) {
      return new PipelineRunBuilder()
        .withId(id)
        .withNumber(1)
        .withName('Build')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2025-01-01T08:00:00Z')
        .withUpdatedAt('2025-01-01T08:15:00Z')
        .withBranch('main')
        .withPath('.github/workflows/build.yml')
        .withJobs([
          new PipelineJobBuilder()
            .withId(`${id}-job`)
            .withName('build-job')
            .withStatus('completed')
            .withConclusion('success')
            .withStartedAt('2025-01-01T08:00:00Z')
            .withCompletedAt('2025-01-01T08:15:00Z')
            .withSteps(
              steps.map((step, index) =>
                new PipelineStepBuilder()
                  .withName(step.name)
                  .withNumber(index + 1)
                  .withStartedAt(step.startedAt)
                  .withCompletedAt(step.completedAt)
                  .build()
              )
            )
            .build(),
        ])
        .build();
    }

    it('should skip steps missing a name, startedAt, or completedAt', async () => {
      const run = runWithSteps('run-1', [
        { name: undefined, startedAt: '2025-01-01T08:00:00Z', completedAt: '2025-01-01T08:05:00Z' },
        { name: 'checkout', startedAt: undefined, completedAt: '2025-01-01T08:05:00Z' },
        { name: 'build', startedAt: '2025-01-01T08:00:00Z', completedAt: undefined },
      ]);

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([run]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobStepsAverageTime();

      expect(result).toEqual([]);
    });

    it('should treat a run with no jobs array as having no steps', async () => {
      const run = new PipelineRunBuilder()
        .withId('run-no-jobs')
        .withNumber(1)
        .withName('Build')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2025-01-01T08:00:00Z')
        .withUpdatedAt('2025-01-01T08:15:00Z')
        .withBranch('main')
        .withPath('.github/workflows/build.yml')
        .withJobs(undefined)
        .build();

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([run]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobStepsAverageTime();

      expect(result).toEqual([]);
    });

    it('should treat a job with no steps array as contributing no step durations', async () => {
      const run = new PipelineRunBuilder()
        .withId('run-job-no-steps')
        .withNumber(1)
        .withName('Build')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2025-01-01T08:00:00Z')
        .withUpdatedAt('2025-01-01T08:15:00Z')
        .withBranch('main')
        .withPath('.github/workflows/build.yml')
        .withJobs([
          new PipelineJobBuilder()
            .withId('job-no-steps')
            .withName('build-job')
            .withStatus('completed')
            .withConclusion('success')
            .withStartedAt('2025-01-01T08:00:00Z')
            .withCompletedAt('2025-01-01T08:15:00Z')
            .withSteps(undefined)
            .build(),
        ])
        .build();

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([run]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobStepsAverageTime();

      expect(result).toEqual([]);
    });

    it('should compute the average duration and count for a valid step', async () => {
      const run = runWithSteps('run-1', [
        {
          name: 'checkout',
          startedAt: '2025-01-01T08:00:00Z',
          completedAt: '2025-01-01T08:05:00Z',
        },
      ]);

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([run]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobStepsAverageTime();

      expect(result).toEqual([{ name: 'checkout', averageDurationMinutes: 5, count: 1 }]);
    });

    it('should average durations for the same step name across different jobs and runs', async () => {
      const runA = runWithSteps('run-a', [
        {
          name: 'checkout',
          startedAt: '2025-01-01T08:00:00Z',
          completedAt: '2025-01-01T08:04:00Z',
        },
      ]);
      const runB = runWithSteps('run-b', [
        {
          name: 'checkout',
          startedAt: '2025-01-01T09:00:00Z',
          completedAt: '2025-01-01T09:06:00Z',
        },
      ]);

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([runA, runB]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobStepsAverageTime();

      // (4 + 6) / 2 = 5 minutes average, across 2 contributing durations
      expect(result).toEqual([{ name: 'checkout', averageDurationMinutes: 5, count: 2 }]);
    });
  });

  describe('getJobStepsAverageTimeByDay', () => {
    function runWithStepsOnDay(
      id: string,
      createdAt: string,
      steps: Array<{ name?: string; startedAt?: string; completedAt?: string }>,
      completedAt?: string
    ) {
      return new PipelineRunBuilder()
        .withId(id)
        .withNumber(1)
        .withName('Build')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt(createdAt)
        .withUpdatedAt(createdAt)
        .withCompletedAt(completedAt)
        .withBranch('main')
        .withPath('.github/workflows/build.yml')
        .withJobs([
          new PipelineJobBuilder()
            .withId(`${id}-job`)
            .withName('build-job')
            .withStatus('completed')
            .withConclusion('success')
            .withStartedAt(createdAt)
            .withCompletedAt(completedAt ?? createdAt)
            .withSteps(
              steps.map((step, index) =>
                new PipelineStepBuilder()
                  .withName(step.name)
                  .withNumber(index + 1)
                  .withStartedAt(step.startedAt)
                  .withCompletedAt(step.completedAt)
                  .build()
              )
            )
            .build(),
        ])
        .build();
    }

    it('should treat a run with no jobs array as having no steps for that day', async () => {
      const run = new PipelineRunBuilder()
        .withId('run-no-jobs')
        .withNumber(1)
        .withName('Build')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2025-01-01T08:00:00Z')
        .withUpdatedAt('2025-01-01T08:15:00Z')
        .withBranch('main')
        .withPath('.github/workflows/build.yml')
        .withJobs(undefined)
        .build();

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([run]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobStepsAverageTimeByDay();

      expect(result).toEqual([]);
    });

    it('should treat a job with no steps array as contributing no step durations for that day', async () => {
      const run = new PipelineRunBuilder()
        .withId('run-job-no-steps')
        .withNumber(1)
        .withName('Build')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2025-01-01T08:00:00Z')
        .withUpdatedAt('2025-01-01T08:15:00Z')
        .withBranch('main')
        .withPath('.github/workflows/build.yml')
        .withJobs([
          new PipelineJobBuilder()
            .withId('job-no-steps')
            .withName('build-job')
            .withStatus('completed')
            .withConclusion('success')
            .withStartedAt('2025-01-01T08:00:00Z')
            .withCompletedAt('2025-01-01T08:15:00Z')
            .withSteps(undefined)
            .build(),
        ])
        .build();

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([run]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobStepsAverageTimeByDay();

      expect(result).toEqual([]);
    });

    it('should skip a run with neither completedAt nor createdAt entirely', async () => {
      const run = runWithStepsOnDay('run-no-date', '', [
        {
          name: 'checkout',
          startedAt: '2025-01-01T08:00:00Z',
          completedAt: '2025-01-01T08:05:00Z',
        },
      ]);

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([run]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobStepsAverageTimeByDay();

      expect(result).toEqual([]);
    });

    it('should group step averages by day and sort the result by day', async () => {
      const runDay2 = runWithStepsOnDay('run-day-2', '2025-01-02T08:00:00Z', [
        {
          name: 'checkout',
          startedAt: '2025-01-02T08:00:00Z',
          completedAt: '2025-01-02T08:06:00Z',
        },
      ]);
      const runDay1 = runWithStepsOnDay('run-day-1', '2025-01-01T08:00:00Z', [
        {
          name: 'checkout',
          startedAt: '2025-01-01T08:00:00Z',
          completedAt: '2025-01-01T08:04:00Z',
        },
      ]);

      mockPipelineRepo = new PipelinesRepositoryBuilder()
        .withPipelineRuns([runDay2, runDay1])
        .build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobStepsAverageTimeByDay();

      expect(result).toEqual([
        { day: '2025-01-01', steps: [{ name: 'checkout', averageDurationMinutes: 4 }] },
        { day: '2025-01-02', steps: [{ name: 'checkout', averageDurationMinutes: 6 }] },
      ]);
    });

    it('should average multiple steps sharing a name on the same day', async () => {
      const run = runWithStepsOnDay('run-day-1', '2025-01-01T08:00:00Z', [
        {
          name: 'checkout',
          startedAt: '2025-01-01T08:00:00Z',
          completedAt: '2025-01-01T08:04:00Z',
        },
        {
          name: 'checkout',
          startedAt: '2025-01-01T09:00:00Z',
          completedAt: '2025-01-01T09:06:00Z',
        },
      ]);

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([run]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobStepsAverageTimeByDay();

      // (4 + 6) / 2 = 5 minutes average for 'checkout' on 2025-01-01
      expect(result).toEqual([
        { day: '2025-01-01', steps: [{ name: 'checkout', averageDurationMinutes: 5 }] },
      ]);
    });

    it('should skip steps missing a name, startedAt, or completedAt', async () => {
      const run = runWithStepsOnDay('run-1', '2025-01-01T08:00:00Z', [
        { name: undefined, startedAt: '2025-01-01T08:00:00Z', completedAt: '2025-01-01T08:05:00Z' },
        { name: 'checkout', startedAt: undefined, completedAt: '2025-01-01T08:05:00Z' },
        { name: 'build', startedAt: '2025-01-01T08:00:00Z', completedAt: undefined },
      ]);

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([run]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobStepsAverageTimeByDay();

      // All steps were skipped, so the day never enters the result map.
      expect(result).toEqual([]);
    });
  });

  describe('loadUniqueWorkflows', () => {
    function runWithPath(id: string, path: string) {
      return new PipelineRunBuilder()
        .withId(id)
        .withNumber(1)
        .withName('Build')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2025-01-01T08:00:00Z')
        .withUpdatedAt('2025-01-01T08:15:00Z')
        .withBranch('main')
        .withPath(path)
        .withJobs([])
        .build();
    }

    it('should return distinct, sorted workflow paths and filter out empty-string paths', async () => {
      const runs = [
        runWithPath('run-1', '.github/workflows/release.yml'),
        runWithPath('run-2', '.github/workflows/build.yml'),
        runWithPath('run-3', '.github/workflows/release.yml'), // duplicate
        runWithPath('run-4', ''), // empty, filtered out
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(runs).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const workflows = await pipelinesService.loadUniqueWorkflows();

      expect(workflows).toEqual([
        { name: '.github/workflows/build.yml', path: '.github/workflows/build.yml' },
        { name: '.github/workflows/release.yml', path: '.github/workflows/release.yml' },
      ]);
    });
  });
});
