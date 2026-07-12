import { Logger } from '@smmachine/utils';
import { PipelinesRepository } from '../repositories';
import { DeploymentFrequencyTarget } from '../service';
import { PipelinesDataService } from './pipelines-data-service';
import { TimeZoneProvider } from '../../../infrastructure';
import {
  parseMetricCleaningOptions,
  cleanMetricSamples,
  averageMetricSamples,
  MetricCleaningOptions,
  MetricSample,
} from '../../metric-samples';
import type {
  PipelineRun,
  PipelineAverageOutlierItem,
  PipelineAverageOutlier,
  PipelineFilters,
  PipelineDashboard,
} from '../pipeline-types';

export class PipelineImplementation {
  private pipelinesDataService!: PipelinesDataService;

  constructor(
    private readonly pipelinesRepo: PipelinesRepository,
    private readonly deploymentTargets: DeploymentFrequencyTarget[],
    private readonly logger: Logger,
    private readonly timeZoneProvider: TimeZoneProvider
  ) {}

  async dashboard(filters: PipelineFilters): Promise<PipelineDashboard> {
    const runs = await this.loadRunsWithFilters(filters, true);
    this.pipelinesDataService = new PipelinesDataService(
      runs,
      this.deploymentTargets,
      this.logger,
      this.timeZoneProvider
    );

    const cleaning = filters.cleaning || parseMetricCleaningOptions({});

    return {
      summary: this.computeSummary(runs, cleaning),
      jobs_by_status: this.computeJobsByStatus(runs),
      runs_duration: this.computeRunsDuration(runs, cleaning),
      runs_by: this.computeRunsByDay(runs),
      jobs_average_time: this.computeJobsAverageTime(runs, cleaning),
      jobs_average_time_by_day: this.computeJobsAverageTimeByDay(runs, cleaning),
      jobs_duration_by_workflow: this.computeJobsDurationByWorkflow(runs),
      jobs_summary: this.computeJobsSummary(runs, cleaning),
      jobs_reruns_by_day: this.computeJobsRerunsByDay(runs),
      job_steps_average_time: this.computeJobStepsAverageTime(runs, cleaning),
      job_steps_average_time_by_day: this.computeJobStepsAverageTimeByDay(runs, cleaning),
    };
  }

  private pickRunSummaryFields(run: PipelineRun): {
    path?: string;
    createdAt?: string;
    completedAt?: string;
    startedAt?: string;
    status?: string;
    conclusion?: string;
    branch?: string;
    event?: string;
  } {
    return {
      path: run.path,
      createdAt: run.createdAt,
      completedAt: run.completedAt,
      startedAt: run.startedAt,
      status: run.status,
      conclusion: run.conclusion,
      branch: run.branch,
      event: run.event,
    };
  }

  private computeSummary(
    runs: PipelineRun[],
    cleaning: MetricCleaningOptions
  ): PipelineDashboard['summary'] {
    const successful = runs.filter((run) => run.conclusion === 'success').length;
    const failed = runs.filter((run) => run.conclusion === 'failure').length;
    const cancelled = runs.filter((run) => run.conclusion === 'cancelled').length;
    const skipped = runs.filter((run) => run.conclusion === 'skipped').length;
    const timedOut = runs.filter((run) => run.conclusion === 'timed_out').length;
    const completed = runs.filter((run) => run.conclusion).length;
    const successRate = completed > 0 ? (successful / completed) * 100 : 0;

    const durationSamples: Array<MetricSample<PipelineAverageOutlierItem>> = [];
    for (const run of runs) {
      const duration = this.pipelinesDataService.getRunDurationMinutes(run);
      if (duration !== null) {
        durationSamples.push({
          value: duration,
          timestamp: this.pipelinesDataService.getRunMetricDate(run) || run.createdAt,
          item: { runId: String(run.id), workflowName: run.path },
        });
      }
    }
    const cleaned = cleanMetricSamples(durationSamples, cleaning);
    const avgDuration = averageMetricSamples(cleaned.samples);

    return {
      total_runs: runs.length,
      first_run: runs.length > 0 ? this.pickRunSummaryFields(runs[0]) : null,
      last_run: runs.length > 0 ? this.pickRunSummaryFields(runs[runs.length - 1]) : null,
      in_progress: runs.filter((run) => run.status.toLowerCase() === 'in_progress').length,
      queued: runs.filter((run) => run.status.toLowerCase() === 'queued').length,
      successful_runs: successful,
      failed_runs: failed,
      cancelled_runs: cancelled,
      skipped_runs: skipped,
      timed_out_runs: timedOut,
      success_rate: Math.round(successRate * 100) / 100,
      average_duration_minutes: Math.round(avgDuration * 100) / 100,
    };
  }

