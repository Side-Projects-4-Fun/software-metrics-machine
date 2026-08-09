import { describe, it, expect, vi } from 'vitest';
import { PipelineEvaluationController } from '../src/controllers/pipeline-evaluation.controller';
import type { PipelineImplementation, PipelineDashboard } from '@smmachine/core';

function makeDashboard(): PipelineDashboard {
  return {
    summary: {
      total_runs: 10,
      first_run: null,
      last_run: null,
      in_progress: 0,
      queued: 0,
      successful_runs: 9,
      failed_runs: 1,
      cancelled_runs: 0,
      skipped_runs: 0,
      timed_out_runs: 0,
      success_rate: 90,
      value: 10,
      method: 'average',
    },
    jobs_by_status: [
      { Status: 'success', Count: 9 },
      { Status: 'failure', Count: 1 },
    ],
    runs_duration: [
      {
        workflow: 'ci.yml',
        value: 10,
        method: 'average',
        min_duration: 5,
        max_duration: 20,
        total_runs: 10,
      },
    ],
    runs_by: [],
    jobs_time: [{ job_name: 'build', value: 8, method: 'average', count: 10 }],
    jobs_time_by_day: [],
    jobs_duration_by_workflow: [{ workflow: 'ci.yml', jobs: { build: 8 } }],
    jobs_summary: [
      {
        workflow_name: 'ci.yml',
        job_name: 'build',
        total_runs: 10,
        value: 8,
        method: 'average',
        success_count: 9,
        failure_count: 1,
        success_rate: 90,
        failure_rate: 10,
        rerun_count: 0,
      },
    ],
    jobs_reruns_by_day: [],
    job_steps_time: [],
    job_steps_time_by_day: [],
  };
}

function createController() {
  const mockDashboard = makeDashboard();
  const mockPipelineImpl = {
    dashboard: vi.fn().mockResolvedValue(mockDashboard),
  } as unknown as PipelineImplementation;

  const controller = new PipelineEvaluationController(mockPipelineImpl);
  return { controller, mockPipelineImpl, mockDashboard };
}

describe('PipelineEvaluationController', () => {
  describe('evaluate', () => {
    it('delegates to pipelineImpl.dashboard with correct filters', async () => {
      const { controller, mockPipelineImpl } = createController();

      await controller.evaluate(
        '2025-01-01',
        '2025-01-31',
        '.github/workflows/ci.yml',
        undefined,
        undefined,
        'main',
        undefined,
        undefined,
        undefined,
        'exclude',
        'include',
        'average'
      );

      expect(mockPipelineImpl.dashboard).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          workflowPath: '.github/workflows/ci.yml',
          targetBranch: 'main',
          cleaning: expect.objectContaining({
            weekends: 'exclude',
            outlierMode: 'include',
          }),
          method: 'average',
        })
      );
    });

    it('returns evaluation with signals and summary', async () => {
      const { controller } = createController();
      const result = await controller.evaluate();

      expect(result).toBeDefined();
      expect(result.generatedAt).toBeDefined();
      expect(Array.isArray(result.signals)).toBe(true);
      expect(result.signals.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.summary.totalRuns).toBe(10);
    });

    it('passes default cleaning options when no params provided', async () => {
      const { controller, mockPipelineImpl } = createController();

      await controller.evaluate();

      expect(mockPipelineImpl.dashboard).toHaveBeenCalledWith(
        expect.objectContaining({
          cleaning: expect.objectContaining({
            weekends: 'include',
            outlierMode: 'include',
          }),
          method: 'average',
        })
      );
    });

    it('passes status and conclusion filters through', async () => {
      const { controller, mockPipelineImpl } = createController();

      await controller.evaluate(
        undefined,
        undefined,
        undefined,
        'completed',
        'success',
        undefined,
        undefined,
        undefined,
        'push'
      );

      expect(mockPipelineImpl.dashboard).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          conclusion: 'success',
          event: 'push',
        })
      );
    });
  });
});
