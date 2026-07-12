import {
  JobMetrics,
  PipelineAverageOutlier,
  PipelineFilters,
  PipelineMetrics,
} from './pipeline-types';

export type PipelineDateFields = {
  createdAt?: string;
  completedAt?: string;
  startedAt?: string;
  jobs?: Array<{
    startedAt?: string;
    completedAt?: string;
  }>;
};

export interface DeploymentFrequencyTarget {
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

export interface IPipelinesService {
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
