import type { IRepository } from '../../../infrastructure';
import type { TimeZoneProvider } from '../../../infrastructure/timezone-provider';
import type { ChangeRequestDetails, ChangeRequestFilters } from '../change-request-types';
import type { RawFilter } from '../../../infrastructure/parse-raw-filters-repository';
import { ParseRawFiltersRepository } from '../../../infrastructure/parse-raw-filters-repository';
import type {
  PullRequestCommentJsonResponse,
  PullRequestJsonResponse,
} from '../../../providers/github/github-response-types';
import {
  applyPayloadChangeRequestFilters,
  mapChangeRequestToDetails,
  normalizeChangeRequestFilterList,
} from './change-request-mapper';

export interface IReadChangeRequestsRepository {
  loadChangeRequestsWithFilters(filters?: ChangeRequestFilters): Promise<ChangeRequestDetails[]>;
}

export class ChangeRequestsRepository
  extends ParseRawFiltersRepository
  implements IReadChangeRequestsRepository
{
  constructor(
    private changeRequestsJsonRepository: IRepository<PullRequestJsonResponse>,
    private changeRequestCommentsJsonRepository: IRepository<PullRequestCommentJsonResponse>,
    private timeZoneProvider: TimeZoneProvider
  ) {
    super();
  }

  async loadChangeRequestsWithFilters(
    filters?: ChangeRequestFilters
  ): Promise<ChangeRequestDetails[]> {
    const fromCache = await this.changeRequestsJsonRepository.loadAll();
    const allComments = await this.changeRequestCommentsJsonRepository.loadAll();

    let rawChangeRequests = fromCache;

    if (filters) {
      const start = filters.startDate
        ? this.timeZoneProvider.getStartOfDayBoundary(filters.startDate)
        : null;
      const end = filters.endDate
        ? this.timeZoneProvider.getEndOfDayBoundary(filters.endDate)
        : null;
      const authors = normalizeChangeRequestFilterList(filters.authors);
      const excludeAuthors = normalizeChangeRequestFilterList(filters.excludeAuthors);
      const authorSet = authors.length ? new Set(authors.map((a) => a.toLowerCase())) : null;
      const excludeAuthorSet = excludeAuthors.length
        ? new Set(excludeAuthors.map((a) => a.toLowerCase()))
        : null;

      rawChangeRequests = rawChangeRequests.filter((changeRequest) => {
        if (start || end) {
          const created = new Date(changeRequest.created_at);
          if (start && created < start) return false;
          if (end && created > end) return false;
        }

        if (authorSet && !authorSet.has((changeRequest.user?.login || 'unknown').toLowerCase())) {
          return false;
        }

        if (
          excludeAuthorSet &&
          excludeAuthorSet.has((changeRequest.user?.login || 'unknown').toLowerCase())
        ) {
          return false;
        }

        if (filters.state) {
          if (filters.state === 'merged' && !changeRequest.merged_at) return false;
          if (filters.state === 'closed' && (!changeRequest.closed_at || changeRequest.merged_at))
            return false;
          if (filters.state === 'open' && (changeRequest.closed_at || changeRequest.merged_at))
            return false;
          if (
            filters.state === 'draft' &&
            !(changeRequest as PullRequestJsonResponse & { draft?: boolean }).draft
          )
            return false;
        }

        return true;
      });

      rawChangeRequests = applyPayloadChangeRequestFilters(
        rawChangeRequests,
        filters,
        this.timeZoneProvider
      );
    }

    const excludeCommenters = normalizeChangeRequestFilterList(filters?.excludeCommenters);
    const excludeCommenterSet = excludeCommenters.length
      ? new Set(excludeCommenters.map((commenter) => commenter.toLowerCase()))
      : null;

    const mappedChangeRequests = rawChangeRequests.map((changeRequest: PullRequestJsonResponse) => {
      const commentsForChangeRequest = allComments
        .filter((comment) => comment.pull_request_url.includes(`/pulls/${changeRequest.number}`))
        .filter(
          (comment) =>
            !excludeCommenterSet ||
            !excludeCommenterSet.has((comment.user?.login || 'unknown').toLowerCase())
        );

      return mapChangeRequestToDetails(changeRequest, commentsForChangeRequest);
    });

    return this.applyRawFilters(mappedChangeRequests, this.parseRawFilters(filters?.rawFilters));
  }

  private applyRawFilters(
    changeRequests: ChangeRequestDetails[],
    rawFilters: RawFilter[]
  ): ChangeRequestDetails[] {
    if (rawFilters.length === 0) {
      return changeRequests;
    }

    return changeRequests.filter((changeRequest) =>
      this.matchesRawFilters(changeRequest, rawFilters)
    );
  }
}
