import type { MetricCleaningOptions, MetricMethod, MetricOutlier } from '../metric-samples';

/**
 * Change request-related domain types for analytics.
 *
 * A "change request" is the provider-neutral term for what GitHub calls a "pull
 * request" and GitLab calls a "merge request". Provider clients keep their own
 * naming (e.g. `PullRequestJsonResponse`); the domain layer always uses the
 * terms defined here.
 */

export interface ChangeRequestLabel {
  name: string;
  description?: string;
}

export interface ChangeRequestUser {
  login: string;
  id: number;
}

type ChangeRequestStatus = 'open' | 'closed' | 'merged' | 'draft';

export interface ChangeRequestDetails {
  id: number;
  number: number;
  title: string;
  description?: string;
  createdAt: string; // ISO format
  updatedAt: string;
  mergedAt?: string; // null if not merged
  closedAt?: string;
  author: ChangeRequestUser;
  labels: ChangeRequestLabel[];
  state: ChangeRequestStatus;
  url: string;
  totalComments: number;
  comments: ChangeRequestComment[];
}

export interface ChangeRequestComment {
  url: string;
  body: string;
  change_request_review_id: number;
  id: number;
  createdAt: string;
  author: ChangeRequestUser;
  reactions: {
    url: string;
    total_count: number;
    '+1': number;
    '-1': number;
    laugh: number;
    hooray: number;
    confused: number;
    heart: number;
    rocket: number;
    eyes: number;
  };
}

export interface ChangeRequestFilters {
  startDate?: string;
  endDate?: string;
  authors?: string | string[];
  excludeAuthors?: string | string[];
  excludeCommenters?: string | string[];
  labels?: string | string[];
  state?: ChangeRequestStatus;
  rawFilters?: string;
  cleaning?: MetricCleaningOptions;
}

export interface ChangeRequestAverageOutlierItem {
  id: number;
  number: number;
  title: string;
  author: string;
  url: string;
}

export type ChangeRequestAverageOutlier = MetricOutlier<ChangeRequestAverageOutlierItem>;

export interface ChangeRequestMetrics {
  openDays: number;
  totalChangeRequests: number;
  mergedChangeRequests: number;
  closedChangeRequests: number;
  openChangeRequests: number;
  comments: number;
  most_commented_change_requests: MostCommentedChangeRequestData[];
  leadTime: number;
  method: MetricMethod;
  commentSummary: CommentAuthor[];
  labelSummary: LabelSummary[];
  outliers?: {
    openDays: ChangeRequestAverageOutlier[];
    comments: ChangeRequestAverageOutlier[];
  };
}

export interface ChangeRequestSummaryEntry {
  number: number;
  title: string;
  author: string;
  created: string;
  merged?: string;
  closed?: string;
}

export interface ChangeRequestSummaryMostCommentedEntry {
  number: number;
  title: string;
  author: string;
  comments: number;
}

export interface ChangeRequestSummaryLabel {
  label: string;
  change_requests: number;
}

export interface ChangeRequestSummaryTheme {
  text: string;
  value: number;
}

export interface ChangeRequestSummaryTopCommenter {
  login: string;
  comments: number;
}

export interface ChangeRequestSummaryFirstCommentTime {
  average: number;
  median: number;
  min: number;
  max: number;
  change_requests_with_comment: number;
  change_requests_without_comment: number;
}

export interface ChangeRequestSummary {
  total_change_requests: number;
  merged_change_requests: number;
  closed_change_requests: number;
  change_requests_without_conclusion: number;
  open_change_requests: number;
  avg_comments_per_change_request: number;
  unique_authors: number;
  unique_labels: number;
  labels: ChangeRequestSummaryLabel[];
  first_change_request: ChangeRequestSummaryEntry | null;
  last_change_request: ChangeRequestSummaryEntry | null;
  top_themes: ChangeRequestSummaryTheme[];
  most_commented_change_request: ChangeRequestSummaryMostCommentedEntry | null;
  most_commented_change_requests: MostCommentedChangeRequestData[];
  top_commenter: ChangeRequestSummaryTopCommenter | null;
  time_to_first_comment_hours: ChangeRequestSummaryFirstCommentTime;
}

export interface ChangeRequestSummaryResponse {
  result: ChangeRequestSummary;
}

export interface CommentAuthor {
  author: string;
  count: number;
}

export interface FirstCommentMetric {
  author: string;
  value: number;
  method: MetricMethod;
  change_requests_with_comments: number;
  outliers?: ChangeRequestAverageOutlier[];
}

export interface MostCommentedChangeRequestData {
  change_request_id: number;
  change_request_title: string;
  change_request_url: string;
  comments_count: number;
}

export interface ChangeRequestsByTimeframe {
  period: string;
  count: number;
  openDays: number;
  comments: number;
  method: MetricMethod;
  outliers?: {
    openDays: ChangeRequestAverageOutlier[];
    comments: ChangeRequestAverageOutlier[];
  };
}

export interface LabelSummary {
  label: string;
  count: number;
  openDays: number;
  outliers?: ChangeRequestAverageOutlier[];
}
