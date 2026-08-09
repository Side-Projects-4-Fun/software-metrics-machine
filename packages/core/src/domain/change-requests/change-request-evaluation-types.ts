import type {
  CommentAuthor,
  FirstCommentMetric,
  ChangeRequestSummary,
  ChangeRequestAverageOutlier,
} from './change-request-types';
import type { MetricMethod } from '../metric-samples';

export type ChangeRequestBottleneckSeverity = 'critical' | 'warning' | 'good';
export type ChangeRequestBottleneckCategory = 'review' | 'throughput' | 'collaboration';

export interface ChangeRequestBottleneckSignal {
  id: string;
  title: string;
  description: string;
  severity: ChangeRequestBottleneckSeverity;
  category: ChangeRequestBottleneckCategory;
  metrics: Array<{
    label: string;
    value: string;
  }>;
}

export interface ChangeRequestOpenTimeItem {
  period: string;
  value: number;
  method: MetricMethod;
  outliers?: ChangeRequestAverageOutlier[];
}

export interface ChangeRequestDashboardData {
  summary: ChangeRequestSummary | null;
  reviewTime: Array<{ author: string; value?: number; method?: MetricMethod }>;
  openTime: ChangeRequestOpenTimeItem[];
  byAuthor: Array<{ author: string; count: number }>;
  commentsByAuthor: CommentAuthor[];
  firstCommentTime: FirstCommentMetric[];
  throughput: Array<{ period: string; opened: number; closed: number }>;
}

export interface ChangeRequestEvaluation {
  generatedAt: string;
  signals: ChangeRequestBottleneckSignal[];
  summary: {
    totalChangeRequests: number;
    mergedChangeRequests: number;
    openChangeRequests: number;
    avgCommentsPerChangeRequest: number;
    reviewHours: number;
    openDays: number;
    method: MetricMethod;
    uniqueAuthors: number;
    topReviewer?: string;
    bottleneckAuthor?: string;
  };
}
