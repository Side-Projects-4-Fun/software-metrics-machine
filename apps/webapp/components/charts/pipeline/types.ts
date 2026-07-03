export interface MetricOutlier {
  value: number;
  timestamp: string;
  lowerBound: number;
  upperBound: number;
  item: Record<string, unknown>;
}

export interface JobByStatusResponseItem {
  Status?: string;
  Count?: number;
}

export interface JobByStatusData {
  status: string;
  count: number;
}

export interface PipelineSummaryResponse {
  total_runs?: number;
  in_progress?: number;
  queued?: number;
  first_run?: { createdAt?: string; created_at?: string } | string | null;
  last_run?: { createdAt?: string; created_at?: string } | string | null;
}

export interface RunsDurationResponseItem {
  workflow?: string;
  aggregation?: 'avg' | 'min' | 'max';
  duration?: number;
  avg_duration?: number;
  min_duration?: number;
  max_duration?: number;
  total_runs?: number;
  name?: string;
  value?: number;
  outliers?: MetricOutlier[];
}

export interface RunsDurationData {
  workflow: string;
  avg_duration: number;
  min_duration: number;
  max_duration: number;
  total_runs: number;
  name?: string;
  value?: number;
  outliers?: MetricOutlier[];
}

export interface JobsDurationByWorkflowItem {
  workflow: string;
  jobs: Record<string, number>;
}

export interface JobsAverageTimeResponseItem {
  job_name?: string;
  workflow_name?: string;
  avg_time?: number;
  count?: number;
  outliers?: MetricOutlier[];
}

export interface JobsAverageTimeData {
  job_name: string;
  workflow_name?: string;
  avg_time: number;
  count: number;
  outliers?: MetricOutlier[];
}

export interface JobsAverageTimeByDayResponseItem {
  day?: string;
  avg_time?: number;
  count?: number;
  outliers?: MetricOutlier[];
}

export interface JobsAverageTimeByDayData {
  day: string;
  avg_time: number;
  count: number;
  outliers?: MetricOutlier[];
}

export interface JobSummaryResponseItem {
  workflow_name?: string;
  job_name?: string;
  total_runs?: number;
  avg_duration_minutes?: number;
  success_count?: number;
  failure_count?: number;
  success_rate?: number;
  failure_rate?: number;
  rerun_count?: number;
  outliers?: MetricOutlier[];
}

export interface JobSummaryData {
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
}

export interface JobRerunsByDayResponseItem {
  day?: string;
  rerun_count?: number;
}

export interface JobRerunsByDayData {
  day: string;
  rerun_count: number;
}

export interface JobStepsAverageTimeResponseItem {
  name?: string;
  averageDurationMinutes?: number;
  count?: number;
  outliers?: MetricOutlier[];
}

export interface JobStepsAverageTimeData {
  name: string;
  averageDurationMinutes: number;
  count: number;
  outliers?: MetricOutlier[];
}

export interface JobStepsAverageTimeByDayResponseItem {
  day: string;
  steps: Array<{ name: string; averageDurationMinutes: number; outliers?: MetricOutlier[] }>;
}

export interface JobStepsAverageTimeByDayData {
  day: string;
  [stepName: string]: number | string;
}

export interface RunsByResponseItem {
  period?: string;
  workflow?: string;
  runs?: number;
}

export interface RunsByDayData {
  day: string;
  runs: number;
}
