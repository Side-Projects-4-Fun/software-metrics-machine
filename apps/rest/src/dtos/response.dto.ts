/**
 * Response DTOs for API endpoints
 * Define the structure of all API responses
 *
 * Filter types are imported from @smmachine/core to keep a single
 * source of truth shared across CLI, REST API, and domain logic.
 * Domain types (PRDetails, PRMetrics, PipelineRun, etc.) are also
 * imported directly for use as response shapes.
 */

import type {
  PRDetails,
  PipelineFilterOptions,
  PipelineMetrics,
  JobMetrics,
  CodeChurnResult,
  FileCoupling,
  SonarqubeComponentMeasure,
  BigOFileAnalysis as CoreBigOFileAnalysis,
  BigOFileSummary as CoreBigOFileSummary,
  PRAverageOutlier,
  PipelineAverageOutlier,
} from '@smmachine/core';

// Types defined in core but not re-exported through the public API,
// so we define them locally.

export interface PairingIndexResult {
  pairingIndexPercentage: number;
  totalAnalyzedCommits: number;
  pairedCommits: number;
  topPairings?: Array<{ author: string; coAuthor: string; pairedCommits: number }>;
  latestPairedCommits?: Array<{
    hash: string;
    author: string;
    coAuthors: string[];
    timestamp: string;
    subject: string;
  }>;
}

export type BigOFileSummary = CoreBigOFileSummary;
export type BigOFileAnalysis = CoreBigOFileAnalysis;

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

// ──────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────
export interface ConfigurationResponse {
  result: {
    git_provider?: string;
    github_repository?: string;
    git_repository_location: string;
    store_data: string;
    deployment_frequency_targets: Array<{ pipeline: string; job: string }>;
    main_branch?: string;
    dashboard_start_date: string | null;
    dashboard_end_date: string | null;
    dashboard_color?: string;
    logging_level?: string;
    jira_url: string | null;
    jira_email: string | null;
    jira_token: string | null;
    jira_project: string | null;
    sonar_url: string | null;
    sonar_project: string | null;
  };
}

// ──────────────────────────────────────────
// Pull Request endpoints
// ──────────────────────────────────────────

export interface PRSummaryResponse {
  result: {
    total_prs: number;
    merged_prs: number;
    closed_prs: number;
    open_prs: number;
    avg_comments_per_pr: number;
    unique_authors: number;
    unique_labels: number;
    labels: Array<{ label: string; prs: number }>;
    first_pr: PRDetails | null;
    last_pr: PRDetails | null;
    top_themes: Array<{ text: string; value: number }>;
    most_commented_prs: Array<{
      pull_request_id: number;
      pull_request_title: string;
      pull_request_url: string;
      comments_count: number;
    }>;
  };
}

export interface PRThroughTimeResponse {
  result: Array<{ date: string; kind: string; count: number }>;
}

export interface PRByAuthorResponse {
  result: Array<{ author: string; count: number }>;
}

export interface PRAverageReviewTimeResponse {
  result: Array<{ author: string; avg_days: number; outliers?: PRAverageOutlier[] }>;
}

export type PRAverageOpenByResponse = Array<{
  period: string;
  avg_days: number;
  outliers?: PRAverageOutlier[];
}>;

export interface PRAverageCommentsResponse {
  avg_comments: number;
  outliers?: PRAverageOutlier[];
}

export interface PRCommentsByAuthorResponse {
  result: Array<{ author: string; count: number }>;
}

export interface PRFirstCommentTimeResponse {
  result: Array<{
    author: string;
    avg_hours: number;
    prs_with_comments: number;
    outliers?: PRAverageOutlier[];
  }>;
}

export type PRFilterOptionsResponse = {
  authors: string[];
  labels: string[];
  commenters: string[];
};

// ──────────────────────────────────────────
// Pipeline endpoints
// ──────────────────────────────────────────

export interface PipelineSummaryResponse {
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
}

export type PipelineByStatusResponse = Array<{ status: string; count: number }>;

export type PipelineJobsByStatusResponse = Array<{ Status: string; Count: number }>;

export interface PipelineJobsSummaryResponse {
  result: Array<{
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
  }>;
}

export interface PipelineRunsDurationResponse extends Array<
  | {
      workflow: string;
      aggregation: string;
      duration: number;
      total_runs: number;
      outliers?: PipelineAverageOutlier[];
    }
  | {
      workflow: string;
      avg_duration: number;
      min_duration: number;
      max_duration: number;
      total_runs: number;
      outliers?: PipelineAverageOutlier[];
    }
> {}

export type PipelineJobsDurationByWorkflowResponse = Array<{
  workflow: string;
  jobs: Record<string, number>;
}>;

export type PipelineRunsByResponse = Array<{
  period: string;
  workflow: string;
  runs: number;
}>;

export interface PipelineJobsRerunsResponse {
  result: Array<{ day: string; rerun_count: number }>;
}

export interface PipelineStepsAverageTimeResponse {
  result: Array<{
    name: string;
    averageDurationMinutes: number;
    count: number;
    outliers?: PipelineAverageOutlier[];
  }>;
}

export interface PipelineStepsAverageTimeByDayResponse {
  result: Array<{
    day: string;
    steps: Array<{
      name: string;
      averageDurationMinutes: number;
      outliers?: PipelineAverageOutlier[];
    }>;
  }>;
}

export interface PipelineJobsAverageTimeResponse {
  result: Array<{
    job_name: string;
    workflow_name?: string;
    avg_time: number;
    count: number;
    outliers?: PipelineAverageOutlier[];
  }>;
}

