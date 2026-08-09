import type { MetricCleaningOptions, MetricMethod, MetricOutlier } from '../metric-samples';

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
  method?: MetricMethod;
}

export interface PipelineMetricOutlierItem {
  runId: string;
  workflowName?: string;
  jobName?: string;
  stepName?: string;
}

export type PipelineMetricOutlier = MetricOutlier<PipelineMetricOutlierItem>;

export interface DeploymentFrequency {
  date: string;
  count: number;
}

export interface PipelineMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number; // percentage
  value: number;
  method: MetricMethod;
  outliers?: PipelineMetricOutlier[];
}

export interface JobMetrics {
  jobName: string;
  workflowName?: string;
  totalRuns: number;
  value: number;
  method: MetricMethod;
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
  outliers?: PipelineMetricOutlier[];
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
  value: number;
  method: MetricMethod;
}

export interface PipelineDashboardRunsDurationItem {
  workflow: string;
  value: number;
  method: MetricMethod;
  min_duration: number;
  max_duration: number;
  total_runs: number;
  outliers?: PipelineMetricOutlier[];
}

export interface PipelineDashboardRunsByItem {
  period: string;
  workflow: string;
  runs: number;
}

export interface PipelineDashboardJobsTimeItem {
  job_name: string;
  workflow_name?: string;
  value: number;
  method: MetricMethod;
  count: number;
  outliers?: PipelineMetricOutlier[];
}

export interface PipelineDashboardJobsTimeByDayItem {
  day: string;
  value: number;
  method: MetricMethod;
  count: number;
  outliers?: PipelineMetricOutlier[];
}

export interface PipelineDashboardJobsDurationByWorkflowItem {
  workflow: string;
  jobs: Record<string, number>;
}

export interface PipelineDashboardJobsSummaryItem {
  workflow_name?: string;
  job_name: string;
  total_runs: number;
  value: number;
  method: MetricMethod;
  success_count: number;
  failure_count: number;
  success_rate: number;
  failure_rate: number;
  rerun_count: number;
  outliers?: PipelineMetricOutlier[];
}

export interface PipelineDashboardRerunsByDayItem {
  day: string;
  rerun_count: number;
}

export interface PipelineDashboardStepsTimeItem {
  name: string;
  value: number;
  method: MetricMethod;
  count: number;
  outliers?: PipelineMetricOutlier[];
}

export interface PipelineDashboardStepsTimeByDayItem {
  day: string;
  steps: Array<{
    name: string;
    value: number;
    method: MetricMethod;
    outliers?: PipelineMetricOutlier[];
  }>;
}

export interface PipelineDashboard {
  summary: PipelineDashboardSummary;
  jobs_by_status: Array<{ Status: string; Count: number }>;
  runs_duration: PipelineDashboardRunsDurationItem[];
  runs_by: PipelineDashboardRunsByItem[];
  jobs_time: PipelineDashboardJobsTimeItem[];
  jobs_time_by_day: PipelineDashboardJobsTimeByDayItem[];
  jobs_duration_by_workflow: PipelineDashboardJobsDurationByWorkflowItem[];
  jobs_summary: PipelineDashboardJobsSummaryItem[];
  jobs_reruns_by_day: PipelineDashboardRerunsByDayItem[];
  job_steps_time: PipelineDashboardStepsTimeItem[];
  job_steps_time_by_day: PipelineDashboardStepsTimeByDayItem[];
}
