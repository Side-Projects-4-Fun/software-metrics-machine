import { ApiParams, fetchAPI } from './client';

type MetricOutlier = {
  value: number;
  timestamp: string;
  lowerBound: number;
  upperBound: number;
  item: Record<string, unknown>;
};

export const pullRequestAPI = {
  // Data endpoints
  summary: (params?: ApiParams) =>
    fetchAPI<{
      total: number;
      merged: number;
      closed: number;
      open: number;
      first_pr: { created?: string; createdAt?: string; created_at?: string } | string | null;
      last_pr: { created?: string; createdAt?: string; created_at?: string } | string | null;
      top_themes: Array<{ text: string; value: number }>;
      labels: Array<{ label: string; prs: number }>;
    }>('/pull-requests/summary', params),
  
  byAuthor: (params?: ApiParams) =>
    fetchAPI<Array<{ author: string; count: number }>>(
      '/pull-requests/by-author',
      params
    ),
  
  averageReviewTime: (params?: ApiParams) =>
    fetchAPI<Array<{ author: string; avg_days?: number; avg_hours?: number; outliers?: MetricOutlier[] }>>(
      '/pull-requests/average-review-time',
      params
    ),
  
  openThroughTime: (params?: ApiParams) =>
    fetchAPI<Array<{ date: string; kind?: 'Opened' | 'Closed'; count?: number; open_prs?: number }>>(
      '/pull-requests/through-time',
      params
    ),
  
  averageOpenBy: (params?: ApiParams) =>
    fetchAPI<Array<{ period: string; avg_days: number; outliers?: MetricOutlier[] }>>(
      '/pull-requests/average-open-by',
      params
    ),
  
  averageComments: (params?: ApiParams) =>
    fetchAPI<{ avg_comments: number; outliers?: MetricOutlier[] }>('/pull-requests/average-comments', params),

  commentsByAuthor: (params?: ApiParams) =>
    fetchAPI<Array<{ author: string; count: number }>>('/pull-requests/comments-by-author', params),

  firstCommentTime: (params?: ApiParams) =>
    fetchAPI<Array<{ author: string; avg_hours: number; prs_with_comments: number; outliers?: MetricOutlier[] }>>(
      '/pull-requests/first-comment-time',
      params
    ),

  // Filter option endpoints
  getFilterOptions: () =>
    fetchAPI<{
      authors: string[];
      commenters: string[];
      labels: string[];
    }>('/pull-requests/filter-options'),
};
