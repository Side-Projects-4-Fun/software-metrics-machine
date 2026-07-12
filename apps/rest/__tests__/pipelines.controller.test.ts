import { describe, expect, it, vi } from 'vitest';
import { PipelinesController } from '../src/controllers/pipelines.controller';
import { PipelinesService } from '@smmachine/core';
import { TimeZoneProvider } from '@smmachine/core/infrastructure/timezone-provider';
import { Logger } from '@smmachine/utils';

describe('PipelinesController', () => {
  function createController(runs: unknown[], filtersRepository?: unknown) {
    const pipelinesRepo = {
      loadPipelines: vi.fn().mockResolvedValue(runs),
    };
    const pipelinesService = new PipelinesService(
      pipelinesRepo as never,
      undefined,
      new Logger('test'),
      new TimeZoneProvider('UTC')
    );
    const controller = new PipelinesController(
      pipelinesRepo as never,
      pipelinesService,
      (filtersRepository || {}) as never
    );

    return { controller, pipelinesRepo, pipelinesService };
  }

  it('passes date filters to the repository for the runs-by chart', async () => {
    const { controller, pipelinesRepo } = createController([
      {
        path: 'ci.yml',
        createdAt: '2026-05-09T23:55:00Z',
        completedAt: '2026-05-10T00:05:00Z',
      },
      {
        path: 'ci.yml',
        createdAt: '2026-05-10T10:00:00Z',
        completedAt: '2026-05-10T10:30:00Z',
      },
    ]);

    const result = await controller.runsBy('day', {
      start_date: '2026-05-10',
      end_date: '2026-05-10',
    });

    expect(pipelinesRepo.loadPipelines).toHaveBeenCalledWith(
      expect.objectContaining({
        includeJobs: false,
        startDate: '2026-05-10',
        endDate: '2026-05-10',
      })
    );
    expect(result).toEqual([{ period: '2026-05-10', workflow: 'ci.yml', runs: 2 }]);
  });

  it('defaults aggregation to week when aggregate_by is omitted or unrecognized', async () => {
    const { controller } = createController([
      { path: 'ci.yml', createdAt: '2026-01-05T00:00:00Z' },
      { path: 'ci.yml', createdAt: '2026-01-06T00:00:00Z' },
    ]);

    const result = await controller.runsBy(undefined, {});

    expect(result).toEqual([{ period: '2026-W01', workflow: 'ci.yml', runs: 2 }]);
  });

  it('aggregates by month when aggregate_by is month', async () => {
    const { controller } = createController([
      { path: 'ci.yml', createdAt: '2026-01-05T00:00:00Z' },
      { path: 'ci.yml', createdAt: '2026-01-20T00:00:00Z' },
    ]);

    const result = await controller.runsBy('month', {});

    expect(result).toEqual([{ period: '2026-01', workflow: 'ci.yml', runs: 2 }]);
  });

  it('skips runs whose metric date cannot be resolved', async () => {
    const { controller } = createController([
      { path: 'ci.yml' },
      { path: 'ci.yml', createdAt: '2026-01-05T00:00:00Z' },
    ]);

    const result = await controller.runsBy('day', {});

    expect(result).toEqual([{ period: '2026-01-05', workflow: 'ci.yml', runs: 1 }]);
  });

  it('sorts multiple periods ascending by period key', async () => {
    const { controller } = createController([
      { path: 'ci.yml', createdAt: '2026-01-06T00:00:00Z' },
      { path: 'ci.yml', createdAt: '2026-01-05T00:00:00Z' },
    ]);

    const result = await controller.runsBy('day', {});

    expect(result).toEqual([
      { period: '2026-01-05', workflow: 'ci.yml', runs: 1 },
      { period: '2026-01-06', workflow: 'ci.yml', runs: 1 },
    ]);
  });

  it('calculates run duration from jobs instead of stale workflow updated time', async () => {
    const { controller, pipelinesRepo } = createController([
      {
        path: 'ci.yml',
        createdAt: '2025-01-01T10:00:00Z',
        startedAt: '2025-01-01T10:00:00Z',
        completedAt: '2026-02-05T10:05:00Z',
        jobs: [
          {
            name: 'build',
            startedAt: '2025-01-01T10:01:00Z',
            completedAt: '2025-01-01T10:05:00Z',
          },
        ],
      },
    ]);

    const result = await controller.runsDuration(undefined, {});

    expect(pipelinesRepo.loadPipelines).toHaveBeenCalledWith(
      expect.objectContaining({ includeJobs: true })
    );
    expect(result).toEqual([
      {
        workflow: 'ci.yml',
        avg_duration: 4,
        min_duration: 4,
        max_duration: 4,
        total_runs: 1,
      },
    ]);
  });

  describe('runsDuration', () => {
    it('sorts multiple workflows by total_runs descending', async () => {
      const { controller } = createController([
        {
          path: 'frequent.yml',
          jobs: [
            {
              name: 'build',
              startedAt: '2026-01-01T00:00:00Z',
              completedAt: '2026-01-01T00:02:00Z',
            },
          ],
        },
        {
          path: 'frequent.yml',
          jobs: [
            {
              name: 'build',
              startedAt: '2026-01-02T00:00:00Z',
              completedAt: '2026-01-02T00:02:00Z',
            },
          ],
        },
        {
          path: 'rare.yml',
          jobs: [
            {
              name: 'build',
              startedAt: '2026-01-01T00:00:00Z',
              completedAt: '2026-01-01T00:02:00Z',
            },
          ],
        },
      ]);

      const result = await controller.runsDuration(undefined, {});

      expect(result.map((row) => row.workflow)).toEqual(['frequent.yml', 'rare.yml']);
    });

    it('skips runs whose duration cannot be resolved', async () => {
      const { controller } = createController([
        { path: 'ci.yml', createdAt: '2026-01-01T00:00:00Z', jobs: [] },
      ]);

      const result = await controller.runsDuration(undefined, {});

      expect(result).toEqual([]);
    });

    it('falls back to unknown workflow when path is missing', async () => {
      const { controller } = createController([
        {
          jobs: [
            {
              name: 'build',
              startedAt: '2026-01-01T00:00:00Z',
              completedAt: '2026-01-01T00:02:00Z',
            },
          ],
        },
      ]);

      const result = await controller.runsDuration(undefined, {});

      expect(result).toEqual([
        { workflow: 'unknown', avg_duration: 2, min_duration: 2, max_duration: 2, total_runs: 1 },
      ]);
    });

    it.each([
      ['avg', 6],
      ['min', 4],
      ['max', 8],
    ])(
      'returns a single-duration shape when aggregation is %s',
      async (aggregation, expectedDuration) => {
        const { controller } = createController([
          {
            path: 'ci.yml',
            jobs: [
              {
                name: 'build',
                startedAt: '2026-01-01T00:00:00Z',
                completedAt: '2026-01-01T00:04:00Z',
              },
            ],
          },
          {
            path: 'ci.yml',
            jobs: [
              {
                name: 'build',
                startedAt: '2026-01-02T00:00:00Z',
                completedAt: '2026-01-02T00:08:00Z',
              },
            ],
          },
        ]);

        const result = await controller.runsDuration(aggregation, {});

        expect(result).toEqual([
          {
            workflow: 'ci.yml',
            aggregation,
            duration: expectedDuration,
            total_runs: 2,
          },
        ]);
      }
    );
  });

  describe('jobsDurationByWorkflow', () => {
    it('groups job durations by workflow then job name, skipping blank names and unresolved durations', async () => {
      const { controller } = createController([
        {
          path: 'ci.yml',
          jobs: [
            {
              name: 'build',
              startedAt: '2026-01-01T00:00:00Z',
              completedAt: '2026-01-01T00:04:00Z',
            },
            {
              name: 'build',
              startedAt: '2026-01-02T00:00:00Z',
              completedAt: '2026-01-02T00:08:00Z',
            },
            { name: '   ', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:04:00Z' },
            {
              name: 'broken',
              startedAt: '2026-01-01T00:10:00Z',
              completedAt: '2026-01-01T00:00:00Z',
            },
          ],
        },
      ]);

      const result = await controller.jobsDurationByWorkflow({});

      expect(result).toEqual([{ workflow: 'ci.yml', jobs: { build: 6 } }]);
    });

    it('falls back to unknown workflow and an empty job list when path/jobs are missing', async () => {
      const { controller } = createController([{}]);

      const result = await controller.jobsDurationByWorkflow({});

      expect(result).toEqual([]);
    });

    it('sorts multiple workflows alphabetically', async () => {
      const { controller } = createController([
        {
          path: 'zeta.yml',
          jobs: [
            {
              name: 'build',
              startedAt: '2026-01-01T00:00:00Z',
              completedAt: '2026-01-01T00:02:00Z',
            },
          ],
        },
        {
          path: 'alpha.yml',
          jobs: [
            {
              name: 'build',
              startedAt: '2026-01-01T00:00:00Z',
              completedAt: '2026-01-01T00:02:00Z',
            },
          ],
        },
      ]);

      const result = await controller.jobsDurationByWorkflow({});

      expect(result).toEqual([
        { workflow: 'alpha.yml', jobs: { build: 2 } },
        { workflow: 'zeta.yml', jobs: { build: 2 } },
      ]);
    });
  });

  describe('jobsAverageTime', () => {
    it('groups by job name, skipping blank names and unresolved durations', async () => {
      const { controller } = createController([
        {
          jobs: [
            {
              name: 'build',
              workflow_name: 'CI',
              startedAt: '2026-01-01T00:00:00Z',
              completedAt: '2026-01-01T00:04:00Z',
            },
            {
              name: 'build',
              workflow_name: 'CI',
              startedAt: '2026-01-02T00:00:00Z',
              completedAt: '2026-01-02T00:08:00Z',
            },
            { name: '  ', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:04:00Z' },
            {
              name: 'broken',
              startedAt: '2026-01-01T00:10:00Z',
              completedAt: '2026-01-01T00:00:00Z',
            },
          ],
        },
      ]);

      const result = await controller.jobsAverageTime(undefined, undefined, {});

      expect(result).toEqual({
        result: [{ job_name: 'build', workflow_name: 'CI', avg_time: 6, count: 2 }],
      });
    });

    it('limits results using the top query param', async () => {
      const { controller } = createController([
        {
          jobs: [
            { name: 'a', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:01:00Z' },
            { name: 'b', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:02:00Z' },
            { name: 'b', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:02:00Z' },
          ],
        },
      ]);

      const result = await controller.jobsAverageTime(undefined, '1', {});

      expect(result).toEqual({
        result: [{ job_name: 'b', workflow_name: undefined, avg_time: 2, count: 2 }],
      });
    });

    it('falls back to a default top of 20 when top is non-numeric', async () => {
      const { controller } = createController([
        {
          jobs: [
            { name: 'a', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:01:00Z' },
          ],
        },
      ]);

      const result = await controller.jobsAverageTime(undefined, 'not-a-number', {});

      expect(result).toEqual({
        result: [{ job_name: 'a', workflow_name: undefined, avg_time: 1, count: 1 }],
      });
    });

    it('forwards exclude_jobs to the repository as exclude_job_name', async () => {
      const { controller, pipelinesRepo } = createController([]);

      await controller.jobsAverageTime('flaky-job', undefined, {});

      expect(pipelinesRepo.loadPipelines).toHaveBeenCalledWith(
        expect.objectContaining({ excludeJobName: 'flaky-job' })
      );
    });
  });

  describe('filter option endpoints', () => {
    function buildOptions() {
      return {
        workflows: [{ name: 'CI', path: 'ci.yml' }],
        statuses: ['completed', 'queued'],
        conclusions: ['success', 'failure'],
        branches: ['main', 'develop'],
        events: ['push', 'pull_request'],
        jobs: [{ name: 'build', id: 'build' }],
        jobsByWorkflowPath: { 'ci.yml': [{ name: 'build', id: 'build' }] },
      };
    }

    it('workflows extracts the workflows field', async () => {
      const options = buildOptions();
      const loadOptions = vi.fn().mockResolvedValue(options);
      const { controller } = createController([], { loadOptions });

      const result = await controller.workflows();

      expect(result).toEqual(options.workflows);
    });

    it('statuses extracts the statuses field', async () => {
      const options = buildOptions();
      const loadOptions = vi.fn().mockResolvedValue(options);
      const { controller } = createController([], { loadOptions });

      const result = await controller.statuses();

      expect(result).toEqual(options.statuses);
    });

    it('conclusions extracts the conclusions field', async () => {
      const options = buildOptions();
      const loadOptions = vi.fn().mockResolvedValue(options);
      const { controller } = createController([], { loadOptions });

      const result = await controller.conclusions();

      expect(result).toEqual(options.conclusions);
    });

    it('branches extracts the branches field', async () => {
      const options = buildOptions();
      const loadOptions = vi.fn().mockResolvedValue(options);
      const { controller } = createController([], { loadOptions });

      const result = await controller.branches();

      expect(result).toEqual(options.branches);
    });

    it('events extracts the events field', async () => {
      const options = buildOptions();
      const loadOptions = vi.fn().mockResolvedValue(options);
      const { controller } = createController([], { loadOptions });

      const result = await controller.events();

      expect(result).toEqual(options.events);
    });

    it('jobs forwards workflow_path as a filter and extracts the jobs field', async () => {
      const options = buildOptions();
      const loadOptions = vi.fn().mockResolvedValue(options);
      const { controller } = createController([], { loadOptions });

      const result = await controller.jobs({ workflow_path: 'ci.yml' });

      expect(loadOptions).toHaveBeenCalledWith({ workflowPath: 'ci.yml' });
      expect(result).toEqual(options.jobs);
    });

    it('filterOptions forwards workflow_path and returns the whole options object', async () => {
      const options = buildOptions();
      const loadOptions = vi.fn().mockResolvedValue(options);
      const { controller } = createController([], { loadOptions });

      const result = await controller.filterOptions({ workflow_path: 'ci.yml' });

      expect(loadOptions).toHaveBeenCalledWith({ workflowPath: 'ci.yml' });
      expect(result).toEqual(options);
    });
  });

  describe('jobsAverageTimeByDay', () => {
    it('groups job durations by day across all jobs', async () => {
      const { controller } = createController([
        {
          createdAt: '2026-01-01T00:00:00Z',
          jobs: [
            {
              name: 'build',
              startedAt: '2026-01-01T00:00:00Z',
              completedAt: '2026-01-01T00:02:00Z',
            },
            {
              name: 'test',
              startedAt: '2026-01-01T00:00:00Z',
              completedAt: '2026-01-01T00:04:00Z',
            },
          ],
        },
      ]);

      const result = await controller.jobsAverageTimeByDay(undefined, {});

      expect(result).toEqual({
        result: [{ day: '2026-01-01', avg_time: 3, count: 2 }],
      });
    });

    it('skips jobs with blank names or unresolved durations, and sorts multiple days ascending', async () => {
      const { controller } = createController([
        {
          createdAt: '2026-01-02T00:00:00Z',
          jobs: [
            {
              name: 'build',
              startedAt: '2026-01-02T00:00:00Z',
              completedAt: '2026-01-02T00:02:00Z',
            },
            { name: '   ', startedAt: '2026-01-02T00:00:00Z', completedAt: '2026-01-02T00:02:00Z' },
            {
              name: 'broken',
              startedAt: '2026-01-02T00:10:00Z',
              completedAt: '2026-01-02T00:00:00Z',
            },
          ],
        },
        {
          createdAt: '2026-01-01T00:00:00Z',
          jobs: [
            {
              name: 'build',
              startedAt: '2026-01-01T00:00:00Z',
              completedAt: '2026-01-01T00:01:00Z',
            },
          ],
        },
      ]);

      const result = await controller.jobsAverageTimeByDay(undefined, {});

      expect(result).toEqual({
        result: [
          { day: '2026-01-01', avg_time: 1, count: 1 },
          { day: '2026-01-02', avg_time: 2, count: 1 },
        ],
      });
    });

    it('skips runs entirely when the run metric date cannot be resolved', async () => {
      const { controller } = createController([
        {
          jobs: [
            {
              name: 'build',
              startedAt: '2026-01-01T00:00:00Z',
              completedAt: '2026-01-01T00:02:00Z',
            },
          ],
        },
        {
          createdAt: '2026-01-02T00:00:00Z',
          jobs: [
            {
              name: 'build',
              startedAt: '2026-01-02T00:00:00Z',
              completedAt: '2026-01-02T00:02:00Z',
            },
          ],
        },
      ]);

      const result = await controller.jobsAverageTimeByDay(undefined, {});

      expect(result).toEqual({
        result: [{ day: '2026-01-02', avg_time: 2, count: 1 }],
      });
    });

    it('forwards exclude_jobs to the repository as exclude_job_name', async () => {
      const { controller, pipelinesRepo } = createController([]);

      await controller.jobsAverageTimeByDay('flaky-job', {});

      expect(pipelinesRepo.loadPipelines).toHaveBeenCalledWith(
        expect.objectContaining({ excludeJobName: 'flaky-job' })
      );
    });
  });

  describe('jobsStepsAverageTime', () => {
    it('wraps the service result in a result envelope', async () => {
      const { controller } = createController([
        {
          jobs: [
            {
              steps: [
                {
                  name: 'install',
                  startedAt: '2026-01-01T00:00:00Z',
                  completedAt: '2026-01-01T00:02:00Z',
                },
              ],
            },
          ],
        },
      ]);

      const result = await controller.jobsStepsAverageTime({});

      expect(result).toEqual({
        result: [{ name: 'install', averageDurationMinutes: 2, count: 1 }],
      });
    });
  });

  describe('jobsStepsAverageTimeByDay', () => {
    it('wraps the service result in a result envelope', async () => {
      const { controller } = createController([
        {
          createdAt: '2026-01-01T00:00:00Z',
          jobs: [
            {
              steps: [
                {
                  name: 'install',
                  startedAt: '2026-01-01T00:00:00Z',
                  completedAt: '2026-01-01T00:02:00Z',
                },
              ],
            },
          ],
        },
      ]);

      const result = await controller.jobsStepsAverageTimeByDay({});

      expect(result).toEqual({
        result: [{ day: '2026-01-01', steps: [{ name: 'install', averageDurationMinutes: 2 }] }],
      });
    });
  });

  describe('pipelineSummary', () => {
    it('returns zeroed summary with null first/last run when there are no runs', async () => {
      const { controller, pipelinesRepo } = createController([]);

      const result = await controller.pipelineSummary({});

      expect(pipelinesRepo.loadPipelines).toHaveBeenCalledWith(
        expect.objectContaining({
          includeJobs: false,
          sort_by: { created_at: 'asc' },
        })
      );
      expect(result).toEqual({
        total_runs: 0,
        first_run: null,
        last_run: null,
        in_progress: 0,
        queued: 0,
      });
    });

    it('reports first/last run and case-insensitive in_progress/queued counts', async () => {
      const firstRun = { path: 'ci.yml', createdAt: '2026-01-01T00:00:00Z', status: 'IN_PROGRESS' };
      const middleRun = { path: 'ci.yml', createdAt: '2026-01-02T00:00:00Z', status: 'Queued' };
      const lastRun = { path: 'ci.yml', createdAt: '2026-01-03T00:00:00Z', status: 'completed' };
      const { controller } = createController([firstRun, middleRun, lastRun]);

      const result = await controller.pipelineSummary({});

      expect(result).toEqual({
        total_runs: 3,
        first_run: firstRun,
        last_run: lastRun,
        in_progress: 1,
        queued: 1,
      });
    });

    it('treats a missing status as neither in_progress nor queued', async () => {
      const { controller } = createController([
        { path: 'ci.yml', createdAt: '2026-01-01T00:00:00Z' },
      ]);

      const result = await controller.pipelineSummary({});

      expect(result.in_progress).toBe(0);
      expect(result.queued).toBe(0);
    });

    it('forwards weekends filtering to repository so total runs reflects excluded weekends', async () => {
      const { controller, pipelinesRepo } = createController([]);

      await controller.pipelineSummary({ weekends: 'weekends_only' });

      expect(pipelinesRepo.loadPipelines).toHaveBeenCalledWith(
        expect.objectContaining({
          includeJobs: false,
          weekends: 'weekends_only',
          sort_by: { created_at: 'asc' },
        })
      );
    });
  });

  describe('byStatus', () => {
    it('groups runs by status, defaulting missing status to unknown, sorted by count descending', async () => {
      const { controller } = createController([
        { status: 'completed' },
        { status: 'completed' },
        { status: 'queued' },
        {},
      ]);

      const result = await controller.byStatus({});

      expect(result).toEqual([
        { status: 'completed', count: 2 },
        { status: 'queued', count: 1 },
        { status: 'unknown', count: 1 },
      ]);
    });
  });

  describe('jobsByStatus', () => {
    it('groups jobs by conclusion, falling back to status, then unknown, sorted by count descending', async () => {
      const { controller } = createController([
        {
          jobs: [
            { conclusion: 'success' },
            { conclusion: 'success' },
            { status: 'in_progress' },
            {},
          ],
        },
      ]);

      const result = await controller.jobsByStatus({});

      expect(result).toEqual([
        { Status: 'success', Count: 2 },
        { Status: 'in_progress', Count: 1 },
        { Status: 'unknown', Count: 1 },
      ]);
    });
  });

  describe('jobsSummary', () => {
    it('maps job metrics fields from the service to the response shape', async () => {
      const { controller } = createController([
        {
          runAttempt: 2,
          jobs: [
            {
              name: 'build',
              conclusion: 'success',
              startedAt: '2026-01-01T00:00:00Z',
              completedAt: '2026-01-01T00:10:00Z',
            },
          ],
        },
      ]);

      const result = await controller.jobsSummary({});

      expect(result).toEqual({
        result: [
          {
            workflow_name: undefined,
            job_name: 'build',
            total_runs: 1,
            avg_duration_minutes: 10,
            success_count: 1,
            failure_count: 0,
            success_rate: 100,
            failure_rate: 0,
            rerun_count: 1,
          },
        ],
      });
    });
  });

  describe('jobsRerunsByDay', () => {
    it('wraps the service result in a result envelope', async () => {
      const { controller } = createController([
        { createdAt: '2026-01-01T00:00:00Z', runAttempt: 3 },
        { createdAt: '2026-01-01T05:00:00Z', runAttempt: 1 },
      ]);

      const result = await controller.jobsRerunsByDay({});

      expect(result).toEqual({
        result: [{ day: '2026-01-01', rerun_count: 2 }],
      });
    });
  });
});
