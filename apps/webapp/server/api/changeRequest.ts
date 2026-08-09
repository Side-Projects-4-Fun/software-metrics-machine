import { ApiParams, fetchAPI } from './client';

type MetricOutlier = {
  value: number;
  timestamp: string;
  lowerBound: number;
  upperBound: number;
  item: Record<string, unknown>;
};

export const changeRequestAPI = {
  // Data endpoints
  summary: (params?: ApiParams) =>
    fetchAPI<{
      total: number;
      merged: number;
      closed: number;
      open: number;
      first_change_request: { created?: string; createdAt?: string; created_at?: string } | string | null;
      last_change_request: { created?: string; createdAt?: string; created_at?: string } | string | null;
      top_themes: Array<{ text: string; value: number }>;
      labels: Array<{ label: string; change_requests: number }>;
    }>('/change-requests/summary', params),
  
  byAuthor: (params?: ApiParams) =>
    fetchAPI<Array<{ author: string; count: number }>>(
      '/change-requests/by-author',
      params
    ),
  
  reviewTime: (params?: ApiParams) =>
    fetchAPI<Array<{ author: string; value?: number; value_formatted?: string; method?: string; outliers?: MetricOutlier[] }>>(
      '/change-requests/review-time',
      params
    ),

  openThroughTime: (params?: ApiParams) =>
    fetchAPI<Array<{ date: string; kind?: 'Opened' | 'Closed'; count?: number; open_change_requests?: number }>>(
      '/change-requests/through-time',
      params
    ),

  openTime: (params?: ApiParams) =>
    fetchAPI<Array<{ period: string; value: number; value_formatted: string; method: string; outliers?: MetricOutlier[] }>>(
      '/change-requests/open-time',
      params
    ),

  comments: (params?: ApiParams) =>
    fetchAPI<{ comments_count: number; outliers?: MetricOutlier[] }>('/change-requests/comments', params),

  commentsByAuthor: (params?: ApiParams) =>
    fetchAPI<Array<{ author: string; count: number }>>('/change-requests/comments-by-author', params),

  firstCommentTime: (params?: ApiParams) =>
    fetchAPI<Array<{ author: string; value: number; value_formatted: string; method: string; change_requests_with_comments: number; outliers?: MetricOutlier[] }>>(
      '/change-requests/first-comment-time',
      params
    ),

  // Filter option endpoints
  getFilterOptions: () =>
    fetchAPI<{
      authors: string[];
      commenters: string[];
      labels: string[];
    }>('/change-requests/filter-options'),

  evaluate: (params?: ApiParams) =>
    fetchAPI<{
      generatedAt: string;
      signals: Array<{
        id: string;
        title: string;
        description: string;
        severity: 'critical' | 'warning' | 'good';
        category: string;
        metrics: Array<{ label: string; value: string }>;
      }>;
      summary: {
        totalChangeRequests: number;
        mergedChangeRequests: number;
        openChangeRequests: number;
        commentsPerChangeRequest: number;
        reviewHours: number;
        reviewHours_formatted: string;
        openDays: number;
        openDays_formatted: string;
        method: string;
        uniqueAuthors: number;
        topReviewer?: string;
        bottleneckAuthor?: string;
      };
    }>('/change-requests/evaluate', params),
};