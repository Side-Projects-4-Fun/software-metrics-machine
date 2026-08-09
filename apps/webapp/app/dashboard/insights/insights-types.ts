export type ResultWrapper<T> = {
  result: T;
};
export interface PairingIndex {
  pairing_index_percentage: number;
  paired_commits: number;
  total_analyzed_commits: number;
}
export interface PipelineSummary {
  total_runs: number;
  in_progress: number;
  queued: number;
  first_run?: { createdAt?: string; created_at?: string } | string | null;
  last_run?: { createdAt?: string; created_at?: string } | string | null;
}
export interface ChangeRequestSummary {
  total_change_requests?: number;
  total?: number;
  merged_change_requests?: number;
  merged?: number;
  closed_change_requests?: number;
  closed?: number;
  open_change_requests?: number;
  open?: number;
  first_change_request?: { created?: string; createdAt?: string; created_at?: string } | string | null;
  last_change_request?: { created?: string; createdAt?: string; created_at?: string } | string | null;
}
export interface DeploymentFrequencyResponseItem {
  pipeline?: string;
  job?: string;
  days?: string;
  weeks?: string;
  months?: string;
  daily_counts?: number;
  weekly_counts?: number;
  monthly_counts?: number;
}
export interface DeploymentFrequencyPoint {
  pipeline: string;
  job: string;
  target_label: string;
  date: string;
  week_label: string;
  month_label: string;
  month: string;
  day_count: number;
  week_count: number;
  month_count: number;
}
export interface JobsSummaryItem {
  workflow_name?: string;
  job_name: string;
  total_runs: number;
  value: number;
  value_formatted?: string;
  method?: string;
  success_count: number;
  failure_count: number;
  success_rate: number;
  failure_rate: number;
  rerun_count: number;
}
export interface AverageReviewTimeItem {
  author: string;
  value: number;
  value_formatted?: string;
  method?: string;
}
