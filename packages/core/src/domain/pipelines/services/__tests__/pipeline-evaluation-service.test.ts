import { describe, it, expect } from 'vitest';
import { PipelineEvaluationService } from '../pipeline-evaluation-service';
import type { PipelineDashboard, PipelineDashboardSummary } from '../../pipeline-types';

function makeSummary(overrides: Partial<PipelineDashboardSummary> = {}): PipelineDashboardSummary {
  return {
    total_runs: 100,
    first_run: null,
    last_run: null,
    in_progress: 0,
    queued: 0,
    successful_runs: 90,
    failed_runs: 8,
    cancelled_runs: 1,
    skipped_runs: 1,
    timed_out_runs: 0,
    success_rate: 90,
    average_duration_minutes: 12.5,
    ...overrides,
  };
}

function makeDashboard(overrides: Partial<PipelineDashboard> = {}): PipelineDashboard {
  return {
    summary: makeSummary(),
    jobs_by_status: [
      { Status: 'success', Count: 90 },
      { Status: 'failure', Count: 8 },
      { Status: 'cancelled', Count: 2 },
    ],
    runs_duration: [
      { workflow: 'build.yml', avg_duration: 8, min_duration: 2, max_duration: 30, total_runs: 40 },
      { workflow: 'test.yml', avg_duration: 15, min_duration: 5, max_duration: 45, total_runs: 35 },
      { workflow: 'deploy.yml', avg_duration: 3, min_duration: 1, max_duration: 8, total_runs: 25 },
    ],
    runs_by: [],
    jobs_average_time: [
      { job_name: 'slow-build', workflow_name: 'build.yml', avg_time: 40, count: 40 },
      { job_name: 'lint', workflow_name: 'build.yml', avg_time: 3, count: 40 },
      { job_name: 'unit-test', workflow_name: 'test.yml', avg_time: 15, count: 35 },
      { job_name: 'integration-test', workflow_name: 'test.yml', avg_time: 25, count: 35 },
      { job_name: 'deploy', workflow_name: 'deploy.yml', avg_time: 2, count: 25 },
    ],
    jobs_average_time_by_day: [],
    jobs_duration_by_workflow: [
      { workflow: 'build.yml', jobs: { 'slow-build': 40, lint: 3 } },
      { workflow: 'test.yml', jobs: { 'unit-test': 15, 'integration-test': 25 } },
    ],
    jobs_summary: [
      {
        workflow_name: 'build.yml',
        job_name: 'slow-build',
        total_runs: 40,
        avg_duration_minutes: 40,
        success_count: 32,
        failure_count: 6,
        success_rate: 80,
        failure_rate: 15,
        rerun_count: 5,
      },
      {
        workflow_name: 'test.yml',
        job_name: 'unit-test',
        total_runs: 35,
        avg_duration_minutes: 15,
        success_count: 33,
        failure_count: 2,
        success_rate: 94.29,
        failure_rate: 5.71,
        rerun_count: 1,
      },
      {
        workflow_name: 'test.yml',
        job_name: 'integration-test',
        total_runs: 35,
        avg_duration_minutes: 25,
        success_count: 30,
        failure_count: 4,
        success_rate: 85.71,
        failure_rate: 11.43,
        rerun_count: 3,
      },
    ],
    jobs_reruns_by_day: [],
    job_steps_average_time: [],
    job_steps_average_time_by_day: [],
    ...overrides,
  };
}