export interface PipelineJobsAverageTimeByDayResponse {
  result: Array<{
    day: string;
    avg_time: number;
    count: number;
    outliers?: PipelineAverageOutlier[];
  }>;
}

export type PipelineWorkflowsResponse = Array<{ name: string; path: string }>;
export type PipelineStatusesResponse = string[];
export type PipelineConclusionsResponse = string[];
export type PipelineBranchesResponse = string[];
export type PipelineEventsResponse = string[];
export type PipelineJobsResponse = Array<{ name: string; id: string }>;

export type PipelineFilterOptionsResponse = PipelineFilterOptions;

export interface PipelineDashboardResponse {
  summary: PipelineSummaryResponse & {
    successful_runs: number;
    failed_runs: number;
    cancelled_runs: number;
    skipped_runs: number;
    timed_out_runs: number;
    success_rate: number;
    average_duration_minutes: number;
  };
  jobs_by_status: PipelineJobsByStatusResponse;
  runs_duration: PipelineRunsDurationResponse;
  runs_by: PipelineRunsByResponse;
  jobs_average_time: PipelineJobsAverageTimeResponse['result'];
  jobs_average_time_by_day: PipelineJobsAverageTimeByDayResponse['result'];
  jobs_duration_by_workflow: PipelineJobsDurationByWorkflowResponse;
  jobs_summary: PipelineJobsSummaryResponse['result'];
  jobs_reruns_by_day: PipelineJobsRerunsResponse['result'];
  job_steps_average_time: PipelineStepsAverageTimeResponse['result'];
  job_steps_average_time_by_day: PipelineStepsAverageTimeByDayResponse['result'];
}

// ──────────────────────────────────────────
// Code endpoints
// ──────────────────────────────────────────

export interface CodePairingIndexResponse {
  pairing_index_percentage: number;
  total_analyzed_commits: number;
  paired_commits: number;
  top_pairs: Array<{ author: string; co_author: string; paired_commits: number }>;
  latest_paired_commits: Array<{
    hash: string;
    author: string;
    co_authors: string[];
    timestamp: string;
    subject: string;
  }>;
}

export type CodeChurnResponse = Array<{
  date: string;
  type: string;
  value: number;
}>;

export type CodeCouplingResponse = Array<{
  entity: string;
  coupled: string;
  degree: number;
  averageRevs: number;
}>;

export type CodeEntityChurnResponse = Array<{
  entity: string;
  added: number;
  deleted: number;
  commits: number;
}>;

export type CodeEntityEffortResponse = Array<{
  entity: string;
  'total-revs': number;
}>;

export type CodeEntityOwnershipResponse = Array<{
  entity: string;
  author: string;
  added: number;
  deleted: number;
}>;

export type CodeAuthorsResponse = string[];

export type CodeChurnHistoryResponse = Array<{
  fetchedAt: string;
  data: {
    data: Array<{
      date: string;
      added: number;
      deleted: number;
      commits: number;
    }>;
    startDate?: string;
    endDate?: string;
  };
}>;

export type CodeCouplingHistoryResponse = Array<{
  fetchedAt: string;
  data: CodeCouplingResponse;
}>;

export type CodeEntityChurnHistoryResponse = Array<{
  fetchedAt: string;
  data: CodeEntityChurnResponse;
}>;

export type CodeEntityEffortHistoryResponse = Array<{
  fetchedAt: string;
  data: CodeEntityEffortResponse;
}>;

export type CodeEntityOwnershipHistoryResponse = Array<{
  fetchedAt: string;
  data: CodeEntityOwnershipResponse;
}>;

// ──────────────────────────────────────────
// SonarQube endpoints
// ──────────────────────────────────────────
// These already return typed promises in the controller,
// no additional DTOs needed. Types are imported from core.

// ──────────────────────────────────────────
// Orchestrator / Metrics endpoints
// ──────────────────────────────────────────

export interface MetricsIssueResponse {
  totalIssues: number;
  issues: Array<{
    id: string;
    key?: string;
    title: string;
    description?: string;
    status: string;
    assignee?: string;
    createdAt: string;
    labels?: string[];
  }>;
}

export interface MetricsPRResponse {
  averageOpenDays: number;
  totalPRs: number;
  mergedPRs: number;
  closedPRs: number;
  openPRs: number;
  averageComments: number;
  most_commented_prs: Array<{
    pull_request_id: number;
    pull_request_title: string;
    pull_request_url: string;
    comments_count: number;
  }>;
  leadTime: number;
  commentSummary: Array<{ author: string; count: number }>;
  labelSummary: Array<{ label: string; count: number; averageOpenDays: number }>;
}

export interface MetricsDeploymentResponse {
  pipelineMetrics: PipelineMetrics;
  deploymentFrequency: DeploymentFrequencyRow[];
  jobMetrics: JobMetrics[];
}

export interface MetricsCodeResponse {
  pairingIndex: PairingIndexResult;
  codeChurn: CodeChurnResult;
  fileCoupling: FileCoupling[];
}

export type MetricsQualityResponse = SonarqubeComponentMeasure | null;

export interface MetricsFullReportResponse {
  timestamp: string;
  pullRequests: MetricsPRResponse;
  deployment: MetricsDeploymentResponse;
  code: MetricsCodeResponse;
  issues: MetricsIssueResponse;
  quality: MetricsQualityResponse;
}

// ──────────────────────────────────────────
// Generic error response
// ──────────────────────────────────────────

export class ErrorResponse {
  statusCode!: number;
  message!: string;
  error!: string;
  timestamp!: string;
  path?: string;
}
