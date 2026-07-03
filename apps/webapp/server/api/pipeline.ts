import { ApiParams, fetchAPI } from './client';

type MetricOutlier = {
  value: number;
  timestamp: string;
  lowerBound: number;
  upperBound: number;
  item: Record<string, unknown>;
};

export const pipelineAPI = {
  byStatus: (params?: ApiParams) =>
    fetchAPI<Array<{ status: string; count: number }>>(
      '/pipelines/by-status',
      params
    ),
  
  jobsByStatus: (params?: ApiParams) =>
    fetchAPI<Array<{ Status: string; Count: number }>>(
      '/pipelines/jobs-by-status',
      params
    ),

  jobsSummary: (params?: ApiParams) =>
    fetchAPI<Array<{
      workflow_name?: string;
      job_name: string;
      total_runs: number;
      avg_duration_minutes: number;
      success_count: number;
      failure_count: number;
      success_rate: number;
      failure_rate: number;
      rerun_count: number;
      outliers?: MetricOutlier[];
    }>>('/pipelines/jobs-summary', params),

  jobsRerunsByDay: (params?: ApiParams) =>
    fetchAPI<Array<{ day: string; rerun_count: number }>>(      '/pipelines/jobs-reruns-by-day',
      params
    ),
  
  summary: (params?: ApiParams) =>
    fetchAPI<{
      total_runs: number;
      first_run: { createdAt?: string; created_at?: string } | string | null;
      last_run: { createdAt?: string; created_at?: string } | string | null;
      in_progress: number;
      queued: number;
    }>('/pipelines/summary', params),
  
  runsDuration: (params?: ApiParams) =>
    fetchAPI<Array<{
      workflow: string;
      aggregation?: 'avg' | 'min' | 'max';
      duration?: number;
      avg_duration?: number;
      min_duration?: number;
      max_duration?: number;
      total_runs: number;
      outliers?: MetricOutlier[];
    }>>(
      '/pipelines/runs-duration',
      params
    ),

  jobsDurationByWorkflow: (params?: ApiParams) =>
    fetchAPI<Array<{ workflow: string; jobs: Record<string, number> }>>(
      '/pipelines/jobs-duration-by-workflow',
      params
    ),
  
  deploymentFrequency: (params?: ApiParams) =>
    fetchAPI<Array<{ pipeline: string; job: string; days: string; weeks: string; months: string; daily_counts: number; weekly_counts: number; monthly_counts: number; commits: string; links: string }>>(
      '/pipelines/deployment-frequency',
      params
    ),
  
  runsBy: (params?: ApiParams) =>
    fetchAPI<Array<{ period: string; workflow: string; runs: number }>>(
      '/pipelines/runs-by',
      params
    ),
  
  jobsAverageTime: (params?: ApiParams) =>
    fetchAPI<Array<{ job_name: string; avg_time: number; count: number; outliers?: MetricOutlier[] }>>(
      '/pipelines/jobs-average-time',
      params
    ),

  jobsAverageTimeByDay: (params?: ApiParams) =>
    fetchAPI<Array<{ day: string; avg_time: number; count: number; outliers?: MetricOutlier[] }>>(
      '/pipelines/jobs-average-time-by-day',
      params
    ),

  jobStepsAverageTime: (params?: ApiParams) =>
    fetchAPI<Array<{ name: string; averageDurationMinutes: number; count: number; outliers?: MetricOutlier[] }>>(
      '/pipelines/jobs-steps-average-time',
      params
    ),

  jobStepsAverageTimeByDay: (params?: ApiParams) =>
    fetchAPI<Array<{ day: string; steps: Array<{ name: string; averageDurationMinutes: number; outliers?: MetricOutlier[] }> }>>(
      '/pipelines/jobs-steps-average-time-by-day',
      params
    ),

  // Filter option endpoints
  getFilterOptions: (params?: ApiParams) =>
    fetchAPI<{
      workflows: Array<{ name: string; path: string }>;
      statuses: string[];
      conclusions: string[];
      branches: string[];
      events: string[];
      jobs: Array<{ name: string; id?: string }>;
    }>('/pipelines/filter-options', params),

  getJobs: (params?: ApiParams) =>
    fetchAPI<Array<{ name: string; id?: string }>>('/pipelines/jobs', params),
};