describe('PipelineEvaluationService', () => {
  const service = new PipelineEvaluationService();

  describe('evaluate', () => {
    it('returns evaluation with generatedAt timestamp', () => {
      const dashboard = makeDashboard();
      const result = service.evaluate(dashboard);

      expect(result.generatedAt).toBeDefined();
      expect(new Date(result.generatedAt).getTime()).toBeGreaterThan(0);
    });

    it('includes all five signal types', () => {
      const dashboard = makeDashboard();
      const result = service.evaluate(dashboard);

      const ids = result.signals.map((s) => s.id);
      expect(ids).toContain('duration_top_job');
      expect(ids).toContain('stability_worst_job');
      expect(ids).toContain('rerun_analysis');
      expect(ids).toContain('slowest_workflow');
      expect(ids).toContain('job_overview');
    });

    it('builds summary with key metrics', () => {
      const dashboard = makeDashboard();
      const result = service.evaluate(dashboard);

      expect(result.summary.totalRuns).toBe(100);
      expect(result.summary.successRate).toBe(90);
      expect(result.summary.averageDurationMinutes).toBe(12.5);
      expect(result.summary.totalReruns).toBe(9);
      expect(result.summary.bottleneckJob).toBe('slow-build');
    });

    it('identifies the slowest workflow', () => {
      const dashboard = makeDashboard();
      const result = service.evaluate(dashboard);

      expect(result.summary.slowestWorkflow).toBe('test.yml');
    });
  });

  describe('duration bottleneck', () => {
    it('flags job that dominates total time as critical', () => {
      const dashboard = makeDashboard({
        jobs_average_time: [
          { job_name: 'heavy-job', workflow_name: 'ci.yml', avg_time: 60, count: 20 },
          { job_name: 'light-job', workflow_name: 'ci.yml', avg_time: 5, count: 20 },
        ],
      });
      const result = service.evaluate(dashboard);

      const signal = result.signals.find((s) => s.id === 'duration_top_job');
      expect(signal).toBeDefined();
      expect(signal!.severity).toBe('critical');
      expect(signal!.title).toContain('dominates');
    });

    it('reports good when jobs are balanced', () => {
      const dashboard = makeDashboard({
        jobs_average_time: [
          { job_name: 'job-a', workflow_name: 'ci.yml', avg_time: 10, count: 20 },
          { job_name: 'job-b', workflow_name: 'ci.yml', avg_time: 10, count: 20 },
          { job_name: 'job-c', workflow_name: 'ci.yml', avg_time: 10, count: 20 },
          { job_name: 'job-d', workflow_name: 'ci.yml', avg_time: 10, count: 20 },
          { job_name: 'job-e', workflow_name: 'ci.yml', avg_time: 10, count: 20 },
          { job_name: 'job-f', workflow_name: 'ci.yml', avg_time: 10, count: 20 },
        ],
      });
      const result = service.evaluate(dashboard);

      const signal = result.signals.find((s) => s.id === 'duration_top_job');
      expect(signal!.severity).toBe('good');
      expect(signal!.title).toContain('No single job dominates');
    });
  });

  describe('stability bottleneck', () => {
    it('flags high failure rate as critical', () => {
      const dashboard = makeDashboard({
        jobs_summary: [
          {
            workflow_name: 'ci.yml',
            job_name: 'flaky-job',
            total_runs: 10,
            avg_duration_minutes: 5,
            success_count: 6,
            failure_count: 4,
            success_rate: 60,
            failure_rate: 40,
            rerun_count: 2,
          },
        ],
      });
      const result = service.evaluate(dashboard);

      const signal = result.signals.find((s) => s.id === 'stability_worst_job');
      expect(signal).toBeDefined();
      expect(signal!.severity).toBe('critical');
      expect(signal!.description).toContain('40.');
    });

    it('reports good when all jobs have low failure rate', () => {
      const dashboard = makeDashboard({
        jobs_summary: [
          {
            workflow_name: 'ci.yml',
            job_name: 'stable-job',
            total_runs: 100,
            avg_duration_minutes: 5,
            success_count: 98,
            failure_count: 1,
            success_rate: 98,
            failure_rate: 1,
            rerun_count: 0,
          },
        ],
      });
      const result = service.evaluate(dashboard);

      const signal = result.signals.find((s) => s.id === 'stability_worst_job');
      expect(signal!.severity).toBe('good');
    });
  });

  describe('rerun analysis', () => {
    it('flags high rerun ratio as critical', () => {
      const dashboard = makeDashboard({
        jobs_summary: [
          {
            workflow_name: 'ci.yml',
            job_name: 'test',
            total_runs: 10,
            avg_duration_minutes: 5,
            success_count: 8,
            failure_count: 1,
            success_rate: 80,
            failure_rate: 10,
            rerun_count: 5,
          },
        ],
      });
      const result = service.evaluate(dashboard);

      const signal = result.signals.find((s) => s.id === 'rerun_analysis');
      expect(signal).toBeDefined();
      expect(signal!.severity).toBe('critical');
      expect(signal!.metrics).toHaveLength(4);
    });

    it('reports good when no reruns', () => {
      const dashboard = makeDashboard({
        jobs_summary: [
          {
            workflow_name: 'ci.yml',
            job_name: 'test',
            total_runs: 10,
            avg_duration_minutes: 5,
            success_count: 10,
            failure_count: 0,
            success_rate: 100,
            failure_rate: 0,
            rerun_count: 0,
          },
        ],
      });
      const result = service.evaluate(dashboard);

      const signal = result.signals.find((s) => s.id === 'rerun_analysis');
      expect(signal!.severity).toBe('good');
    });
  });

  describe('slowest workflow', () => {
    it('flags outlier workflow as critical', () => {
      const dashboard = makeDashboard({
        runs_duration: [
          {
            workflow: 'fast-a.yml',
            avg_duration: 2,
            min_duration: 1,
            max_duration: 5,
            total_runs: 10,
          },
          {
            workflow: 'fast-b.yml',
            avg_duration: 3,
            min_duration: 1,
            max_duration: 6,
            total_runs: 10,
          },
          {
            workflow: 'slow.yml',
            avg_duration: 45,
            min_duration: 30,
            max_duration: 60,
            total_runs: 10,
          },
        ],
      });
      const result = service.evaluate(dashboard);

      const signal = result.signals.find((s) => s.id === 'slowest_workflow');
      expect(signal).toBeDefined();
      expect(signal!.severity).toBe('critical');
      expect(signal!.metrics.find((m) => m.label === 'Slowest workflow')?.value).toBe('slow.yml');
    });

    it('reports good when durations are balanced', () => {
      const dashboard = makeDashboard({
        runs_duration: [
          {
            workflow: 'a.yml',
            avg_duration: 10,
            min_duration: 5,
            max_duration: 15,
            total_runs: 10,
          },
          {
            workflow: 'b.yml',
            avg_duration: 12,
            min_duration: 6,
            max_duration: 18,
            total_runs: 10,
          },
        ],
      });
      const result = service.evaluate(dashboard);

      const signal = result.signals.find((s) => s.id === 'slowest_workflow');
      expect(signal!.severity).toBe('good');
    });
  });

  describe('job overview', () => {
    it('computes failure rate from jobs_by_status', () => {
      const dashboard = makeDashboard({
        jobs_by_status: [
          { Status: 'success', Count: 80 },
          { Status: 'failure', Count: 20 },
        ],
      });
      const result = service.evaluate(dashboard);

      const signal = result.signals.find((s) => s.id === 'job_overview');
      expect(signal!.severity).toBe('critical');
      const failureMetric = signal!.metrics.find((m) => m.label === 'Failure rate');
      expect(failureMetric?.value).toBe('20.0%');
    });

    it('reports good when failure rate is low', () => {
      const dashboard = makeDashboard({
        jobs_by_status: [
          { Status: 'success', Count: 99 },
          { Status: 'failure', Count: 1 },
        ],
      });
      const result = service.evaluate(dashboard);

      const signal = result.signals.find((s) => s.id === 'job_overview');
      expect(signal!.severity).toBe('good');
    });
  });

  describe('empty data', () => {
    it('handles completely empty dashboard', () => {
      const dashboard: PipelineDashboard = {
        summary: makeSummary({
          total_runs: 0,
          successful_runs: 0,
          failed_runs: 0,
          success_rate: 0,
          average_duration_minutes: 0,
        }),
        jobs_by_status: [],
        runs_duration: [],
        runs_by: [],
        jobs_average_time: [],
        jobs_average_time_by_day: [],
        jobs_duration_by_workflow: [],
        jobs_summary: [],
        jobs_reruns_by_day: [],
        job_steps_average_time: [],
        job_steps_average_time_by_day: [],
      };
      const result = service.evaluate(dashboard);

      expect(result.signals.length).toBeGreaterThan(0);
      expect(result.summary.totalRuns).toBe(0);
      expect(result.summary.bottleneckJob).toBeUndefined();
    });
  });
});
