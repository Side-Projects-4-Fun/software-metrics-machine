import type { CommentAuthor, FirstCommentMetric, PRSummary, PRAverageOutlier } from './pr-types';
import type { MetricMethod } from '../metric-samples';

export type PRBottleneckSeverity = 'critical' | 'warning' | 'good';
export type PRBottleneckCategory = 'review' | 'throughput' | 'collaboration';

export interface PRBottleneckSignal {
  id: string;
  title: string;
  description: string;
  severity: PRBottleneckSeverity;
  category: PRBottleneckCategory;
  metrics: Array<{
    label: string;
    value: string;
  }>;
}

export interface PROpenTimeItem {
  period: string;
  avg_days: number;
  method: MetricMethod;
  outliers?: PRAverageOutlier[];
}

export interface PRDashboardData {
  summary: PRSummary | null;
  reviewTime: Array<{ author: string; avg_days?: number; avg_hours?: number }>;
  openTime: PROpenTimeItem[];
  byAuthor: Array<{ author: string; count: number }>;
  commentsByAuthor: CommentAuthor[];
  firstCommentTime: FirstCommentMetric[];
  throughput: Array<{ period: string; opened: number; closed: number }>;
}

export interface PREvaluation {
  generatedAt: string;
  signals: PRBottleneckSignal[];
  summary: {
    totalPRs: number;
    mergedPRs: number;
    openPRs: number;
    avgCommentsPerPR: number;
    avgReviewHours: number;
    avgOpenDays: number;
    uniqueAuthors: number;
    topReviewer?: string;
    bottleneckAuthor?: string;
  };
}
