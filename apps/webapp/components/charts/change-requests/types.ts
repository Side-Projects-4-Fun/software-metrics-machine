export interface MetricOutlier {
  value: number;
  timestamp: string;
  lowerBound: number;
  upperBound: number;
  item: Record<string, unknown>;
}

export interface ByAuthorData {
  author: string;
  count: number;
}

export interface ReviewTimeData {
  author: string;
  value: number;
  value_formatted: string;
  method: string;
  outliers?: MetricOutlier[];
}

export interface CommentsByAuthorData {
  author: string;
  count: number;
}

export interface FirstCommentTimeData {
  author: string;
  value: number;
  value_formatted: string;
  method: string;
  change_requests_with_comments: number;
  outliers?: MetricOutlier[];
}

export interface OpenThroughTimeData {
  date: string;
  opened: number;
  closed: number;
}

export interface OpenTimeData {
  period: string;
  value: number;
  value_formatted: string;
  method: string;
  outliers?: MetricOutlier[];
}

export interface CommentsData {
  comments_count: number;
  outliers?: MetricOutlier[];
}

export interface SummaryData {
  total_change_requests?: number;
  merged_change_requests?: number;
  closed_change_requests?: number;
  open_change_requests?: number;
  comments_per_change_request?: number;
  unique_authors?: number;
  unique_labels?: number;
  first_change_request?: { created?: string; createdAt?: string; created_at?: string } | string | null;
  last_change_request?: { created?: string; createdAt?: string; created_at?: string } | string | null;
  top_themes?: Array<{ text: string; value: number }>;
  labels?: Array<{ label: string; change_requests: number }>;
  most_commented_change_requests?: MostCommentedChangeRequestData[];
}

export interface MostCommentedChangeRequestData {
  change_request_id: number;
  change_request_title: string;
  change_request_url: string;
  comments_count: number;
}

export interface OpenThroughTimeResponseItem {
  date: string;
  kind?: 'Opened' | 'Closed';
  count?: number;
  open_change_requests?: number;
}