import { Logger } from '@smmachine/utils';
import {
  JobMetrics,
  PipelineAverageOutlier,
  PipelineAverageOutlierItem,
  PipelineFilters,
  PipelineJob,
  PipelineMetrics,
  PipelineRun,
} from '../pipeline-types';
import { Configuration } from '../../..';
import { TimeZoneProvider } from '../../../infrastructure/timezone-provider';
import {
  averageMetricSamples,
  cleanMetricSamples,
  MetricCleaningOptions,
  MetricSample,
} from '../../metric-samples';
import { PipelinesRepository } from '../repositories/pipeline-repository';

type PipelineDateFields = {
  createdAt?: string;
  completedAt?: string;
  startedAt?: string;
  jobs?: Array<{
    startedAt?: string;
    completedAt?: string;
  }>;
};

type PipelineRunFilterOptions = {
  sort_by?: {
    created_at?: 'asc' | 'desc';
  };
};

export interface IPipelinesService {
  filterRunsByDateRange<T extends PipelineDateFields>(
    runs: T[],
    startDate?: string,
    endDate?: string,
    options?: PipelineRunFilterOptions
  ): T[];
  getRunMetricDate(run: PipelineDateFields): string | undefined;
  getRunDurationMinutes(run: PipelineDateFields): number | null;
  getDurationMinutes(startedAt?: string, completedAt?: string): number | null;
  getPeriodKey(dateString: string | undefined, interval: 'day' | 'week' | 'month'): string;
  getMetrics(filters?: PipelineFilters): Promise<PipelineMetrics>;
  getDeploymentFrequency(
    interval: 'day' | 'week' | 'month',
    filters?: PipelineFilters
  ): Promise<
    Array<{
      period: string;
      count: number;
    }>
  >;
  getDeploymentFrequencyWithAllIntervals(
    filters?: PipelineFilters
  ): Promise<DeploymentFrequencyRow[]>;
  getJobMetrics(filters?: PipelineFilters): Promise<JobMetrics[]>;
  getJobRerunsByDay(
    filters?: PipelineFilters
  ): Promise<Array<{ day: string; rerun_count: number }>>;
  getJobStepsAverageTime(filters?: PipelineFilters): Promise<
    Array<{
      name: string;
      averageDurationMinutes: number;
      count: number;
      outliers?: PipelineAverageOutlier[];
    }>
  >;
  getJobStepsAverageTimeByDay(filters?: PipelineFilters): Promise<
    Array<{
      day: string;
      steps: Array<{
        name: string;
        averageDurationMinutes: number;
        outliers?: PipelineAverageOutlier[];
      }>;
    }>
  >;
}

interface DeploymentFrequencyTarget {
  pipeline: string;
  job: string;
}

export interface DeploymentFrequencyRow {
  pipeline: string;
  job: string;
  days: string;
  weeks: string;
  months: string;
  daily_counts: number;
  weekly_counts: number;
  monthly_counts: number;
  commits: string;
  links: string;
}

export class PipelinesService implements IPipelinesService {
  private tz: TimeZoneProvider;

  constructor(
    private pipelineRepository: PipelinesRepository,
    private configuration: Configuration | undefined,
    private logger: Logger,
    timeZoneProvider: TimeZoneProvider
  ) {
    this.tz = timeZoneProvider;
  }

  filterRunsByDateRange<T extends PipelineDateFields>(
    runs: T[],
    startDate?: string,
    endDate?: string,
    options?: PipelineRunFilterOptions
  ): T[] {
    const start = startDate ? this.toDateBoundaryTimestamp(startDate, 'start') : 0;
    const end = endDate ? this.toDateBoundaryTimestamp(endDate, 'end') : 0;
    const filteredRuns =
      start || end
        ? runs.filter((run) => {
            const runTimestamp = this.toTimestamp(this.getRunMetricDate(run));
            if (start && runTimestamp < start) return false;
            if (end && runTimestamp > end) return false;
            return true;
          })
        : runs;

    if (options?.sort_by?.created_at) {
      return this.sortRunsByMetricDate(filteredRuns, options.sort_by.created_at);
    }

    return filteredRuns;
  }

