import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  parseMetricCleaningOptions,
  ChangeRequestsService,
  ChangeRequestDetails,
  ChangeRequestFiltersRepository,
  ChangeRequestFilters,
} from '@smmachine/core';
import type {
  ChangeRequestSummaryResponse,
  ChangeRequestThroughTimeResponse,
  ChangeRequestByAuthorResponse,
  ChangeRequestAverageReviewTimeResponse,
  ChangeRequestAverageOpenByResponse,
  ChangeRequestAverageCommentsResponse,
  ChangeRequestCommentsByAuthorResponse,
  ChangeRequestFirstCommentTimeResponse,
  ChangeRequestFilterOptionsResponse,
} from '../dtos/response.dto';
import { normalizeMetricMethod } from '../utils/metric-method';
import { formatDuration } from '@smmachine/utils';

@ApiTags('Change Request Metrics')
@Controller()
export class ChangeRequestsController {
  constructor(
    private readonly changeRequestsService: ChangeRequestsService,
    private readonly changeRequestFiltersRepository: ChangeRequestFiltersRepository
  ) {}

  @Get('/change-requests/summary')
  async summary(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('authors') authors?: string,
    @Query('exclude_authors') excludeAuthors?: string,
    @Query('exclude_commenters') excludeCommenters?: string,
    @Query('labels') labels?: string,
    @Query('status') status?: ChangeRequestDetails['state'],
    @Query('weekends') weekends?: string,
    @Query('outlier_mode') outlierMode?: string
  ): Promise<ChangeRequestSummaryResponse> {
    return this.changeRequestsService.getSummary(
      this.toFilters(
        startDate,
        endDate,
        authors,
        excludeAuthors,
        excludeCommenters,
        labels,
        status,
        weekends,
        outlierMode
      )
    ) as Promise<ChangeRequestSummaryResponse>;
  }

  @Get('/change-requests/through-time')
  async throughTime(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('aggregate_by') aggregateBy?: string,
    @Query('authors') authors?: string,
    @Query('exclude_authors') excludeAuthors?: string,
    @Query('exclude_commenters') excludeCommenters?: string,
    @Query('labels') labels?: string,
    @Query('status') status?: ChangeRequestDetails['state'],
    @Query('weekends') weekends?: string,
    @Query('outlier_mode') outlierMode?: string
  ): Promise<ChangeRequestThroughTimeResponse> {
    const rows = await this.changeRequestsService.getThroughTime(
      this.toFilters(
        startDate,
        endDate,
        authors,
        excludeAuthors,
        excludeCommenters,
        labels,
        status,
        weekends,
        outlierMode
      ),
      aggregateBy
    );
    return { result: rows };
  }

  @Get('/change-requests/by-author')
  async byAuthor(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('labels') labels?: string,
    @Query('top') top?: string,
    @Query('authors') authors?: string,
    @Query('exclude_authors') excludeAuthors?: string,
    @Query('exclude_commenters') excludeCommenters?: string,
    @Query('status') status?: ChangeRequestDetails['state'],
    @Query('weekends') weekends?: string,
    @Query('outlier_mode') outlierMode?: string
  ): Promise<ChangeRequestByAuthorResponse> {
    const maxRows = top ? Number(top) : 10;
    const result = await this.changeRequestsService.getByAuthor(
      this.toFilters(
        startDate,
        endDate,
        authors,
        excludeAuthors,
        excludeCommenters,
        labels,
        status,
        weekends,
        outlierMode
      ),
      Number.isFinite(maxRows) ? maxRows : 10
    );

    return { result };
  }

  @Get('/change-requests/average-review-time')
  async averageReviewTime(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('labels') labels?: string,
    @Query('top') top?: string,
    @Query('authors') authors?: string,
    @Query('exclude_authors') excludeAuthors?: string,
    @Query('exclude_commenters') excludeCommenters?: string,
    @Query('status') status?: ChangeRequestDetails['state'],
    @Query('weekends') weekends?: string,
    @Query('outlier_mode') outlierMode?: string,
    @Query('method') methodRaw?: string
  ): Promise<ChangeRequestAverageReviewTimeResponse> {
    const maxRows = top ? Number(top) : 10;
    const method = normalizeMetricMethod(methodRaw);
    const result = await this.changeRequestsService.getReviewTime(
      this.toFilters(
        startDate,
        endDate,
        authors,
        excludeAuthors,
        excludeCommenters,
        labels,
        status,
        weekends,
        outlierMode
      ),
      Number.isFinite(maxRows) ? maxRows : 10,
      method
    );

    return {
      result: result.map((item) => ({
        author: item.author,
        value: item.value,
        value_formatted: formatDuration(item.value, 'days'),
        method: item.method,
        outliers: item.outliers,
      })),
    };
  }

