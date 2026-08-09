/**
 * Response DTOs for API endpoints
 * Define the structure of all API responses
 *
 * Filter types are imported from @smmachine/core to keep a single
 * source of truth shared across CLI, REST API, and domain logic.
 * Domain types (ChangeRequestDetails, ChangeRequestMetrics, PipelineRun, etc.) are also
 * imported directly for use as response shapes.
 */

import type {
  ChangeRequestDetails,
  PipelineFilterOptions,
  PipelineMetrics,
  JobMetrics,
  CodeChurnResult,
  FileCoupling,
  SonarqubeComponentMeasure,
  BigOFileAnalysis as CoreBigOFileAnalysis,
  BigOFileSummary as CoreBigOFileSummary,
  ChangeRequestAverageOutlier,
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

export interface VersionResponse {
  result: {
    version: string;
  };
}

export interface ConfigurationResponse {
  result: {
    git_provider?: string;
    github_repository?: string;
    gitlab_url?: string;
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
// Change Request endpoints
// ──────────────────────────────────────────

export interface ChangeRequestSummaryResponse {
  result: {
    total_change_requests: number;
    merged_change_requests: number;
    closed_change_requests: number;
    open_change_requests: number;
    avg_comments_per_change_request: number;
    unique_authors: number;
    unique_labels: number;
    labels: Array<{ label: string; change_requests: number }>;
    first_change_request: ChangeRequestDetails | null;
    last_change_request: ChangeRequestDetails | null;
    top_themes: Array<{ text: string; value: number }>;
    most_commented_change_requests: Array<{
      change_request_id: number;
      change_request_title: string;
      change_request_url: string;
      comments_count: number;
    }>;
  };
}

export interface ChangeRequestThroughTimeResponse {
  result: Array<{ date: string; kind: string; count: number }>;
}

export interface ChangeRequestByAuthorResponse {
  result: Array<{ author: string; count: number }>;
}

export interface ChangeRequestAverageReviewTimeResponse {
  result: Array<{
    author: string;
    value: number;
    value_formatted: string;
    method: string;
    outliers?: ChangeRequestAverageOutlier[];
  }>;
}

export type ChangeRequestAverageOpenByResponse = Array<{
  period: string;
  value: number;
  value_formatted: string;
  method: string;
  outliers?: ChangeRequestAverageOutlier[];
}>;

export interface ChangeRequestAverageCommentsResponse {
  avg_comments: number;
  outliers?: ChangeRequestAverageOutlier[];
}

export interface ChangeRequestCommentsByAuthorResponse {
  result: Array<{ author: string; count: number }>;
}

export interface ChangeRequestFirstCommentTimeResponse {
  result: Array<{
    author: string;
    value: number;
    value_formatted: string;
    method: string;
    change_requests_with_comments: number;
    outliers?: ChangeRequestAverageOutlier[];
  }>;
}

export type ChangeRequestFilterOptionsResponse = {
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
    value: number;
    value_formatted: string;
    method: string;
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
      duration_formatted: string;
      method: string;
      total_runs: number;
      outliers?: PipelineAverageOutlier[];
    }
  | {
      workflow: string;
      value: number;
      value_formatted: string;
      method: string;
      min_duration: number;
      min_duration_formatted: string;
      max_duration: number;
      max_duration_formatted: string;
      total_runs: number;
      outliers?: PipelineAverageOutlier[];
    }
> {}

export type PipelineJobsDurationByWorkflowResponse = Array<{
  workflow: string;
  jobs: Record<string, number>;
  jobs_formatted: Record<string, string>;
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
    value: number;
    value_formatted: string;
    method: string;
    count: number;
    outliers?: PipelineAverageOutlier[];
  }>;
  total_average_minutes: number;
  total_average_minutes_formatted: string;
}

export interface PipelineStepsAverageTimeByDayResponse {
  result: Array<{
    day: string;
    steps: Array<{
      name: string;
      value: number;
      value_formatted: string;
      method: string;
      outliers?: PipelineAverageOutlier[];
    }>;
  }>;
}

export interface PipelineJobsAverageTimeResponse {
  result: Array<{
    job_name: string;
    workflow_name?: string;
    value: number;
    value_formatted: string;
    method: string;
    count: number;
    outliers?: PipelineAverageOutlier[];
  }>;
}

export interface PipelineJobsAverageTimeByDayResponse {
  result: Array<{
    day: string;
    value: number;
    value_formatted: string;
    method: string;
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
    value: number;
    value_formatted: string;
    method: string;
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
  job_steps_average_time_total_minutes: number;
  job_steps_average_time_total_minutes_formatted: string;
  job_steps_average_time_by_day: PipelineStepsAverageTimeByDayResponse['result'];
}

export interface PipelineEvaluationResponse {
  generatedAt: string;
  signals: Array<{
    id: string;
    title: string;
    description: string;
    severity: string;
    category: string;
    metrics: Array<{ label: string; value: string }>;
  }>;
  summary: {
    totalRuns: number;
    durationMinutes: number;
    durationMinutes_formatted: string;
    method: string;
    successRate: number;
    failureRate: number;
    totalReruns: number;
    bottleneckJob?: string;
    bottleneckJobSharePercent?: number;
    slowestWorkflow?: string;
  };
}

export interface ChangeRequestEvaluationResponse {
  generatedAt: string;
  signals: Array<{
    id: string;
    title: string;
    description: string;
    severity: string;
    category: string;
    metrics: Array<{ label: string; value: string }>;
  }>;
  summary: {
    totalChangeRequests: number;
    mergedChangeRequests: number;
    openChangeRequests: number;
    avgCommentsPerChangeRequest: number;
    reviewHours: number;
    reviewHours_formatted: string;
    openDays: number;
    openDays_formatted: string;
    method: string;
    uniqueAuthors: number;
    topReviewer?: string;
    bottleneckAuthor?: string;
  };
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

export type CodeLayeredCouplingResponse = Array<{
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

export type CodeLayeredCouplingHistoryResponse = Array<{
  fetchedAt: string;
  data: CodeLayeredCouplingResponse;
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

export interface MetricsChangeRequestsResponse {
  openDays: number;
  openDays_formatted: string;
  totalChangeRequests: number;
  mergedChangeRequests: number;
  closedChangeRequests: number;
  openChangeRequests: number;
  comments: number;
  most_commented_change_requests: Array<{
    change_request_id: number;
    change_request_title: string;
    change_request_url: string;
    comments_count: number;
  }>;
  leadTime: number;
  leadTime_formatted: string;
  method: string;
  commentSummary: Array<{ author: string; count: number }>;
  labelSummary: Array<{
    label: string;
    count: number;
    openDays: number;
    openDays_formatted: string;
  }>;
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
  changeRequests: MetricsChangeRequestsResponse;
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
