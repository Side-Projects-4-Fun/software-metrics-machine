import type { MetricCleaningOptions, MetricOutlier } from '../metric-samples';

/**
 * PR-related domain types for analytics
 */

export interface PRLabel {
  name: string;
  description?: string;
}

export interface PRUser {
  login: string;
  id: number;
}

type PRStatus = 'open' | 'closed' | 'merged' | 'draft';

export interface PRDetails {
  id: number;
  number: number;
  title: string;
  description?: string;
  createdAt: string; // ISO format
  updatedAt: string;
  mergedAt?: string; // null if not merged
  closedAt?: string;
  author: PRUser;
  labels: PRLabel[];
  state: PRStatus;
  url: string;
  totalComments: number;
  comments: PRComment[];
}

export interface PRComment {
  url: string;
  body: string;
  pull_request_review_id: number;
  id: number;
  createdAt: string;
  author: PRUser;
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

export interface PRFilters {
  startDate?: string;
  endDate?: string;
  authors?: string | string[];
  excludeAuthors?: string | string[];
  excludeCommenters?: string | string[];
  labels?: string | string[];
  state?: PRStatus;
  rawFilters?: string;
  cleaning?: MetricCleaningOptions;
}

export interface PRAverageOutlierItem {
  id: number;
  number: number;
  title: string;
  author: string;
  url: string;
}

export type PRAverageOutlier = MetricOutlier<PRAverageOutlierItem>;

export interface PRMetrics {
  averageOpenDays: number;
  totalPRs: number;
  mergedPRs: number;
  closedPRs: number;
  openPRs: number;
  averageComments: number;
  most_commented_prs: MostCommentedPRData[];
  leadTime: number;
  commentSummary: CommentAuthor[];
  labelSummary: LabelSummary[];
  outliers?: {
    openDays: PRAverageOutlier[];
    comments: PRAverageOutlier[];
  };
}

export interface PRSummaryPullRequest {
  number: number;
  title: string;
  author: string;
  created: string;
  merged?: string;
  closed?: string;
}

export interface PRSummaryMostCommentedPullRequest {
  number: number;
  title: string;
  author: string;
  comments: number;
}

export interface PRSummaryLabel {
  label: string;
  prs: number;
}

export interface PRSummaryTheme {
  text: string;
  value: number;
}

export interface PRSummaryTopCommenter {
  login: string;
  comments: number;
}

export interface PRSummaryFirstCommentTime {
  average: number;
  median: number;
  min: number;
  max: number;
  prs_with_comment: number;
  prs_without_comment: number;
}

export interface PRSummary {
  total_prs: number;
  merged_prs: number;
  closed_prs: number;
  prs_without_conclusion: number;
  open_prs: number;
  avg_comments_per_pr: number;
  unique_authors: number;
  unique_labels: number;
  labels: PRSummaryLabel[];
  first_pr: PRSummaryPullRequest | null;
  last_pr: PRSummaryPullRequest | null;
  top_themes: PRSummaryTheme[];
  most_commented_pr: PRSummaryMostCommentedPullRequest | null;
  most_commented_prs: MostCommentedPRData[];
  top_commenter: PRSummaryTopCommenter | null;
  time_to_first_comment_hours: PRSummaryFirstCommentTime;
}

export interface PRSummaryResponse {
  result: PRSummary;
}

export interface CommentAuthor {
  author: string;
  count: number;
}

export interface FirstCommentMetric {
  author: string;
  avg_hours: number;
  prs_with_comments: number;
  outliers?: PRAverageOutlier[];
}

export interface MostCommentedPRData {
  pull_request_id: number;
  pull_request_title: string;
  pull_request_url: string;
  comments_count: number;
}

export interface PRsByTimeframe {
  period: string;
  count: number;
  averageOpenDays: number;
  averageComments: number;
  outliers?: {
    openDays: PRAverageOutlier[];
    comments: PRAverageOutlier[];
  };
}

export interface LabelSummary {
  label: string;
  count: number;
  averageOpenDays: number;
  outliers?: PRAverageOutlier[];
}
