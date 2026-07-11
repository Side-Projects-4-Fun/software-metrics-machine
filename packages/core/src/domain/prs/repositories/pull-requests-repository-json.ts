import { IRepository } from '../../../infrastructure';
import { TimeZoneProvider } from '../../../infrastructure/timezone-provider';
import { PRDetails, PRFilters } from '../pr-types';
import {
  ParseRawFiltersRepository,
  RawFilter,
} from '../../../infrastructure/parse-raw-filters-repository';
import {
  PullRequestCommentJsonResponse,
  PullRequestJsonResponse,
} from '../../../providers/github/github-response-types';
import {
  applyPayloadPrFilters,
  mapPullRequestToDetails,
  normalizePrFilterList,
} from './pull-request-mapper';

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
      const authors = normalizePrFilterList(filters.authors);
      const excludeAuthors = normalizePrFilterList(filters.excludeAuthors);
      const authorSet = authors.length ? new Set(authors.map((a) => a.toLowerCase())) : null;
      const excludeAuthorSet = excludeAuthors.length
        ? new Set(excludeAuthors.map((a) => a.toLowerCase()))
        : null;

      rawPrs = rawPrs.filter((pr) => {
        if (start || end) {
          const created = new Date(pr.created_at);
          if (start && created < start) return false;
          if (end && created > end) return false;
        }

        if (authorSet && !authorSet.has((pr.user?.login || 'unknown').toLowerCase())) {
          return false;
        }

        if (excludeAuthorSet && excludeAuthorSet.has((pr.user?.login || 'unknown').toLowerCase())) {
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

      rawPrs = applyPayloadPrFilters(rawPrs, filters, this.timeZoneProvider);
    }

    const excludeCommenters = normalizePrFilterList(filters?.excludeCommenters);
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

      return mapPullRequestToDetails(pr, commentsForPr);
    });

    return this.applyRawFilters(mappedPrs, this.parseRawFilters(filters?.rawFilters));
  }

  private applyRawFilters(prs: PRDetails[], rawFilters: RawFilter[]): PRDetails[] {
    if (rawFilters.length === 0) {
      return prs;
    }

    return prs.filter((pr) => this.matchesRawFilters(pr, rawFilters));
  }
}
