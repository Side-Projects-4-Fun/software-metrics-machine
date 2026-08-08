import type { JobMetrics, PipelineAverageOutlier, PipelineMetrics } from './pipeline-types';
import type { MetricMethod } from '../metric-samples';
import { type PipelineFilters } from './pipeline-types';

export type PipelineDateFields = {
  createdAt?: string;
  completedAt?: string;
  startedAt?: string;
  jobs?: Array<{
    name?: string;
    status?: string;
    conclusion?: string;
    startedAt?: string;
    completedAt?: string;
    workflow_name?: string;
    steps?: Array<{
      name?: string;
      status?: string;
      conclusion?: string;
      startedAt?: string;
      completedAt?: string;
    }>;
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
  getMetrics(filters?: PipelineFilters, method?: MetricMethod): Promise<PipelineMetrics>;
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
  getJobMetrics(filters?: PipelineFilters, method?: MetricMethod): Promise<JobMetrics[]>;
  getJobRerunsByDay(
    filters?: PipelineFilters
  ): Promise<Array<{ day: string; rerun_count: number }>>;
  getJobStepsAverageTime(
    filters?: PipelineFilters,
    method?: MetricMethod
  ): Promise<
    Array<{
      name: string;
      value: number;
      method: MetricMethod;
      count: number;
      outliers?: PipelineAverageOutlier[];
    }>
  >;
  getJobStepsAverageTimeByDay(
    filters?: PipelineFilters,
    method?: MetricMethod
  ): Promise<
    Array<{
      day: string;
      steps: Array<{
        name: string;
        value: number;
        method: MetricMethod;
        outliers?: PipelineAverageOutlier[];
      }>;
    }>
  >;
}
