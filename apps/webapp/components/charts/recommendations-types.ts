export type RecommendationSeverity = 'warning' | 'info' | 'success';

export interface Recommendation {
  id: string;
  metric: string;
  title: string;
  message: string;
  severity: RecommendationSeverity;
  currentValue?: string;
  targetValue?: string;
  contextItems?: string[];
  href?: string;
  hrefLabel?: string;
}

export interface RecommendationsProps {
  pairingIndex?: {
    pairing_index_percentage: number;
    paired_commits: number;
    total_analyzed_commits: number;
  } | null;
  prSummary?: {
    total: number;
    merged: number;
    closed: number;
    open: number;
  } | null;
  deploymentFrequency?: Array<{
    pipeline: string;
    job: string;
    day_count: number;
  }>;
  jobsSummary?: Array<{
    workflow_name?: string;
    job_name: string;
    success_rate: number;
    value: number;
    value_formatted?: string;
    method?: string;
    rerun_count: number;
    total_runs: number;
  }>;
  selectedWorkflow?: string;
  reviewTime?: Array<{
    author: string;
    value: number;
    value_formatted?: string;
    method?: string;
  }>;
}
