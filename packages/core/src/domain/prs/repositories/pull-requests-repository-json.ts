import { IRepository } from '../../../infrastructure';
import { TimeZoneProvider } from '../../../infrastructure/timezone-provider';
import { PRDetails, PRFilters } from '../pr-types';
import { shouldIncludeTimestampForWeekendsMode } from '../../metric-samples';
import { ParseRawFiltersRepository, RawFilter } from '../../../infrastructure/parse-raw-filters-repository';
import {
  PullRequestCommentJsonResponse,
  PullRequestJsonResponse,
  PullRequestLabelJsonResponse,
} from '../../../providers/github/github-response-types';

export interface IReadPullRequestsRepository {
  loadPrsWithFilters(filters?: PRFilters): Promise<PRDetails[]>;
}

export class PullRequestsRepository
  extends ParseRawFiltersRepository
  implements IReadPullRequestsRepository
{
  constructor(
    private pullRequestsJsonRepository: IRepository<PullRequestJsonResponse>,
    private pullRequestCommentsJsonRepository: IRepository<PullRequestCommentJsonResponse>,
    private timeZoneProvider: TimeZoneProvider
  ) {
    super();
  }

  async loadPrsWithFilters(filters?: PRFilters): Promise<PRDetails[]> {
    const fromCache = await this.pullRequestsJsonRepository.loadAll();
    const allComments = await this.pullRequestCommentsJsonRepository.loadAll();

    let rawPrs = fromCache;

    if (filters) {
      const start = filters.startDate
        ? this.timeZoneProvider.getStartOfDayBoundary(filters.startDate)
        : null;
      const end = filters.endDate
        ? this.timeZoneProvider.getEndOfDayBoundary(filters.endDate)
        : null;
      const authors = this.normalizeList(filters.authors);
      const excludeAuthors = this.normalizeList(filters.excludeAuthors);
      const labels = this.normalizeList(filters.labels);
      const authorSet = authors.length ? new Set(authors.map((a) => a.toLowerCase())) : null;
      const excludeAuthorSet = excludeAuthors.length
        ? new Set(excludeAuthors.map((a) => a.toLowerCase()))
        : null;
      const labelSet = labels.length ? new Set(labels.map((l) => l.toLowerCase())) : null;

      rawPrs = rawPrs.filter((pr) => {
        if (start || end) {
          const created = new Date(pr.created_at);
          if (start && created < start) return false;
          if (end && created > end) return false;
        }

        if (
          !shouldIncludeTimestampForWeekendsMode(
            this.getPRMetricDate(pr),
            filters.cleaning?.weekends,
            (dateString) => this.isWeekday(dateString)
          )
        ) {
          return false;
        }

        if (authorSet && !authorSet.has((pr.user?.login || 'unknown').toLowerCase())) {
          return false;
        }

        if (excludeAuthorSet && excludeAuthorSet.has((pr.user?.login || 'unknown').toLowerCase())) {
          return false;
        }

        if (labelSet && !(pr.labels || []).some((l) => labelSet.has(l.name.toLowerCase()))) {
          return false;
        }

        if (filters.state) {
          if (filters.state === 'merged' && !pr.merged_at) return false;
          if (filters.state === 'closed' && (!pr.closed_at || pr.merged_at)) return false;
          if (filters.state === 'open' && (pr.closed_at || pr.merged_at)) return false;
          if (
            filters.state === 'draft' &&
            !(pr as PullRequestJsonResponse & { draft?: boolean }).draft
          )
            return false;
        }

        return true;
      });
    }

    const excludeCommenters = this.normalizeList(filters?.excludeCommenters);
    const excludeCommenterSet = excludeCommenters.length
      ? new Set(excludeCommenters.map((commenter) => commenter.toLowerCase()))
      : null;

    const mappedPrs = rawPrs.map((pr: PullRequestJsonResponse) => {
      const commentsForPr = allComments
        .filter((comment) => comment.pull_request_url.includes(`/pulls/${pr.number}`))
        .filter(
          (comment) =>
            !excludeCommenterSet ||
            !excludeCommenterSet.has((comment.user?.login || 'unknown').toLowerCase())
        );

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
    });

    return this.applyRawFilters(mappedPrs, this.parseRawFilters(filters?.rawFilters));
  }

  private getPRMetricDate(pr: PullRequestJsonResponse): string {
    return pr.merged_at || pr.closed_at || pr.created_at;
  }

  private isWeekday(dateString?: string): boolean {
    if (!dateString) {
      return true;
    }

    const dateKey = this.timeZoneProvider.getDateKey(dateString);
    const [year, month, day] = dateKey.split('-').map(Number);
    const timezoneDay = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
    return timezoneDay >= 1 && timezoneDay <= 5;
  }

  private normalizeList(value?: string | string[]): string[] {
    if (!value) {
      return [];
    }

    const values = Array.isArray(value) ? value : [value];
    return values
      .flatMap((item) => String(item).split(','))
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private applyRawFilters(prs: PRDetails[], rawFilters: RawFilter[]): PRDetails[] {
    if (rawFilters.length === 0) {
      return prs;
    }

    return prs.filter((pr) => this.matchesRawFilters(pr, rawFilters));
  }
}