  @Get('/change-requests/average-open-by')
  async averageOpenBy(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('aggregate_by') aggregateBy?: string,
    @Query('labels') labels?: string,
    @Query('authors') authors?: string,
    @Query('exclude_authors') excludeAuthors?: string,
    @Query('exclude_commenters') excludeCommenters?: string,
    @Query('status') status?: ChangeRequestDetails['state'],
    @Query('weekends') weekends?: string,
    @Query('outlier_mode') outlierMode?: string,
    @Query('method') methodRaw?: string
  ): Promise<ChangeRequestAverageOpenByResponse> {
    const method = normalizeMetricMethod(methodRaw);
    const rows = await this.changeRequestsService.getOpenTimeBy(
      this.toFilters(
        startDate,
        endDate,
        authors,
        excludeAuthors,
        excludeCommenters,
        labels,
        status,
        weekends,
        outlierMode
      ),
      aggregateBy,
      method
    );

    return rows.map((row) => ({
      period: row.period,
      value: row.value,
      value_formatted: formatDuration(row.value, 'days'),
      method: row.method,
      outliers: row.outliers,
    }));
  }

  @Get('/change-requests/average-comments')
  async averageComments(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('labels') labels?: string,
    @Query('authors') authors?: string,
    @Query('exclude_authors') excludeAuthors?: string,
    @Query('exclude_commenters') excludeCommenters?: string,
    @Query('status') status?: ChangeRequestDetails['state'],
    @Query('weekends') weekends?: string,
    @Query('outlier_mode') outlierMode?: string,
    @Query('method') methodRaw?: string
  ): Promise<ChangeRequestAverageCommentsResponse> {
    const method = normalizeMetricMethod(methodRaw);
    const metrics = await this.changeRequestsService.getMetrics(
      this.toFilters(
        startDate,
        endDate,
        authors,
        excludeAuthors,
        excludeCommenters,
        labels,
        status,
        weekends,
        outlierMode
      ),
      method
    );
    return { avg_comments: metrics.comments, outliers: metrics.outliers?.comments };
  }

  @Get('/change-requests/comments-by-author')
  async commentsByAuthor(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('labels') labels?: string,
    @Query('top') top?: string,
    @Query('authors') authors?: string,
    @Query('exclude_authors') excludeAuthors?: string,
    @Query('exclude_commenters') excludeCommenters?: string,
    @Query('status') status?: ChangeRequestDetails['state'],
    @Query('weekends') weekends?: string,
    @Query('outlier_mode') outlierMode?: string
  ): Promise<ChangeRequestCommentsByAuthorResponse> {
    const maxRows = top ? Number(top) : 10;
    const result = await this.changeRequestsService.getCommentsByAuthor(
      this.toFilters(
        startDate,
        endDate,
        authors,
        excludeAuthors,
        excludeCommenters,
        labels,
        status,
        weekends,
        outlierMode
      ),
      Number.isFinite(maxRows) ? maxRows : 10
    );

    return { result };
  }

  @Get('/change-requests/first-comment-time')
  async firstCommentTime(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('labels') labels?: string,
    @Query('top') top?: string,
    @Query('authors') authors?: string,
    @Query('exclude_authors') excludeAuthors?: string,
    @Query('exclude_commenters') excludeCommenters?: string,
    @Query('status') status?: ChangeRequestDetails['state'],
    @Query('weekends') weekends?: string,
    @Query('outlier_mode') outlierMode?: string,
    @Query('method') methodRaw?: string
  ): Promise<ChangeRequestFirstCommentTimeResponse> {
    const maxRows = top ? Number(top) : 10;
    const method = normalizeMetricMethod(methodRaw);
    const result = await this.changeRequestsService.getFirstCommentTime(
      this.toFilters(
        startDate,
        endDate,
        authors,
        excludeAuthors,
        excludeCommenters,
        labels,
        status,
        weekends,
        outlierMode
      ),
      Number.isFinite(maxRows) ? maxRows : 10,
      method
    );

    return {
      result: result.map((item) => ({
        author: item.author,
        value: item.value,
        value_formatted: formatDuration(item.value, 'hours'),
        method: item.method,
        change_requests_with_comments: item.change_requests_with_comments,
        outliers: item.outliers,
      })),
    };
  }

  @Get('/change-requests/filter-options')
  async filterOptions(): Promise<ChangeRequestFilterOptionsResponse> {
    return this.changeRequestFiltersRepository.loadOptions();
  }

  private toFilters(
    startDate?: string,
    endDate?: string,
    authors?: string,
    excludeAuthors?: string,
    excludeCommenters?: string,
    labels?: string,
    status?: ChangeRequestDetails['state'],
    weekends?: string,
    outlierMode?: string
  ): ChangeRequestFilters {
    return {
      startDate,
      endDate,
      authors,
      excludeAuthors,
      excludeCommenters,
      labels,
      state: status,
      cleaning: parseMetricCleaningOptions({ weekends, outlierMode }),
    };
  }
}
