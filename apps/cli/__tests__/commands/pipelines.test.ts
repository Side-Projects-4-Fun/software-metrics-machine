import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { commands } from '../../src';
import { PipelineFactory, PipelineImplementation } from '@smmachine/core';
import { DeploymentFrequencyService } from '@smmachine/core/domain/pipelines/services/deployment-frequency-service';

describe('cli: Pipelines Commands', () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let fetchPipelinesMock: ReturnType<typeof vi.fn>;
  let fetchJobsMock: ReturnType<typeof vi.fn>;
  let dashboardMock: ReturnType<typeof vi.spyOn>;

  const getOutput = () =>
    consoleSpy.mock.calls
      .flat()
      .filter((value: unknown): value is string => typeof value === 'string')
      .join('\n');

  beforeEach(() => {
    vi.stubEnv('SMM_STORE_DATA_AT', '/tmp');
    vi.stubEnv('OWNER_REPO_GIT_PROVIDER', 'github');
    vi.stubEnv('OWNER_REPO_GITHUB_TOKEN', 'fake-token');
    vi.stubEnv('OWNER_REPO_GIT_REPOSITORY_PATH', '/tmp/repo');

    fetchPipelinesMock = vi.fn().mockResolvedValue(undefined);
    fetchJobsMock = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(PipelineFactory, 'create').mockReturnValue({
      pipelineRepository: {} as never,
      pipelineFiltersRepository: {} as never,
      workflowRepository: {
        fetchPipelines: fetchPipelinesMock,
      } as never,
      workflowJobRepository: {
        fetchJobs: fetchJobsMock,
      } as never,
    });

    dashboardMock = vi.spyOn(PipelineImplementation.prototype, 'dashboard').mockResolvedValue({
      summary: {
        total_runs: 10,
        successful_runs: 7,
        failed_runs: 2,
        cancelled_runs: 1,
        skipped_runs: 0,
        timed_out_runs: 0,
        success_rate: 70,
        average_duration_minutes: 42,
        first_run: null,
        last_run: null,
        in_progress: 0,
        queued: 0,
      },
      runs_by: [
        { period: '2026-07-01', workflow: 'ci.yml', runs: 2 },
        { period: '2026-07-02', workflow: 'ci.yml', runs: 1 },
        { period: '2026-07-02', workflow: 'release.yml', runs: 5 },
        { period: '2026-08-01', workflow: 'ci.yml', runs: 4 },
      ],
      jobs_summary: [],
      job_steps_average_time: [],
    } as never);

    vi.spyOn(
      DeploymentFrequencyService.prototype,
      'getDeploymentFrequencyWithAllIntervals'
    ).mockResolvedValue([
      {
        days: '2026-07-01',
        weeks: '2026-W27',
        months: '2026-07',
        daily_counts: 1,
        weekly_counts: 3,
        monthly_counts: 10,
      },
    ] as never);

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    program = commands();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('pipelines fetch', () => {
    it('forwards fetch options to workflow repository', async () => {
      await program.parseAsync(
        [
          'pipelines',
          'fetch',
          '--force',
          '--update',
          '--start-date',
          '2026-07-01',
          '--end-date',
          '2026-07-31',
          '--raw-filters',
          'status=success',
          '--by-day',
        ],
        { from: 'user' }
      );

      expect(fetchPipelinesMock).toHaveBeenCalledWith({
        forceRefresh: true,
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        rawFilters: 'status=success',
        byDay: true,
        incrementalUpdate: true,
      });
    });
  });

  describe('pipelines fetch-jobs', () => {
    it('forwards fetch-jobs options to workflow jobs repository', async () => {
      await program.parseAsync(
        [
          'pipelines',
          'fetch-jobs',
          '--force',
          '--update',
          '--run-start-date',
          '2026-07-01',
          '--run-end-date',
          '2026-07-31',
          '--raw-filters',
          'branch=main',
          '--by-day',
        ],
        { from: 'user' }
      );

      expect(fetchJobsMock).toHaveBeenCalledWith({
        forceRefresh: true,
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        rawFilters: 'branch=main',
        byDay: true,
        incrementalUpdate: true,
      });
    });
  });

  describe('pipelines by-status', () => {
    it('prints grouped status summary in text output', async () => {
      await program.parseAsync(['pipelines', 'by-status'], { from: 'user' });

      const output = getOutput();

      expect(output).toContain('=== Pipelines by Status ===');
      expect(output).toContain('✅ Successful: 7');
      expect(output).toContain('❌ Failed: 2');
      expect(output).toContain('📊 Total: 10');
    });
  });

  describe('pipelines runs-duration', () => {
    it('prints workflow and average duration in text output', async () => {
      await program.parseAsync(['pipelines', 'runs-duration', '--workflow', 'ci.yml'], {
        from: 'user',
      });

      const output = getOutput();

      expect(output).toContain('=== Pipeline Run Durations ===');
      expect(output).toContain('Workflow: ci.yml');
      expect(output).toContain('Average Duration: 42.00 minutes');
      expect(output).toContain('Total Runs: 10');
    });
  });

  describe('pipelines runs-by', () => {
    it('aggregates runs by month and pipeline when --period month is provided', async () => {
      await program.parseAsync(['pipelines', 'runs-by', '--period', 'month'], { from: 'user' });

      const output = getOutput();

      expect(output).toContain('Period: month');
      expect(output).toContain('Period: 2026-07 | Total Runs: 3 | Pipeline: ci.yml');
      expect(output).toContain('Period: 2026-07 | Total Runs: 5 | Pipeline: release.yml');
      expect(output).toContain('Period: 2026-08 | Total Runs: 4 | Pipeline: ci.yml');

      expect(output).not.toContain('Period: 2026-07-01 | Total Runs: 2 | Pipeline: ci.yml');
      expect(output).not.toContain('Period: 2026-07-02 | Total Runs: 1 | Pipeline: ci.yml');
    });

    it('aggregates runs by week and pipeline when --period week is provided', async () => {
      await program.parseAsync(['pipelines', 'runs-by', '--period', 'week'], { from: 'user' });

      const output = getOutput();

      expect(output).toContain('Period: week');
      expect(output).toMatch(/Period: \d{4}-W\d{2} \| Total Runs: 3 \| Pipeline: ci\.yml/);
      expect(output).toMatch(/Period: \d{4}-W\d{2} \| Total Runs: 5 \| Pipeline: release\.yml/);
      expect(output).toMatch(/Period: \d{4}-W\d{2} \| Total Runs: 4 \| Pipeline: ci\.yml/);

      expect(output).not.toContain('Period: 2026-07-01 | Total Runs: 2 | Pipeline: ci.yml');
      expect(output).not.toContain('Period: 2026-07-02 | Total Runs: 1 | Pipeline: ci.yml');
    });

    it('keeps day granularity when --period day is provided', async () => {
      await program.parseAsync(['pipelines', 'runs-by', '--period', 'day'], { from: 'user' });

      const output = getOutput();

      expect(output).toContain('Period: day');
      expect(output).toContain('Period: 2026-07-01 | Total Runs: 2 | Pipeline: ci.yml');
      expect(output).toContain('Period: 2026-07-02 | Total Runs: 1 | Pipeline: ci.yml');
      expect(output).toContain('Period: 2026-07-02 | Total Runs: 5 | Pipeline: release.yml');
      expect(output).toContain('Period: 2026-08-01 | Total Runs: 4 | Pipeline: ci.yml');

      expect(output).not.toContain('Period: 2026-07 | Total Runs: 3 | Pipeline: ci.yml');
    });
  });

  describe('pipelines summary', () => {
    it('prints pipeline summary in text output', async () => {
      await program.parseAsync(['pipelines', 'summary'], { from: 'user' });

      const output = getOutput();

      expect(output).toContain('=== Pipeline Summary ===');
      expect(output).toContain('Total Runs: 10');
      expect(output).toContain('Successful Runs: 7');
      expect(output).toContain('Failed Runs: 2');
      expect(output).toContain('Success Rate: 7000.0%');
      expect(output).toContain('Average Duration: 42.00 minutes');
    });

    it('forwards filter options to dashboard', async () => {
      await program.parseAsync(
        [
          'pipelines',
          'summary',
          '--start-date',
          '2026-07-01',
          '--end-date',
          '2026-07-31',
          '--raw-filters',
          'status=success',
          '--weekends',
          'exclude',
          '--outlier-mode',
          'flag',
        ],
        { from: 'user' }
      );

      expect(dashboardMock).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2026-07-01',
          endDate: '2026-07-31',
          rawFilters: 'status=success',
        })
      );
    });
  });

  describe('pipelines jobs-summary', () => {
    it('prints jobs summary in text output', async () => {
      dashboardMock.mockResolvedValueOnce({
        summary: {
          total_runs: 0,
          successful_runs: 0,
          failed_runs: 0,
          cancelled_runs: 0,
          skipped_runs: 0,
          timed_out_runs: 0,
          success_rate: 0,
          average_duration_minutes: 0,
          first_run: null,
          last_run: null,
          in_progress: 0,
          queued: 0,
        },
        runs_by: [],
        jobs_summary: [
          {
            job_name: 'build',
            total_runs: 8,
            rerun_count: 1,
            success_rate: 75,
            failure_rate: 25,
            avg_duration_minutes: 12.5,
            failure_count: 2,
          },
        ],
        job_steps_average_time: [],
      } as never);

      await program.parseAsync(['pipelines', 'jobs-summary'], { from: 'user' });

      const output = getOutput();

      expect(output).toContain('=== Pipeline Jobs Summary ===');
      expect(output).toContain('Job name: build');
      expect(output).toContain('Total Jobs: 8');
      expect(output).toContain('Reruns: 1');
      expect(output).toContain('Success rate: 75%');
      expect(output).toContain('Failure rate: 25%');
      expect(output).toContain('Average Duration Minutes: 12.5');
      expect(output).toContain('Failure count: 2');
    });
  });

  describe('pipelines jobs-time-execution', () => {
    it('prints job execution time details', async () => {
      dashboardMock.mockResolvedValueOnce({
        summary: {
          total_runs: 0,
          successful_runs: 0,
          failed_runs: 0,
          cancelled_runs: 0,
          skipped_runs: 0,
          timed_out_runs: 0,
          success_rate: 0,
          average_duration_minutes: 0,
          first_run: null,
          last_run: null,
          in_progress: 0,
          queued: 0,
        },
        runs_by: [],
        jobs_summary: [
          {
            job_name: 'test',
            total_runs: 4,
            failure_count: 1,
            success_rate: 75,
            avg_duration_minutes: 30,
          },
        ],
        job_steps_average_time: [],
      } as never);

      await program.parseAsync(['pipelines', 'jobs-time-execution'], { from: 'user' });

      const output = getOutput();

      expect(output).toContain('=== Job Execution Times ===');
      expect(output).toContain('Job: test');
      expect(output).toContain('Total runs: 4');
      expect(output).toContain('Failure count: 1');
      expect(output).toContain('Success rate: 75');
      expect(output).toContain('Average Execution Time: 30.00 minutes');
    });
  });

  describe('pipelines jobs-steps-average-time', () => {
    it('prints step average execution time details', async () => {
      dashboardMock.mockResolvedValueOnce({
        summary: {
          total_runs: 0,
          successful_runs: 0,
          failed_runs: 0,
          cancelled_runs: 0,
          skipped_runs: 0,
          timed_out_runs: 0,
          success_rate: 0,
          average_duration_minutes: 0,
          first_run: null,
          last_run: null,
          in_progress: 0,
          queued: 0,
        },
        runs_by: [],
        jobs_summary: [],
        job_steps_average_time: [
          {
            name: 'install dependencies',
            averageDurationMinutes: 2.5,
            count: 6,
          },
        ],
      } as never);

      await program.parseAsync(['pipelines', 'jobs-steps-average-time'], { from: 'user' });

      const output = getOutput();

      expect(output).toContain('=== Job Steps Execution Times ===');
      expect(output).toContain('Step: install dependencies');
      expect(output).toContain('Average Execution Time: 2.50 minutes');
      expect(output).toContain('Analyzed across 6 step executions');
    });
  });

  describe('pipelines jobs-by-status', () => {
    it('prints jobs grouped by status', async () => {
      dashboardMock.mockResolvedValueOnce({
        summary: {
          total_runs: 0,
          successful_runs: 0,
          failed_runs: 0,
          cancelled_runs: 0,
          skipped_runs: 0,
          timed_out_runs: 0,
          success_rate: 0,
          average_duration_minutes: 0,
          first_run: null,
          last_run: null,
          in_progress: 0,
          queued: 0,
        },
        runs_by: [],
        jobs_summary: [
          {
            job_name: 'deploy',
            success_count: 3,
            success_rate: 75,
            failure_count: 1,
            failure_rate: 25,
            avg_duration_minutes: 18,
          },
        ],
        job_steps_average_time: [],
      } as never);

      await program.parseAsync(['pipelines', 'jobs-by-status'], { from: 'user' });

      const output = getOutput();

      expect(output).toContain('=== Jobs by Status ===');
      expect(output).toContain('Name: deploy');
      expect(output).toContain('✅ Successful: 3, success rate: 75%');
      expect(output).toContain('❌ Failed: 1, failure rate: 25%');
      expect(output).toContain('Average duration in minutes: 18');
    });
  });

  describe('pipelines deployment-frequency', () => {
    it('prints deployment frequency and DORA rating', async () => {
      await program.parseAsync(['pipelines', 'deployment-frequency', '--period', 'week'], {
        from: 'user',
      });

      const output = getOutput();

      expect(output).toContain('=== Deployment Frequency (DORA) ===');
      expect(output).toContain('Period: 2026-07-01 (daily), 2026-W27 (weekly), 2026-07 (monthly)');
      expect(output).toContain('Total Deployments: 1 (daily), 3 (weekly), 10 (monthly)');
      expect(output).toContain('📈 DORA Rating: High');
    });
  });

  describe('pipelines lead-time', () => {
    it('prints lead time and DORA rating', async () => {
      await program.parseAsync(['pipelines', 'lead-time'], { from: 'user' });

      const output = getOutput();

      expect(output).toContain('=== Lead Time for Changes (DORA) ===');
      expect(output).toContain('Lead Time: 42.00 hours');
      expect(output).toContain('📈 DORA Rating: High');
    });
  });
});
