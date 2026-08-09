import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  parseMetricCleaningOptions,
  ChangeRequestsService,
  ChangeRequestEvaluationService,
} from '@smmachine/core';
import type { MetricCleaningOptions, ChangeRequestDashboardData } from '@smmachine/core';
import { normalizeMetricMethod } from '../utils/metric-method';
import { formatDuration } from '@smmachine/utils';
import type { ChangeRequestEvaluationResponse } from '../dtos/response.dto';

function toFilters(
  startDate?: string,
  endDate?: string,
  authors?: string,
  excludeAuthors?: string,
  excludeCommenters?: string,
  labels?: string,
  status?: string,
  weekends?: string,
  outlierMode?: string
): {
  startDate?: string;
  endDate?: string;
  authors?: string;
  excludeAuthors?: string;
  excludeCommenters?: string;
  labels?: string;
  state: 'open' | 'closed' | 'merged' | 'draft' | undefined;
  cleaning?: MetricCleaningOptions;
} {
  return {
    startDate,
    endDate,
    authors,
    excludeAuthors,
    excludeCommenters,
    labels,
    state: status as 'open' | 'closed' | 'merged' | 'draft' | undefined,
    cleaning: parseMetricCleaningOptions({ weekends, outlierMode }),
  };
}

@ApiTags('Change Request Evaluation')
@Controller()
export class ChangeRequestEvaluationController {
  private readonly evaluationService = new ChangeRequestEvaluationService();

  constructor(private readonly changeRequestsService: ChangeRequestsService) {}

  @Get('/change-requests/evaluate')
  async evaluate(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('authors') authors?: string,
    @Query('exclude_authors') excludeAuthors?: string,
    @Query('exclude_commenters') excludeCommenters?: string,
    @Query('labels') labels?: string,
    @Query('status') status?: string,
    @Query('weekends') weekends?: string,
    @Query('outlier_mode') outlierMode?: string,
    @Query('method') methodRaw?: string,
    @Query('aggregate_by') aggregateBy?: string
  ): Promise<ChangeRequestEvaluationResponse> {
    const filters = toFilters(
      startDate,
      endDate,
      authors,
      excludeAuthors,
      excludeCommenters,
      labels,
      status,
      weekends,
      outlierMode
    );
    const method = normalizeMetricMethod(methodRaw);

    const [
      summary,
      reviewTime,
      openTime,
      byAuthor,
      commentsByAuthor,
      firstCommentTime,
      throughputRaw,
    ] = await Promise.all([
      this.changeRequestsService.getSummary(
        filters as Parameters<typeof this.changeRequestsService.getSummary>[0]
      ),
      this.changeRequestsService.getReviewTime(
        filters as Parameters<typeof this.changeRequestsService.getReviewTime>[0],
        20,
        method
      ),
      this.changeRequestsService.getOpenTimeBy(
        filters as Parameters<typeof this.changeRequestsService.getOpenTimeBy>[0],
        aggregateBy,
        method
      ),
      this.changeRequestsService.getByAuthor(
        filters as Parameters<typeof this.changeRequestsService.getByAuthor>[0],
        20
      ),
      this.changeRequestsService.getCommentsByAuthor(
        filters as Parameters<typeof this.changeRequestsService.getCommentsByAuthor>[0],
        20
      ),
      this.changeRequestsService.getFirstCommentTime(
        filters as Parameters<typeof this.changeRequestsService.getFirstCommentTime>[0],
        20,
        method
      ),
      this.changeRequestsService.getThroughTime(
        filters as Parameters<typeof this.changeRequestsService.getThroughTime>[0],
        aggregateBy
      ),
    ]);

    const throughput = [throughputRaw]
      .flat()
      .reduce<Array<{ period: string; opened: number; closed: number }>>((acc, item) => {
        const existing = acc.find((e) => e.period === item.date);
        if (existing) {
          if (item.kind === 'Opened') existing.opened += item.count;
          if (item.kind === 'Closed') existing.closed += item.count;
        } else {
          acc.push({
            period: item.date,
            opened: item.kind === 'Opened' ? item.count : 0,
            closed: item.kind === 'Closed' ? item.count : 0,
          });
        }
        return acc;
      }, [])
      .sort((a, b) => a.period.localeCompare(b.period));

    const unwrap = <T>(wrapped: { result: T } | T): T =>
      (wrapped && typeof wrapped === 'object' && 'result' in wrapped
        ? wrapped.result
        : wrapped) as T;

    const dashboardData: ChangeRequestDashboardData = {
      summary: summary
        ? (unwrap(
            summary as { result: unknown } | unknown
          ) as ChangeRequestDashboardData['summary'])
        : null,
      reviewTime: Array.isArray(unwrap(reviewTime))
        ? (unwrap(reviewTime) as ChangeRequestDashboardData['reviewTime'])
        : [],
      openTime: Array.isArray(openTime) ? openTime : [],
      byAuthor: Array.isArray(unwrap(byAuthor))
        ? (unwrap(byAuthor) as ChangeRequestDashboardData['byAuthor'])
        : [],
      commentsByAuthor: Array.isArray(unwrap(commentsByAuthor))
        ? (unwrap(commentsByAuthor) as ChangeRequestDashboardData['commentsByAuthor'])
        : [],
      firstCommentTime: Array.isArray(unwrap(firstCommentTime))
        ? (unwrap(firstCommentTime) as ChangeRequestDashboardData['firstCommentTime'])
        : [],
      throughput,
    };

    const evaluation = this.evaluationService.evaluate(dashboardData);

    return {
      ...evaluation,
      summary: {
        ...evaluation.summary,
        reviewHours_formatted: formatDuration(evaluation.summary.reviewHours, 'hours'),
        openDays_formatted: formatDuration(evaluation.summary.openDays, 'days'),
      },
    };
  }
}
