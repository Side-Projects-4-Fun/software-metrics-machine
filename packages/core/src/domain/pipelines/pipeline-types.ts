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
