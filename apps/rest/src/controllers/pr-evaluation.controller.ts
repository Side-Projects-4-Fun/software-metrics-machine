import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { MetricMethod, PRDashboardData } from '@smmachine/core';
import { parseMetricCleaningOptions, PRsService, PREvaluationService } from '@smmachine/core';
import type { PREvaluation } from '@smmachine/core';

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
) {
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

@ApiTags('Pull Request Evaluation')
@Controller()
export class PREvaluationController {
  private readonly evaluationService = new PREvaluationService();

  constructor(private readonly prsService: PRsService) {}

  @Get('/pull-requests/evaluate')
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
  ): Promise<PREvaluation> {
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
      this.prsService.getSummary(filters as Parameters<typeof this.prsService.getSummary>[0]),
      this.prsService.getReviewTime(
        filters as Parameters<typeof this.prsService.getReviewTime>[0],
        20,
        method
      ),
      this.prsService.getOpenTimeBy(
        filters as Parameters<typeof this.prsService.getOpenTimeBy>[0],
        aggregateBy,
        method
      ),
      this.prsService.getByAuthor(filters as Parameters<typeof this.prsService.getByAuthor>[0], 20),
      this.prsService.getCommentsByAuthor(
        filters as Parameters<typeof this.prsService.getCommentsByAuthor>[0],
        20
      ),
      this.prsService.getFirstCommentTime(
        filters as Parameters<typeof this.prsService.getFirstCommentTime>[0],
        20,
        method
      ),
      this.prsService.getThroughTime(
        filters as Parameters<typeof this.prsService.getThroughTime>[0],
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

    const dashboardData: PRDashboardData = {
      summary: summary
        ? (unwrap(summary as { result: unknown } | unknown) as PRDashboardData['summary'])
        : null,
      reviewTime: Array.isArray(unwrap(reviewTime))
        ? (unwrap(reviewTime) as PRDashboardData['reviewTime'])
        : [],
      openTime: Array.isArray(openTime) ? openTime : [],
      byAuthor: Array.isArray(unwrap(byAuthor))
        ? (unwrap(byAuthor) as PRDashboardData['byAuthor'])
        : [],
      commentsByAuthor: Array.isArray(unwrap(commentsByAuthor))
        ? (unwrap(commentsByAuthor) as PRDashboardData['commentsByAuthor'])
        : [],
      firstCommentTime: Array.isArray(unwrap(firstCommentTime))
        ? (unwrap(firstCommentTime) as PRDashboardData['firstCommentTime'])
        : [],
      throughput,
    };

    return this.evaluationService.evaluate(dashboardData);
  }
}