  private computeJobsByStatus(runs: PipelineRun[]): PipelineDashboard['jobs_by_status'] {
    const grouped = new Map<string, number>();

    for (const run of runs) {
      const jobs = run.jobs || [];
      for (const job of jobs) {
        const key = job.conclusion || job.status || 'unknown';
        grouped.set(key, (grouped.get(key) || 0) + 1);
      }
    }

    return Array.from(grouped.entries())
      .map(([state, count]) => ({ Status: state, Count: count }))
      .sort((a, b) => b.Count - a.Count);
  }

  private computeRunsDuration(
    runs: PipelineRun[],
    cleaning: MetricCleaningOptions
  ): PipelineDashboard['runs_duration'] {
    const grouped = new Map<string, Array<MetricSample<PipelineAverageOutlierItem>>>();

    for (const run of runs) {
      const duration = this.pipelinesDataService.getRunDurationMinutes(run);
      if (duration === null) continue;
      const workflow = run.path || 'unknown';
      const existing = grouped.get(workflow) || [];
      existing.push({
        value: duration,
        timestamp: this.pipelinesDataService.getRunMetricDate(run) || run.createdAt,
        item: { runId: String(run.id), workflowName: workflow },
      });
      grouped.set(workflow, existing);
    }

    return Array.from(grouped.entries())
      .map(([workflow, samples]) => {
        const cleaned = cleanMetricSamples(samples, cleaning);
        const durations = cleaned.samples.map((sample) => sample.value);
        const n = cleaned.samples.length;
        const avgDuration = averageMetricSamples(cleaned.samples);
        const minDuration = n > 0 ? Math.min(...durations) : 0;
        const maxDuration = n > 0 ? Math.max(...durations) : 0;
        const outliers =
          cleaning.outlierMode === 'flag' || cleaning.outlierMode === 'exclude'
            ? (cleaned.outliers as PipelineAverageOutlier[])
            : undefined;

        return {
          workflow,
          avg_duration: avgDuration,
          min_duration: minDuration,
          max_duration: maxDuration,
          total_runs: n,
          outliers,
        };
      })
      .sort((a, b) => b.total_runs - a.total_runs);
  }

