import type { MetricCleaningOptions, MetricOutlier } from '../metric-samples';

/**
 * Pipeline-related domain types for deployment frequency and metrics
 */

export interface PipelineJobConclusion {
  status: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out';
  count: number;
}

export interface PipelineStep {
  name: string;
  status: string;
  conclusion: string;
  number: number;
  startedAt?: string;
  completedAt?: string;
}

export interface PipelineJob {
  id: string;
  runId: string;
  name: string;
  startedAt: string; // ISO format
  completedAt?: string;
  conclusion: string;
  status: string;
  durationSeconds?: number;
  steps?: PipelineStep[];
}

export interface PipelineRun {
  id: string;
  number: number;
  name: string;
  status: string; // completed, in_progress, queued
  conclusion?: string; // success, failure, etc.
  createdAt: string; // ISO format
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  runAttempt?: number;
  branch: string;
  event?: string;
  commit?: string;
  path: string; // workflow file path
  jobs?: PipelineJob[];
}

export interface PipelineFilters {
  startDate?: string;
  endDate?: string;
  targetBranch?: string;
  event?: string; // push, pull_request, etc.
  workflowPath?: string;
  status?: string; // completed, in_progress, queued
  conclusion?: string; // success, failure, cancelled, skipped
  jobName?: string;
  jobConclusion?: string;
  includeDefined?: boolean; // Only .yml/.yaml files
  rawFilters?: string;
  cleaning?: MetricCleaningOptions;
}

export interface PipelineAverageOutlierItem {
  runId: string;
  workflowName?: string;
  jobName?: string;
  stepName?: string;
}

export type PipelineAverageOutlier = MetricOutlier<PipelineAverageOutlierItem>;

export interface DeploymentFrequency {
  date: string;
  count: number;
}

export interface PipelineMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number; // percentage
  averageDurationMinutes: number;
  outliers?: PipelineAverageOutlier[];
}

export interface JobMetrics {
  jobName: string;
  workflowName?: string;
  totalRuns: number;
  averageDurationMinutes: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  failureRate: number;
  rerunCount: number;
  cancelledCount: number;
  skippedCount: number;
  timedOutCount: number;
  actionRequiredCount: number;
  unknownCount: number;
  outliers?: PipelineAverageOutlier[];
}

export interface PipelineComputedDurations {
  runId: string;
  durationMinutes: number;
  jobCount: number;
}

export interface PipelineDurationRow {
  runId: string;
  durationMinutes: number;
  timestamp: string;
}

// ──────────────────────────────────────────
// Dashboard types (replaces REST DTOs)
// ──────────────────────────────────────────

export interface PipelineDashboardSummary {
  total_runs: number;
  first_run: {
    path?: string;
    createdAt?: string;
    completedAt?: string;
    startedAt?: string;
    status?: string;
    conclusion?: string;
    branch?: string;
    event?: string;
  } | null;
  last_run: {
    path?: string;
    createdAt?: string;
    completedAt?: string;
    startedAt?: string;
    status?: string;
    conclusion?: string;
    branch?: string;
    event?: string;
  } | null;
  in_progress: number;
  queued: number;
  successful_runs: number;
  failed_runs: number;
  cancelled_runs: number;
  skipped_runs: number;
  timed_out_runs: number;
  success_rate: number;
  average_duration_minutes: number;
}

export interface PipelineDashboardRunsDurationItem {
  workflow: string;
  avg_duration: number;
  min_duration: number;
  max_duration: number;
  total_runs: number;
  outliers?: PipelineAverageOutlier[];
}

export interface PipelineDashboardRunsByItem {
  period: string;
  workflow: string;
  runs: number;
}

export interface PipelineDashboardJobsAverageTimeItem {
  job_name: string;
  workflow_name?: string;
  avg_time: number;
  count: number;
  outliers?: PipelineAverageOutlier[];
}

export interface PipelineDashboardJobsAverageTimeByDayItem {
  day: string;
  avg_time: number;
  count: number;
  outliers?: PipelineAverageOutlier[];
}

export interface PipelineDashboardJobsDurationByWorkflowItem {
  workflow: string;
  jobs: Record<string, number>;
}

export interface PipelineDashboardJobsSummaryItem {
  workflow_name?: string;
  job_name: string;
  total_runs: number;
  avg_duration_minutes: number;
  success_count: number;
  failure_count: number;
  success_rate: number;
  failure_rate: number;
  rerun_count: number;
  outliers?: PipelineAverageOutlier[];
}

export interface PipelineDashboardRerunsByDayItem {
  day: string;
  rerun_count: number;
}

export interface PipelineDashboardStepsAverageTimeItem {
  name: string;
  averageDurationMinutes: number;
  count: number;
  outliers?: PipelineAverageOutlier[];
}

export interface PipelineDashboardStepsAverageTimeByDayItem {
  day: string;
  steps: Array<{
    name: string;
    averageDurationMinutes: number;
    outliers?: PipelineAverageOutlier[];
  }>;
}

export interface PipelineDashboard {
  summary: PipelineDashboardSummary;
  jobs_by_status: Array<{ Status: string; Count: number }>;
  runs_duration: PipelineDashboardRunsDurationItem[];
  runs_by: PipelineDashboardRunsByItem[];
  jobs_average_time: PipelineDashboardJobsAverageTimeItem[];
  jobs_average_time_by_day: PipelineDashboardJobsAverageTimeByDayItem[];
  jobs_duration_by_workflow: PipelineDashboardJobsDurationByWorkflowItem[];
  jobs_summary: PipelineDashboardJobsSummaryItem[];
  jobs_reruns_by_day: PipelineDashboardRerunsByDayItem[];
  job_steps_average_time: PipelineDashboardStepsAverageTimeItem[];
  job_steps_average_time_by_day: PipelineDashboardStepsAverageTimeByDayItem[];
}