  getRunMetricDate(run: PipelineDateFields): string | undefined {
    return run.completedAt || run.createdAt;
  }

  getRunDurationMinutes(run: PipelineDateFields): number | null {
    const jobDurations = (run.jobs || [])
      .map((job) => ({
        startedAt: this.toTimestamp(job.startedAt),
        completedAt: this.toTimestamp(job.completedAt),
      }))
      .filter(
        ({ startedAt, completedAt }) => startedAt > 0 && completedAt > 0 && completedAt >= startedAt
      );

    if (jobDurations.length > 0) {
      const startedAt = Math.min(...jobDurations.map((duration) => duration.startedAt));
      const completedAt = Math.max(...jobDurations.map((duration) => duration.completedAt));
      return (completedAt - startedAt) / (1000 * 60);
    }

    // Do not fall back to run-level startedAt/completedAt because completedAt
    // is typically mapped from updated_at (last record update) rather than the
    // actual run completion time, producing wildly incorrect durations.
    return null;
  }

  getDurationMinutes(startedAt?: string, completedAt?: string): number | null {
    const start = this.toTimestamp(startedAt);
    const end = this.toTimestamp(completedAt);
    if (start === 0 || end === 0 || end < start) {
      return null;
    }
    return (end - start) / (1000 * 60);
  }

  getPeriodKey(dateString: string | undefined, interval: 'day' | 'week' | 'month'): string {
    return this.tz.getIntervalKey(dateString, interval);
  }

  /**
   * Get overall pipeline metrics for the given filters.
   */
  async getMetrics(filters?: PipelineFilters): Promise<PipelineMetrics> {
    const runs = await this.filterRuns(filters);

    const completedRuns = runs.filter((r) => r.conclusion);
    const successful = completedRuns.filter((r) => r.conclusion === 'success');
    const failed = completedRuns.filter((r) => r.conclusion === 'failure');

    const successRate =
      completedRuns.length > 0 ? (successful.length / completedRuns.length) * 100 : 0;

    // Calculate average duration
    const cleanedDurations = this.cleanPipelineSamples(
      this.extractDurationSamples(runs),
      filters?.cleaning
    );
    const averageDuration = averageMetricSamples(cleanedDurations.samples);

    this.logger.info(
      `Pipeline Metrics: ${runs.length} total, ${successful.length} successful, ${successRate.toFixed(2)}% success rate`
    );

    return {
      totalRuns: runs.length,
      successfulRuns: successful.length,
      failedRuns: failed.length,
      successRate: Math.round(successRate * 100) / 100,
      averageDurationMinutes: Math.round(averageDuration * 100) / 100,
      outliers: this.shouldExposeOutliers(filters?.cleaning)
        ? cleanedDurations.outliers
        : undefined,
    };
  }

  /**
   * Get deployment frequency with all intervals (daily, weekly, monthly) grouped by day.
   * Returns data in the format expected by the frontend.
   */
  async getDeploymentFrequency(
    interval: 'day' | 'week' | 'month',
    filters?: PipelineFilters
  ): Promise<Array<{ period: string; count: number }>> {
    const frequency = await this.getDeploymentFrequencyWithAllIntervals(filters);
    const groupedByTarget = new Map<string, number>();

    for (const item of frequency) {
      let period = item.months;
      let count = item.monthly_counts;

      if (interval === 'day') {
        period = item.days;
        count = item.daily_counts;
      } else if (interval === 'week') {
        period = item.weeks;
        count = item.weekly_counts;
      }

      const targetKey = `${item.pipeline}||${item.job}||${period}`;
      groupedByTarget.set(targetKey, Math.max(groupedByTarget.get(targetKey) || 0, count));
    }

    const grouped = new Map<string, number>();
    for (const [key, count] of groupedByTarget.entries()) {
      const period = key.split('||')[2];
      grouped.set(period, (grouped.get(period) || 0) + count);
    }

    return Array.from(grouped.entries()).map(([period, count]) => ({ period, count }));
  }