  private computeRunsByDay(runs: PipelineRun[]): PipelineDashboard['runs_by'] {
    const grouped = new Map<string, number>();

    for (const run of runs) {
      const keyDate = this.pipelinesDataService.getRunMetricDate(run);
      if (!keyDate) continue;
      const period = this.pipelinesDataService.getPeriodKey(keyDate, 'day');
      const workflow = run.path || 'unknown';
      const key = `${period}||${workflow}`;
      grouped.set(key, (grouped.get(key) || 0) + 1);
    }

    return Array.from(grouped.entries())
      .map(([key, count]) => {
        const [period, workflow] = key.split('||');
        return { period, workflow, runs: count };
      })
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  private computeJobsAverageTime(
    runs: PipelineRun[],
    cleaning: MetricCleaningOptions
  ): PipelineDashboard['jobs_average_time'] {
    const grouped = new Map<
      string,
      { workflowName?: string; samples: Array<MetricSample<PipelineAverageOutlierItem>> }
    >();

    for (const run of runs) {
      const jobs = run.jobs || [];
      for (const job of jobs) {
        const name = job.name.trim();
        if (!name) continue;
        const duration = this.pipelinesDataService.getDurationMinutes(
          job.startedAt,
          job.completedAt
        );
        if (duration === null) continue;

        const existing = grouped.get(name) || { workflowName: run.path, samples: [] };
        existing.samples.push({
          value: duration,
          timestamp:
            job.completedAt ||
            job.startedAt ||
            this.pipelinesDataService.getRunMetricDate(run) ||
            '',
          item: {
            runId: String(run.id),
            workflowName: run.path,
            jobName: name,
          },
        });
        grouped.set(name, existing);
      }
    }

    return Array.from(grouped.entries())
      .map(([jobNameValue, data]) => {
        const cleaned = cleanMetricSamples(data.samples, cleaning);
        return {
          job_name: jobNameValue,
          workflow_name: data.workflowName,
          avg_time: averageMetricSamples(cleaned.samples),
          count: cleaned.samples.length,
          outliers:
            cleaning.outlierMode === 'flag' || cleaning.outlierMode === 'exclude'
              ? (cleaned.outliers as PipelineAverageOutlier[])
              : undefined,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  private computeJobsAverageTimeByDay(
    runs: PipelineRun[],
    cleaning: MetricCleaningOptions
  ): PipelineDashboard['jobs_average_time_by_day'] {
    const grouped = new Map<string, Array<MetricSample<PipelineAverageOutlierItem>>>();

    for (const run of runs) {
      const jobs = run.jobs || [];
      const runDate = this.pipelinesDataService.getRunMetricDate(run);
      if (!runDate) continue;
      const day = this.pipelinesDataService.getPeriodKey(runDate, 'day');

      for (const job of jobs) {
        const name = job.name.trim();
        if (!name) continue;
        const duration = this.pipelinesDataService.getDurationMinutes(
          job.startedAt,
          job.completedAt
        );
        if (duration === null) continue;

        if (!grouped.has(day)) {
          grouped.set(day, []);
        }
        grouped.get(day)!.push({
          value: duration,
          timestamp: job.completedAt || job.startedAt || runDate,
          item: {
            runId: String(run.id),
            workflowName: run.path,
            jobName: name,
          },
        });
      }
    }

    return Array.from(grouped.entries())
      .map(([day, samples]) => {
        const cleaned = cleanMetricSamples(samples, cleaning);
        return {
          day,
          avg_time: averageMetricSamples(cleaned.samples),
          count: cleaned.samples.length,
          outliers:
            cleaning.outlierMode === 'flag' || cleaning.outlierMode === 'exclude'
              ? (cleaned.outliers as PipelineAverageOutlier[])
              : undefined,
        };
      })
      .sort((a, b) => a.day.localeCompare(b.day));
  }

  private computeJobsDurationByWorkflow(
    runs: PipelineRun[]
  ): PipelineDashboard['jobs_duration_by_workflow'] {
    const grouped = new Map<string, Map<string, number[]>>();

    for (const run of runs) {
      const workflow = run.path || 'unknown';
      const jobs = run.jobs || [];
      for (const job of jobs) {
        const name = job.name.trim();
        if (!name) continue;
        const duration = this.pipelinesDataService.getDurationMinutes(
          job.startedAt,
          job.completedAt
        );
        if (duration === null) continue;
        if (!grouped.has(workflow)) grouped.set(workflow, new Map());
        const jobMap = grouped.get(workflow)!;
        const existing = jobMap.get(name) || [];
        existing.push(duration);
        jobMap.set(name, existing);
      }
    }

    return Array.from(grouped.entries())
      .map(([workflow, jobMap]) => {
        const jobs: Record<string, number> = {};
        for (const [name, durations] of jobMap.entries()) {
          jobs[name] = durations.reduce((a, b) => a + b, 0) / durations.length;
        }
        return { workflow, jobs };
      })
      .sort((a, b) => a.workflow.localeCompare(b.workflow));
  }

  private computeJobsSummary(
    runs: PipelineRun[],
    cleaning: MetricCleaningOptions
  ): PipelineDashboard['jobs_summary'] {
    const jobMetricsMap = new Map<
      string,
      {
        workflowName?: string;
        jobName: string;
        totalRuns: number;
        successCount: number;
        failureCount: number;
        cancelledCount: number;
        timedOutCount: number;
        actionRequiredCount: number;
        skippedCount: number;
        unknownCount: number;
        rerunCount: number;
      }
    >();

    for (const run of runs) {
      const workflowName = run.path;
      for (const job of run.jobs || []) {
        const jobName = job.name;
        const key = `${workflowName || 'unknown'}::${jobName}`;
        if (!jobMetricsMap.has(key)) {
          jobMetricsMap.set(key, {
            workflowName,
            jobName,
            totalRuns: 0,
            successCount: 0,
            failureCount: 0,
            cancelledCount: 0,
            timedOutCount: 0,
            actionRequiredCount: 0,
            skippedCount: 0,
            unknownCount: 0,
            rerunCount: 0,
          });
        }

        const metrics = jobMetricsMap.get(key)!;
        metrics.totalRuns += 1;
        metrics.rerunCount += Math.max((run.runAttempt || 1) - 1, 0);

        if (job.conclusion === 'success') {
          metrics.successCount += 1;
        } else if (job.conclusion === 'failure') {
          metrics.failureCount += 1;
        } else if (job.conclusion === 'cancelled') {
          metrics.cancelledCount += 1;
        } else if (job.conclusion === 'timed_out') {
          metrics.timedOutCount += 1;
        } else if (job.conclusion === 'action_required') {
          metrics.actionRequiredCount += 1;
        } else if (job.conclusion === 'skipped') {
          metrics.skippedCount += 1;
        } else {
          metrics.unknownCount += 1;
        }
      }
    }

    const result: PipelineDashboard['jobs_summary'] = [];

    for (const metrics of jobMetricsMap.values()) {
      const durationSamples: Array<MetricSample<PipelineAverageOutlierItem>> = [];
      for (const run of runs) {
        if (run.path !== metrics.workflowName) continue;
        const job = (run.jobs || []).find((j) => j.name === metrics.jobName);
        if (job && job.startedAt && job.completedAt) {
          const started = new Date(job.startedAt).getTime();
          const completed = new Date(job.completedAt).getTime();
          const durationMinutes = (completed - started) / (1000 * 60);
          durationSamples.push({
            value: durationMinutes,
            timestamp:
              job.completedAt ||
              job.startedAt ||
              this.pipelinesDataService.getRunMetricDate(run) ||
              '',
            item: {
              runId: String(run.id),
              workflowName: run.path,
              jobName: job.name,
            },
          });
        }
      }
      const cleaned = cleanMetricSamples(durationSamples, cleaning);
      const avgDuration =
        cleaned.samples.length > 0
          ? Math.round(averageMetricSamples(cleaned.samples) * 100) / 100
          : 0;
      const successRate =
        metrics.totalRuns > 0
          ? Math.round((metrics.successCount / metrics.totalRuns) * 10000) / 100
          : 0;
      const failureRate =
        metrics.totalRuns > 0
          ? Math.round((metrics.failureCount / metrics.totalRuns) * 10000) / 100
          : 0;

      const outliers =
        cleaning.outlierMode === 'flag' || cleaning.outlierMode === 'exclude'
          ? (cleaned.outliers as PipelineAverageOutlier[])
          : undefined;

      result.push({
        workflow_name: metrics.workflowName,
        job_name: metrics.jobName,
        total_runs: metrics.totalRuns,
        avg_duration_minutes: avgDuration,
        success_count: metrics.successCount,
        failure_count: metrics.failureCount,
        success_rate: successRate,
        failure_rate: failureRate,
        rerun_count: metrics.rerunCount,
        outliers,
      });
    }

    return result.sort((a, b) => b.total_runs - a.total_runs);
  }

  private computeJobsRerunsByDay(runs: PipelineRun[]): PipelineDashboard['jobs_reruns_by_day'] {
    const grouped = new Map<string, number>();

    for (const run of runs) {
      const runDate = run.completedAt || run.createdAt;
      if (!runDate) continue;
      const day = this.pipelinesDataService.getPeriodKey(runDate, 'day');
      const runAttempt = run.runAttempt || 1;
      const reruns = Math.max(runAttempt - 1, 0);
      grouped.set(day, (grouped.get(day) || 0) + reruns);
    }

    return Array.from(grouped.entries())
      .map(([day, rerun_count]) => ({ day, rerun_count }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }

  private computeJobStepsAverageTime(
    runs: PipelineRun[],
    cleaning: MetricCleaningOptions
  ): PipelineDashboard['job_steps_average_time'] {
    const stepDurations = new Map<string, Array<MetricSample<PipelineAverageOutlierItem>>>();

    for (const run of runs) {
      for (const job of run.jobs || []) {
        for (const step of job.steps || []) {
          if (!step.name || !step.startedAt || !step.completedAt) continue;

          const started = new Date(step.startedAt).getTime();
          const completed = new Date(step.completedAt).getTime();
          const durationMinutes = (completed - started) / (1000 * 60);

          if (!stepDurations.has(step.name)) {
            stepDurations.set(step.name, []);
          }
          stepDurations.get(step.name)!.push({
            value: durationMinutes,
            timestamp:
              job.completedAt ||
              job.startedAt ||
              this.pipelinesDataService.getRunMetricDate(run) ||
              '',
            item: {
              runId: String(run.id),
              workflowName: run.path,
              jobName: job.name,
              stepName: step.name,
            },
          });
        }
      }
    }

    const result: PipelineDashboard['job_steps_average_time'] = [];

    for (const [name, samples] of stepDurations.entries()) {
      const cleaned = cleanMetricSamples(samples, cleaning);
      const avg = averageMetricSamples(cleaned.samples);
      result.push({
        name,
        averageDurationMinutes: Math.round(avg * 100) / 100,
        count: cleaned.samples.length,
        outliers:
          cleaning.outlierMode === 'flag' || cleaning.outlierMode === 'exclude'
            ? (cleaned.outliers as PipelineAverageOutlier[])
            : undefined,
      });
    }

    return result;
  }

  private computeJobStepsAverageTimeByDay(
    runs: PipelineRun[],
    cleaning: MetricCleaningOptions
  ): PipelineDashboard['job_steps_average_time_by_day'] {
    const dayStepDurations = new Map<
      string,
      Map<string, Array<MetricSample<PipelineAverageOutlierItem>>>
    >();

    for (const run of runs) {
      const runDate = run.completedAt || run.createdAt;
      if (!runDate) continue;
      const day = this.pipelinesDataService.getPeriodKey(runDate, 'day');

      for (const job of run.jobs || []) {
        for (const step of job.steps || []) {
          if (!step.name || !step.startedAt || !step.completedAt) continue;

          const started = new Date(step.startedAt).getTime();
          const completed = new Date(step.completedAt).getTime();
          const durationMinutes = (completed - started) / (1000 * 60);

          if (!dayStepDurations.has(day)) {
            dayStepDurations.set(day, new Map());
          }
          const stepMap = dayStepDurations.get(day)!;
          if (!stepMap.has(step.name)) {
            stepMap.set(step.name, []);
          }
          stepMap.get(step.name)!.push({
            value: durationMinutes,
            timestamp:
              job.completedAt ||
              job.startedAt ||
              this.pipelinesDataService.getRunMetricDate(run) ||
              '',
            item: {
              runId: String(run.id),
              workflowName: run.path,
              jobName: job.name,
              stepName: step.name,
            },
          });
        }
      }
    }

    const result: PipelineDashboard['job_steps_average_time_by_day'] = [];

    for (const [day, stepMap] of dayStepDurations.entries()) {
      const steps = [];
      for (const [name, samples] of stepMap.entries()) {
        const cleaned = cleanMetricSamples(samples, cleaning);
        const avg = averageMetricSamples(cleaned.samples);
        steps.push({
          name,
          averageDurationMinutes: Math.round(avg * 100) / 100,
          outliers:
            cleaning.outlierMode === 'flag' || cleaning.outlierMode === 'exclude'
              ? (cleaned.outliers as PipelineAverageOutlier[])
              : undefined,
        });
      }
      result.push({ day, steps });
    }

    return result.sort((a, b) => a.day.localeCompare(b.day));
  }

  private async loadRunsWithFilters(
    filters: PipelineFilters,
    includeJobs: boolean
  ): Promise<PipelineRun[]> {
    return this.pipelinesRepo.loadPipelines({
      includeJobs,
      startDate: filters.startDate,
      endDate: filters.endDate,
      weekends: filters.cleaning?.weekends,
      workflowPath: filters.workflowPath,
      status: filters.status,
      conclusion: filters.conclusion,
      targetBranch: filters.targetBranch,
      event: filters.event,
      jobName: filters.jobName,
      jobConclusion: filters.jobConclusion,
    });
  }
}
