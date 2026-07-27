import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { MetricMethod } from '@smmachine/core';
import {
  parseMetricCleaningOptions,
  PRsService,
  PRDetails,
  PullRequestFiltersRepository,
  PRFilters,
} from '@smmachine/core';
import type {
  PRSummaryResponse,
  PRThroughTimeResponse,
  PRByAuthorResponse,
  PRAverageReviewTimeResponse,
  PRAverageOpenByResponse,
  PRAverageCommentsResponse,
  PRCommentsByAuthorResponse,
  PRFirstCommentTimeResponse,
  PRFilterOptionsResponse,
} from '../dtos/response.dto';

const VALID_METRIC_METHODS: MetricMethod[] = [
  'average',
  'median',
  'p75',
  'p90',
  'p95',
  'min',
  'max',
];

function normalizeMetricMethod(value?: string): MetricMethod {
  const normalized = (value || 'average').toLowerCase();
  return VALID_METRIC_METHODS.includes(normalized as MetricMethod)
    ? (normalized as MetricMethod)
    : 'average';
}

@ApiTags('Pull Request Metrics')
@Controller()
export class PullRequestsController {
  constructor(
    private readonly prsService: PRsService,
    private readonly pullRequestFiltersRepository: PullRequestFiltersRepository
  ) {}

  @Get('/pull-requests/summary')
  async summary(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('authors') authors?: string,
    @Query('exclude_authors') excludeAuthors?: string,
    @Query('exclude_commenters') excludeCommenters?: string,
    @Query('labels') labels?: string,
    @Query('status') status?: PRDetails['state'],
    @Query('weekends') weekends?: string,
    @Query('outlier_mode') outlierMode?: string
  ): Promise<PRSummaryResponse> {
    return this.prsService.getSummary(
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
    ) as Promise<PRSummaryResponse>;
  }

  @Get('/pull-requests/through-time')
  async throughTime(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('aggregate_by') aggregateBy?: string,
    @Query('authors') authors?: string,
    @Query('exclude_authors') excludeAuthors?: string,
    @Query('exclude_commenters') excludeCommenters?: string,
    @Query('labels') labels?: string,
    @Query('status') status?: PRDetails['state'],
    @Query('weekends') weekends?: string,
    @Query('outlier_mode') outlierMode?: string
  ): Promise<PRThroughTimeResponse> {
    const rows = await this.prsService.getThroughTime(
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

  @Get('/pull-requests/by-author')
  async byAuthor(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('labels') labels?: string,
    @Query('top') top?: string,
    @Query('authors') authors?: string,
    @Query('exclude_authors') excludeAuthors?: string,
    @Query('exclude_commenters') excludeCommenters?: string,
    @Query('status') status?: PRDetails['state'],
    @Query('weekends') weekends?: string,
    @Query('outlier_mode') outlierMode?: string
  ): Promise<PRByAuthorResponse> {
    const maxRows = top ? Number(top) : 10;
    const result = await this.prsService.getByAuthor(
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

  @Get('/pull-requests/average-review-time')
  async averageReviewTime(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('labels') labels?: string,
    @Query('top') top?: string,
    @Query('authors') authors?: string,
    @Query('exclude_authors') excludeAuthors?: string,
    @Query('exclude_commenters') excludeCommenters?: string,
    @Query('status') status?: PRDetails['state'],
    @Query('weekends') weekends?: string,
    @Query('outlier_mode') outlierMode?: string,
    @Query('method') methodRaw?: string
  ): Promise<PRAverageReviewTimeResponse> {
    const maxRows = top ? Number(top) : 10;
    const method = normalizeMetricMethod(methodRaw);
    const result = await this.prsService.getReviewTime(
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

    return { result };
  }

  @Get('/pull-requests/average-open-by')
  async averageOpenBy(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('aggregate_by') aggregateBy?: string,
    @Query('labels') labels?: string,
    @Query('authors') authors?: string,
    @Query('exclude_authors') excludeAuthors?: string,
    @Query('exclude_commenters') excludeCommenters?: string,
    @Query('status') status?: PRDetails['state'],
    @Query('weekends') weekends?: string,
    @Query('outlier_mode') outlierMode?: string,
    @Query('method') methodRaw?: string
  ): Promise<PRAverageOpenByResponse> {
    const method = normalizeMetricMethod(methodRaw);
    return this.prsService.getOpenTimeBy(
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
  }

  @Get('/pull-requests/average-comments')
  async averageComments(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('labels') labels?: string,
    @Query('authors') authors?: string,
    @Query('exclude_authors') excludeAuthors?: string,
    @Query('exclude_commenters') excludeCommenters?: string,
    @Query('status') status?: PRDetails['state'],
    @Query('weekends') weekends?: string,
    @Query('outlier_mode') outlierMode?: string,
    @Query('method') methodRaw?: string
  ): Promise<PRAverageCommentsResponse> {
    const method = normalizeMetricMethod(methodRaw);
    const metrics = await this.prsService.getMetrics(
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
    return { avg_comments: metrics.averageComments, outliers: metrics.outliers?.comments };
  }

  @Get('/pull-requests/comments-by-author')
  async commentsByAuthor(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('labels') labels?: string,
    @Query('top') top?: string,
    @Query('authors') authors?: string,
    @Query('exclude_authors') excludeAuthors?: string,
    @Query('exclude_commenters') excludeCommenters?: string,
    @Query('status') status?: PRDetails['state'],
    @Query('weekends') weekends?: string,
    @Query('outlier_mode') outlierMode?: string
  ): Promise<PRCommentsByAuthorResponse> {
    const maxRows = top ? Number(top) : 10;
    const result = await this.prsService.getCommentsByAuthor(
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

  @Get('/pull-requests/first-comment-time')
  async firstCommentTime(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('labels') labels?: string,
    @Query('top') top?: string,
    @Query('authors') authors?: string,
    @Query('exclude_authors') excludeAuthors?: string,
    @Query('exclude_commenters') excludeCommenters?: string,
    @Query('status') status?: PRDetails['state'],
    @Query('weekends') weekends?: string,
    @Query('outlier_mode') outlierMode?: string,
    @Query('method') methodRaw?: string
  ): Promise<PRFirstCommentTimeResponse> {
    const maxRows = top ? Number(top) : 10;
    const method = normalizeMetricMethod(methodRaw);
    const result = await this.prsService.getFirstCommentTime(
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

    return { result };
  }

  @Get('/pull-requests/filter-options')
  async filterOptions(): Promise<PRFilterOptionsResponse> {
    return this.pullRequestFiltersRepository.loadOptions();
  }

  private toFilters(
    startDate?: string,
    endDate?: string,
    authors?: string,
    excludeAuthors?: string,
    excludeCommenters?: string,
    labels?: string,
    status?: PRDetails['state'],
    weekends?: string,
    outlierMode?: string
  ): PRFilters {
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
