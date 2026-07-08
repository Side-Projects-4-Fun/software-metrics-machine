import { TimeZoneProvider } from '../../../infrastructure/timezone-provider';
import { shouldIncludeTimestampForWeekendsMode } from '../../metric-samples';
import { PRDetails, PRFilters } from '../pr-types';
import {
  PullRequestCommentJsonResponse,
  PullRequestJsonResponse,
  PullRequestLabelJsonResponse,
} from '../../../providers/github/github-response-types';

export function mapPullRequestToDetails(
  pr: PullRequestJsonResponse,
  commentsForPr: PullRequestCommentJsonResponse[]
): PRDetails {
  return {
    id: Number(pr.id),
    number: Number(pr.number),
    title: pr.title,
    description: pr.body || '',
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    mergedAt: pr.merged_at || undefined,
    closedAt: pr.closed_at || undefined,
    author: {
      login: pr.user?.login || 'unknown',
      id: pr.user?.id || 0,
    },
    labels: (pr.labels || []).map((label: PullRequestLabelJsonResponse) => ({ ...label })),
    state: pr.state as PRDetails['state'],
    url: pr.html_url || '',
    totalComments: commentsForPr.length,
    comments: commentsForPr.map((comment) => ({
      url: comment.url,
      body: comment.body,
      pull_request_review_id: comment.pull_request_review_id || 0,
      id: comment.id,
      createdAt: comment.created_at,
      author: {
        login: comment.user?.login || 'unknown',
        id: comment.user?.id || 0,
      },
      reactions: {
        url: comment.reactions?.url || '',
        total_count: comment.reactions?.total_count || 0,
        '+1': comment.reactions?.['+1'] || 0,
        '-1': comment.reactions?.['-1'] || 0,
        laugh: comment.reactions?.laugh || 0,
        hooray: comment.reactions?.hooray || 0,
        confused: comment.reactions?.confused || 0,
        heart: comment.reactions?.heart || 0,
        rocket: comment.reactions?.rocket || 0,
        eyes: comment.reactions?.eyes || 0,
      },
    })),
  };
}

export function normalizePrFilterList(value?: string | string[]): string[] {
  if (!value) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function applyPayloadPrFilters(
  prs: PullRequestJsonResponse[],
  filters: PRFilters | undefined,
  timeZoneProvider: TimeZoneProvider
): PullRequestJsonResponse[] {
  if (!filters) {
    return prs;
  }

  const labels = normalizePrFilterList(filters.labels);
  const labelSet = labels.length ? new Set(labels.map((label) => label.toLowerCase())) : null;

  return prs.filter((pr) => {
    if (
      !shouldIncludeTimestampForWeekendsMode(
        getPullRequestMetricDate(pr),
        filters.cleaning?.weekends,
        (dateString) => isPullRequestWeekday(dateString, timeZoneProvider)
      )
    ) {
      return false;
    }

    if (labelSet && !(pr.labels || []).some((label) => labelSet.has(label.name.toLowerCase()))) {
      return false;
    }

    if (filters.state === 'draft' && !(pr as PullRequestJsonResponse & { draft?: boolean }).draft) {
      return false;
    }

    return true;
  });
}

export function getPullRequestMetricDate(pr: PullRequestJsonResponse): string {
  return pr.merged_at || pr.closed_at || pr.created_at;
}

function isPullRequestWeekday(
  dateString: string | undefined,
  timeZoneProvider: TimeZoneProvider
): boolean {
  if (!dateString) {
    return true;
  }

  const dateKey = timeZoneProvider.getDateKey(dateString);
  const [year, month, day] = dateKey.split('-').map(Number);
  const timezoneDay = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
  return timezoneDay >= 1 && timezoneDay <= 5;
}