  async getDeploymentFrequencyWithAllIntervals(
    filters?: PipelineFilters
  ): Promise<DeploymentFrequencyRow[]> {
    const targets = this.getDeploymentFrequencyTargets();

    if (targets.length === 0) {
      this.logger.warn(
        'Deployment frequency requested without deployment_frequency_targets configured'
      );
      return [];
    }

    const targetCounts = new Map<
      string,
      {
        target: DeploymentFrequencyTarget;
        dailyCounts: Map<string, number>;
        weeklyCounts: Map<string, number>;
        monthlyCounts: Map<string, number>;
      }
    >();
    const allDays = new Set<string>();
    let deploymentJobCount = 0;

    for (const target of targets) {
      const targetKey = `${target.pipeline}||${target.job}`;
      const counts = {
        target,
        dailyCounts: new Map<string, number>(),
        weeklyCounts: new Map<string, number>(),
        monthlyCounts: new Map<string, number>(),
      };

      const deployments = await this.filterRuns({
        ...filters,
        workflowPath: target.pipeline,
        jobName: target.job,
        jobConclusion: 'success',
        conclusion: 'success',
        status: 'completed',
      });

      const jobsOnly = deployments.flatMap((run) => run.jobs || []);
      deploymentJobCount += jobsOnly.length;

      for (const job of jobsOnly) {
        const timestamp = job.completedAt || job.startedAt;
        if (!timestamp) {
          continue;
        }

        const date = new Date(timestamp);
        const day = this.getIntervalKey(date, 'day');
        const week = this.getIntervalKey(date, 'week');
        const month = this.getIntervalKey(date, 'month');

        counts.dailyCounts.set(day, (counts.dailyCounts.get(day) || 0) + 1);
        counts.weeklyCounts.set(week, (counts.weeklyCounts.get(week) || 0) + 1);
        counts.monthlyCounts.set(month, (counts.monthlyCounts.get(month) || 0) + 1);
        allDays.add(day);
      }

      targetCounts.set(targetKey, counts);
    }

    this.logger.info(`Jobs only for deployment frequency calculation: ${deploymentJobCount}`);

    if (allDays.size === 0) {
      return [];
    }

    // Determine the start and end dates from the deployments
    const sortedDays = Array.from(allDays.keys()).sort();
    const firstDayStr = sortedDays[0];
    const lastDayStr = sortedDays[sortedDays.length - 1];

    const result: DeploymentFrequencyRow[] = [];
    const [startYear, startMonth, startDay] = firstDayStr.split('-').map(Number);
    const [endYear, endMonth, endDay] = lastDayStr.split('-').map(Number);

    // Use midday to avoid daylight saving time boundary issues when incrementing.
    const firstDate = new Date(Date.UTC(startYear, startMonth - 1, startDay, 12, 0, 0));
    const endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay, 12, 0, 0));

    for (const counts of targetCounts.values()) {
      const currentDate = new Date(firstDate);

      while (currentDate <= endDate) {
        const currentDayStr = this.getIntervalKey(currentDate, 'day');
        const currentWeekStr = this.getIntervalKey(currentDate, 'week');
        const currentMonthStr = this.getIntervalKey(currentDate, 'month');

        result.push({
          pipeline: counts.target.pipeline,
          job: counts.target.job,
          days: currentDayStr,
          weeks: currentWeekStr,
          months: currentMonthStr,
          daily_counts: counts.dailyCounts.get(currentDayStr) || 0,
          weekly_counts: counts.weeklyCounts.get(currentWeekStr) || 0,
          monthly_counts: counts.monthlyCounts.get(currentMonthStr) || 0,
          commits: '',
          links: '',
        });

        // Move to the next day
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }
    }

    return result;
  }

  /**
   * Get metrics aggregated by job name.
   */
  async getJobMetrics(filters?: PipelineFilters): Promise<JobMetrics[]> {
    const runs = await this.filterRuns(filters);

    const jobMetricsMap = new Map<string, JobMetrics>();

    for (const run of runs) {
      const jobs = run.jobs || [];
      const workflowName = run.path;

      for (const job of jobs) {
        const jobName = job.name;
        const key = `${workflowName || 'unknown'}::${jobName}`;
        if (!jobMetricsMap.has(key)) {
          jobMetricsMap.set(key, {
            jobName,
            workflowName,
            totalRuns: 0,
            averageDurationMinutes: 0,
            successCount: 0,
            failureCount: 0,
            successRate: 0,
            failureRate: 0,
            rerunCount: 0,
            actionRequiredCount: 0,
            cancelledCount: 0,
            skippedCount: 0,
            timedOutCount: 0,
            unknownCount: 0,
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

    // Calculate average durations and success rates
    const result: JobMetrics[] = [];

    for (const metrics of jobMetricsMap.values()) {
      // Extract durations for this job
      const durationSamples: Array<MetricSample<PipelineAverageOutlierItem>> = [];
      for (const run of runs) {
        if (run.path !== metrics.workflowName) {
          continue;
        }

        const job = (run.jobs || []).find((j) => j.name === metrics.jobName);
        if (job && job.startedAt && job.completedAt) {
          durationSamples.push(this.toJobSample(run, job, this.calculateJobDuration(job)));
        }
      }
      const cleanedDurations = this.cleanPipelineSamples(durationSamples, filters?.cleaning);

      metrics.averageDurationMinutes =
        cleanedDurations.samples.length > 0
          ? Math.round(averageMetricSamples(cleanedDurations.samples) * 100) / 100
          : 0;
      metrics.outliers = this.shouldExposeOutliers(filters?.cleaning)
        ? cleanedDurations.outliers
        : undefined;

      metrics.successRate = Math.round((metrics.successCount / metrics.totalRuns) * 10000) / 100;
      metrics.failureRate = Math.round((metrics.failureCount / metrics.totalRuns) * 10000) / 100;

      result.push(metrics);
    }

    return result.sort((a, b) => b.totalRuns - a.totalRuns);
  }

  /**
   * Get rerun counts grouped by day.
   */
  async getJobRerunsByDay(
    filters?: PipelineFilters
  ): Promise<Array<{ day: string; rerun_count: number }>> {
    const runs = await this.filterRuns(filters);

    const grouped = new Map<string, number>();

    for (const run of runs) {
      const runDate = run.completedAt || run.createdAt;
      if (!runDate) {
        continue;
      }

      const day = this.toDayKey(runDate);
      const runAttempt = run.runAttempt || 1;
      const reruns = Math.max(runAttempt - 1, 0);

      grouped.set(day, (grouped.get(day) || 0) + reruns);
    }

    return Array.from(grouped.entries())
      .map(([day, rerun_count]) => ({ day, rerun_count }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }

  /**
   * Get average duration of steps for a job.
   */
  async getJobStepsAverageTime(filters?: PipelineFilters): Promise<
    Array<{
      name: string;
      averageDurationMinutes: number;
      count: number;
      outliers?: PipelineAverageOutlier[];
    }>
  > {
    const runs = await this.filterRuns(filters);

    // Group durations by step name
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
          stepDurations
            .get(step.name)!
            .push(this.toStepSample(run, job, step.name, durationMinutes));
        }
      }
    }

    const result: Array<{
      name: string;
      averageDurationMinutes: number;
      count: number;
      outliers?: PipelineAverageOutlier[];
    }> = [];

    for (const [name, samples] of stepDurations.entries()) {
      const cleaned = this.cleanPipelineSamples(samples, filters?.cleaning);
      const avg = averageMetricSamples(cleaned.samples);
      result.push({
        name,
        averageDurationMinutes: Math.round(avg * 100) / 100,
        count: cleaned.samples.length,
        outliers: this.shouldExposeOutliers(filters?.cleaning) ? cleaned.outliers : undefined,
      });
    }

    return result;
  }

  /**
   * Get average duration of steps for a job, grouped by day.
   */
  async getJobStepsAverageTimeByDay(filters?: PipelineFilters): Promise<
    Array<{
      day: string;
      steps: Array<{
        name: string;
        averageDurationMinutes: number;
        outliers?: PipelineAverageOutlier[];
      }>;
    }>
  > {
    const runs = await this.filterRuns(filters);

    // day -> stepName -> durations
    const dayStepDurations = new Map<
      string,
      Map<string, Array<MetricSample<PipelineAverageOutlierItem>>>
    >();

    for (const run of runs) {
      const runDate = run.completedAt || run.createdAt;
      if (!runDate) continue;
      const day = this.toDayKey(runDate);

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
          stepMap.get(step.name)!.push(this.toStepSample(run, job, step.name, durationMinutes));
        }
      }
    }

    const result: Array<{
      day: string;
      steps: Array<{
        name: string;
        averageDurationMinutes: number;
        outliers?: PipelineAverageOutlier[];
      }>;
    }> = [];

    for (const [day, stepMap] of dayStepDurations.entries()) {
      const steps = [];
      for (const [name, samples] of stepMap.entries()) {
        const cleaned = this.cleanPipelineSamples(samples, filters?.cleaning);
        const avg = averageMetricSamples(cleaned.samples);
        steps.push({
          name,
          averageDurationMinutes: Math.round(avg * 100) / 100,
          outliers: this.shouldExposeOutliers(filters?.cleaning) ? cleaned.outliers : undefined,
        });
      }
      result.push({ day, steps });
    }

    return result.sort((a, b) => a.day.localeCompare(b.day));
  }

  async loadUniqueWorkflows(): Promise<{ name: string; path: string }[]> {
    const runs = await this.filterRuns();
    const values = Array.from(
      new Set(
        runs.map((run: PipelineRun) => run.path || '').filter((value: string) => value.length > 0)
      )
    ).sort();
    return values.map((workflow) => ({ name: workflow, path: workflow }));
  }

  private toDayKey(dateString: string): string {
    return this.tz.getDateKey(dateString);
  }

  private getDeploymentFrequencyTargets(): DeploymentFrequencyTarget[] {
    if (!this.configuration) {
      return [];
    }

    return this.configuration.getDeploymentFrequencyTargets();
  }

  /**
   * Filter runs by the provided criteria.
   */
  private async filterRuns(filters?: PipelineFilters): Promise<PipelineRun[]> {
    if (!filters) {
      return this.loadCachedWorkflowsWithJobs();
    }

    const runs = await this.pipelineRepository.loadPipelines({
      includeJobs: true,
      startDate: filters.startDate,
      endDate: filters.endDate,
      weekends: filters.cleaning?.weekends,
      targetBranch: filters.targetBranch,
      event: filters.event,
      workflowPath: filters.workflowPath,
      status: filters.status,
      conclusion: filters.conclusion,
      jobName: filters.jobName,
      jobConclusion: filters.jobConclusion,
      rawFilters: filters.rawFilters,
    });

    return runs;
  }

  private toTimestamp(value?: string): number {
    if (!value) {
      return 0;
    }
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toDateBoundaryTimestamp(value: string, boundary: 'start' | 'end'): number {
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (isDateOnly) {
      const dayBoundary =
        boundary === 'end'
          ? this.tz.getEndOfDayBoundary(value)
          : this.tz.getStartOfDayBoundary(value);
      return dayBoundary.getTime();
    }

    const isoWeekMatch = value.match(/^(\d{4})-W(\d{2})$/);
    if (isoWeekMatch) {
      const year = Number(isoWeekMatch[1]);
      const week = Number(isoWeekMatch[2]);
      const weekBoundary = this.getIsoWeekBoundaryDate(year, week, boundary);
      if (weekBoundary) {
        return weekBoundary.getTime();
      }
    }

    return this.toTimestamp(value);
  }

  private getIsoWeekBoundaryDate(
    year: number,
    week: number,
    boundary: 'start' | 'end'
  ): Date | undefined {
    const weekStart = this.getIsoWeekStartDate(year, week);
    if (!weekStart) {
      return undefined;
    }

    const boundaryDate = new Date(weekStart);
    if (boundary === 'end') {
      boundaryDate.setUTCDate(boundaryDate.getUTCDate() + 6);
      return this.tz.getEndOfDayBoundary(boundaryDate.toISOString().slice(0, 10));
    }

    return this.tz.getStartOfDayBoundary(boundaryDate.toISOString().slice(0, 10));
  }

  private getIsoWeekStartDate(year: number, week: number): Date | undefined {
    if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1 || week > 53) {
      return undefined;
    }

    const january4th = new Date(Date.UTC(year, 0, 4, 12, 0, 0));
    const january4thDayOfWeek = january4th.getUTCDay() || 7;
    const week1Monday = new Date(january4th);
    week1Monday.setUTCDate(january4th.getUTCDate() - (january4thDayOfWeek - 1));

    const targetMonday = new Date(week1Monday);
    targetMonday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);

    return targetMonday;
  }

  private sortRunsByMetricDate<T extends PipelineDateFields>(
    runs: T[],
    direction: 'asc' | 'desc'
  ): T[] {
    const sortDirection = direction === 'asc' ? 1 : -1;
    return [...runs].sort(
      (a, b) =>
        (this.toTimestamp(this.getRunMetricDate(a)) - this.toTimestamp(this.getRunMetricDate(b))) *
        sortDirection
    );
  }

  private extractDurationSamples(
    runs: PipelineRun[]
  ): Array<MetricSample<PipelineAverageOutlierItem>> {
    const samples: Array<MetricSample<PipelineAverageOutlierItem>> = [];

    for (const run of runs) {
      const duration = this.getRunDurationMinutes(run);
      if (duration !== null) {
        samples.push(this.toRunSample(run, duration));
      }
    }

    return samples;
  }

  private calculateJobDuration(job: PipelineJob): number {
    const started = new Date(job.startedAt).getTime();
    const completed = new Date(job.completedAt!).getTime();
    return (completed - started) / (1000 * 60); // Convert to minutes
  }

  private toRunSample(run: PipelineRun, value: number): MetricSample<PipelineAverageOutlierItem> {
    return {
      value,
      timestamp: this.getRunMetricDate(run) || run.createdAt,
      item: {
        runId: String(run.id),
        workflowName: run.path,
      },
    };
  }

  private toJobSample(
    run: PipelineRun,
    job: PipelineJob,
    value: number
  ): MetricSample<PipelineAverageOutlierItem> {
    return {
      value,
      timestamp: job.completedAt || job.startedAt || this.getRunMetricDate(run) || run.createdAt,
      item: {
        runId: String(run.id),
        workflowName: run.path,
        jobName: job.name,
      },
    };
  }

  private toStepSample(
    run: PipelineRun,
    job: PipelineJob,
    stepName: string,
    value: number
  ): MetricSample<PipelineAverageOutlierItem> {
    return {
      value,
      timestamp: job.completedAt || job.startedAt || this.getRunMetricDate(run) || run.createdAt,
      item: {
        runId: String(run.id),
        workflowName: run.path,
        jobName: job.name,
        stepName,
      },
    };
  }

  private cleanPipelineSamples(
    samples: Array<MetricSample<PipelineAverageOutlierItem>>,
    options?: MetricCleaningOptions
  ) {
    return cleanMetricSamples(samples, options);
  }

  private shouldExposeOutliers(options?: MetricCleaningOptions): boolean {
    return options?.outlierMode === 'flag' || options?.outlierMode === 'exclude';
  }

  private getIntervalKey(date: Date, interval: 'day' | 'week' | 'month'): string {
    if (interval === 'day') {
      return this.tz.getDateKey(date);
    } else if (interval === 'week') {
      return this.tz.getWeekKey(date);
    } else {
      return this.tz.getMonthKey(date);
    }
  }

  private async loadCachedWorkflowsWithJobs(): Promise<PipelineRun[]> {
    return this.pipelineRepository.loadPipelines();
  }
}
