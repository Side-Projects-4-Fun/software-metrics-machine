import type { Logger } from '@smmachine/utils';
import type {
  ChangeRequestDetails,
  ChangeRequestFilters,
  ChangeRequestMetrics,
  ChangeRequestsByTimeframe,
  LabelSummary,
  ChangeRequestSummary,
  ChangeRequestSummaryFirstCommentTime,
  ChangeRequestSummaryEntry,
  ChangeRequestSummaryResponse,
  ChangeRequestAverageOutlierItem,
} from '../change-request-types';
import type { IReadChangeRequestsRepository } from '../repositories';
import type { TimeZoneProvider } from '../../../infrastructure';
import { stopWords } from './stop-words';
import type {
  CleanedMetricSamples,
  MetricCleaningOptions,
  MetricMethod,
  MetricOutlier,
  MetricSample,
} from '../../metric-samples';
import { cleanMetricSamples, computeMetricSamples } from '../../metric-samples';

export interface IChangeRequestsService {
  getMetrics(filters?: ChangeRequestFilters, method?: MetricMethod): Promise<ChangeRequestMetrics>;
  getMetricsByMonth(
    filters?: ChangeRequestFilters,
    method?: MetricMethod
  ): Promise<ChangeRequestsByTimeframe[]>;
  getMetricsByWeek(
    filters?: ChangeRequestFilters,
    method?: MetricMethod
  ): Promise<ChangeRequestsByTimeframe[]>;
  getLabelSummaries(filters?: ChangeRequestFilters): Promise<LabelSummary[]>;
  getCommentsByAuthor(
    filters?: ChangeRequestFilters,
    top?: number
  ): Promise<Array<{ author: string; count: number }>>;
  getFirstCommentTime(
    filters?: ChangeRequestFilters,
    top?: number,
    method?: MetricMethod
  ): Promise<
    Array<{
      author: string;
      value: number;
      method: MetricMethod;
      change_requests_with_comments: number;
      outliers?: Array<MetricOutlier<ChangeRequestAverageOutlierItem>>;
    }>
  >;
  getThroughTime(
    filters?: ChangeRequestFilters,
    aggregateBy?: string
  ): Promise<Array<{ date: string; kind: string; count: number }>>;
  getByAuthor(
    filters?: ChangeRequestFilters,
    top?: number
  ): Promise<Array<{ author: string; count: number }>>;
  getReviewTime(
    filters?: ChangeRequestFilters,
    top?: number,
    method?: MetricMethod
  ): Promise<
    Array<{
      author: string;
      value: number;
      method: MetricMethod;
      outliers?: Array<MetricOutlier<ChangeRequestAverageOutlierItem>>;
    }>
  >;
  getOpenTimeBy(
    filters?: ChangeRequestFilters,
    aggregateBy?: string,
    method?: MetricMethod
  ): Promise<
    Array<{
      period: string;
      value: number;
      method: MetricMethod;
      outliers?: Array<MetricOutlier<ChangeRequestAverageOutlierItem>>;
    }>
  >;
}

/**
 * ChangeRequestsService provides analytics on change requests.
 * Calculates lead time, review speed, and other change request metrics.
 */
export class ChangeRequestsService implements IChangeRequestsService {
  private tz: TimeZoneProvider;

  constructor(
    private changeRequestRepository: IReadChangeRequestsRepository,
    timeZoneProvider: TimeZoneProvider,
    private logger: Logger
  ) {
    this.tz = timeZoneProvider;
  }

  /**
   * Get overall change request metrics for the given filters.
   */
  async getMetrics(
    filters?: ChangeRequestFilters,
    method: MetricMethod = 'average'
  ): Promise<ChangeRequestMetrics> {
    const changeRequests = await this.filterChangeRequests(filters);

    const mergedChangeRequests = changeRequests.filter((changeRequest) => changeRequest.mergedAt);
    const closedChangeRequests = changeRequests.filter(
      (changeRequest) => changeRequest.closedAt && !changeRequest.mergedAt
    );
    const openChangeRequests = changeRequests.filter(
      (changeRequest) => !changeRequest.closedAt && !changeRequest.mergedAt
    );

    const cleanedOpenDays = this.cleanChangeRequestSamples(
      mergedChangeRequests.map((changeRequest) =>
        this.toChangeRequestSample(changeRequest, this.calculateOpenDays(changeRequest))
      ),
      filters?.cleaning
    );
    const averageOpenDays = computeMetricSamples(cleanedOpenDays.samples, method);

    const cleanedComments = this.cleanChangeRequestSamples(
      changeRequests.map((changeRequest) =>
        this.toChangeRequestSample(changeRequest, changeRequest.totalComments || 0)
      ),
      filters?.cleaning
    );
    const averageComments = computeMetricSamples(cleanedComments.samples, method);

    const mostCommentedChangeRequests = changeRequests
      .filter((changeRequest) => changeRequest.totalComments > 0)
      .sort((a, b) => b.totalComments - a.totalComments)
      .slice(0, 10)
      .map((changeRequest) => ({
        change_request_id: changeRequest.id,
        change_request_title: changeRequest.title,
        change_request_url: changeRequest.url,
        comments_count: changeRequest.totalComments,
      }));

    const commentSummary = await this.getCommentsByAuthor(filters);
    const labelSummary = await this.getLabelSummaries(filters);

    this.logger.debug(
      `Change request metrics: ${changeRequests.length} total, ${mergedChangeRequests.length} merged, avg ${averageOpenDays.toFixed(2)} days open`
    );

    return {
      openDays: Math.round(averageOpenDays * 100) / 100,
      totalChangeRequests: changeRequests.length,
      mergedChangeRequests: mergedChangeRequests.length,
      closedChangeRequests: closedChangeRequests.length,
      openChangeRequests: openChangeRequests.length,
      comments: Math.round(averageComments * 100) / 100,
      most_commented_change_requests: mostCommentedChangeRequests,
      leadTime: Math.round(averageOpenDays * 100) / 100,
      method,
      commentSummary,
      labelSummary,
      outliers: this.shouldExposeOutliers(filters?.cleaning)
        ? {
            openDays: cleanedOpenDays.outliers,
            comments: cleanedComments.outliers,
          }
        : undefined,
    };
  }

  /**
   * Get change request metrics grouped by month.
   */
  async getMetricsByMonth(
    filters?: ChangeRequestFilters,
    method: MetricMethod = 'average'
  ): Promise<ChangeRequestsByTimeframe[]> {
    const changeRequests = await this.filterChangeRequests(filters);

    // Group change requests by month
    const byMonth = new Map<string, ChangeRequestDetails[]>();

    for (const changeRequest of changeRequests) {
      const createdDate = new Date(changeRequest.createdAt);
      const monthKey = this.getMonthKey(createdDate);

      if (!byMonth.has(monthKey)) {
        byMonth.set(monthKey, []);
      }
      byMonth.get(monthKey)!.push(changeRequest);
    }

    // Calculate metrics for each month
    const result: ChangeRequestsByTimeframe[] = [];
    const months = Array.from(byMonth.keys()).sort((a, b) => a.localeCompare(b));

    for (const month of months) {
      const monthChangeRequests = byMonth.get(month)!;
      const metrics = this.calculateTimeframeMetrics(
        month,
        monthChangeRequests,
        method,
        filters?.cleaning
      );
      result.push(metrics);
    }

    return result;
  }

  /**
   * Get change request metrics grouped by week.
   */
  async getMetricsByWeek(
    filters?: ChangeRequestFilters,
    method: MetricMethod = 'average'
  ): Promise<ChangeRequestsByTimeframe[]> {
    const changeRequests = await this.filterChangeRequests(filters);

    // Group change requests by week (only merged ones)
    const byWeek = new Map<string, ChangeRequestDetails[]>();

    for (const changeRequest of changeRequests) {
      if (!changeRequest.mergedAt) continue; // Only count merged for weekly view

      const mergedDate = new Date(changeRequest.mergedAt);
      const weekKey = this.getWeekKey(mergedDate);

      if (!byWeek.has(weekKey)) {
        byWeek.set(weekKey, []);
      }
      byWeek.get(weekKey)!.push(changeRequest);
    }

    // Calculate metrics for each week
    const result: ChangeRequestsByTimeframe[] = [];
    const weeks = Array.from(byWeek.keys()).sort((a, b) => a.localeCompare(b));

    for (const week of weeks) {
      const weekChangeRequests = byWeek.get(week)!;
      const metrics = this.calculateTimeframeMetrics(
        week,
        weekChangeRequests,
        method,
        filters?.cleaning
      );
      result.push(metrics);
    }

    return result;
  }

  /**
   * Get summary statistics for each label.
   */
  async getLabelSummaries(filters?: ChangeRequestFilters): Promise<LabelSummary[]> {
    const changeRequests = await this.filterChangeRequests(filters);

    const labelMap = new Map<string, ChangeRequestDetails[]>();

    for (const changeRequest of changeRequests) {
      for (const label of changeRequest.labels || []) {
        const labelKey = label.name.toLowerCase();
        if (!labelMap.has(labelKey)) {
          labelMap.set(labelKey, []);
        }
        labelMap.get(labelKey)!.push(changeRequest);
      }
    }

    const result: LabelSummary[] = [];

    for (const [label, labeledChangeRequests] of labelMap.entries()) {
      const cleanedOpenDays = this.cleanChangeRequestSamples(
        labeledChangeRequests.map((changeRequest) =>
          this.toChangeRequestSample(changeRequest, this.calculateOpenDays(changeRequest))
        ),
        filters?.cleaning
      );
      const averageOpenDays = computeMetricSamples(cleanedOpenDays.samples, 'average');

      result.push({
        label,
        count: labeledChangeRequests.length,
        openDays: Math.round(averageOpenDays * 100) / 100,
        outliers: this.shouldExposeOutliers(filters?.cleaning)
          ? cleanedOpenDays.outliers
          : undefined,
      });
    }

    return result.sort((a, b) => b.count - a.count);
  }

  async getSummary(filters?: ChangeRequestFilters): Promise<ChangeRequestSummaryResponse> {
    const changeRequests = await this.filterChangeRequests(filters);
    const merged = changeRequests.filter((changeRequest) => Boolean(changeRequest.mergedAt)).length;
    const closed = changeRequests.filter((changeRequest) => Boolean(changeRequest.closedAt)).length;
    const open = changeRequests.filter(
      (changeRequest) => !changeRequest.closedAt && !changeRequest.mergedAt
    ).length;
    const totalComments = changeRequests.reduce(
      (sum, changeRequest) => sum + (changeRequest.totalComments || 0),
      0
    );
    const avgComments = changeRequests.length > 0 ? totalComments / changeRequests.length : 0;
    const authorsSet = new Set(
      changeRequests
        .map((changeRequest) => changeRequest.author?.login || '')
        .filter((name) => name.length > 0)
    );
    const labelSummary = this.extractLabelSummary(changeRequests);

    const sorted = [...changeRequests].sort(
      (a, b) => this.toTimestamp(a.createdAt) - this.toTimestamp(b.createdAt)
    );
    const sortedByComments = [...changeRequests].sort(
      (a, b) => (b.totalComments || 0) - (a.totalComments || 0)
    );

    const mostCommentedChangeRequests = changeRequests
      .filter(
        (changeRequest) =>
          (changeRequest.totalComments || 0) > 0 &&
          changeRequest.id &&
          changeRequest.title &&
          changeRequest.url
      )
      .sort((a, b) => b.totalComments - a.totalComments)
      .slice(0, 10)
      .map((changeRequest) => ({
        change_request_id: changeRequest.id!,
        change_request_title: changeRequest.title!,
        change_request_url: changeRequest.url!,
        comments_count: changeRequest.totalComments!,
      }));

    const commentsByAuthor = this.extractCommentsByAuthor(changeRequests);
    const topCommenter = commentsByAuthor[0] || null;
    const summary: ChangeRequestSummary = {
      total_change_requests: changeRequests.length,
      merged_change_requests: merged,
      closed_change_requests: closed,
      change_requests_without_conclusion: changeRequests.length - merged,
      open_change_requests: open,
      avg_comments_per_change_request: avgComments,
      unique_authors: authorsSet.size,
      unique_labels: labelSummary.length,
      labels: labelSummary,
      first_change_request: sorted.length > 0 ? this.toSummaryEntry(sorted[0]) : null,
      last_change_request:
        sorted.length > 0 ? this.toSummaryEntry(sorted[sorted.length - 1]) : null,
      top_themes: this.extractTopThemes(changeRequests),
      most_commented_change_request:
        sortedByComments.length > 0 && (sortedByComments[0].totalComments || 0) > 0
          ? {
              number: sortedByComments[0].number,
              title: sortedByComments[0].title,
              author: sortedByComments[0].author?.login || 'unknown',
              comments: sortedByComments[0].totalComments,
            }
          : null,
      most_commented_change_requests: mostCommentedChangeRequests,
      top_commenter: topCommenter
        ? {
            login: topCommenter.author,
            comments: topCommenter.count,
          }
        : null,
      time_to_first_comment_hours: this.calculateFirstCommentTimeSummary(changeRequests),
    };

    return {
      result: summary,
    };
  }

  async getThroughTime(
    filters?: ChangeRequestFilters,
    aggregateBy?: string
  ): Promise<Array<{ date: string; kind: string; count: number }>> {
    const changeRequests = await this.filterChangeRequests(filters);
    const mode = this.normalizeAggregation(aggregateBy);
    const counts = new Map<string, { Opened: number; Closed: number }>();

    for (const changeRequest of changeRequests) {
      const opened = this.toPeriodKey(changeRequest.createdAt, mode);
      const current = counts.get(opened) || { Opened: 0, Closed: 0 };
      current.Opened += 1;
      counts.set(opened, current);

      const closedAt = changeRequest.mergedAt || changeRequest.closedAt;
      if (closedAt) {
        const closedKey = this.toPeriodKey(closedAt, mode);
        const closedCurrent = counts.get(closedKey) || { Opened: 0, Closed: 0 };
        closedCurrent.Closed += 1;
        counts.set(closedKey, closedCurrent);
      }
    }

    const dates = Array.from(counts.keys()).sort((a, b) => a.localeCompare(b));
    const rows: Array<{ date: string; kind: string; count: number }> = [];

    for (const date of dates) {
      const value = counts.get(date)!;
      rows.push({ date, kind: 'Opened', count: value.Opened });
      rows.push({ date, kind: 'Closed', count: value.Closed });
    }

    return rows;
  }

  async getByAuthor(
    filters?: ChangeRequestFilters,
    top?: number
  ): Promise<Array<{ author: string; count: number }>> {
    const changeRequests = await this.filterChangeRequests(filters);
    const grouped = new Map<string, number>();

    for (const changeRequest of changeRequests) {
      const author = changeRequest.author?.login || 'unknown';
      grouped.set(author, (grouped.get(author) || 0) + 1);
    }

    const maxRows = top || 10;
    return Array.from(grouped.entries())
      .map(([author, count]) => ({ author, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, maxRows);
  }

  async getReviewTime(
    filters?: ChangeRequestFilters,
    top?: number,
    method: MetricMethod = 'average'
  ): Promise<
    Array<{
      author: string;
      value: number;
      method: MetricMethod;
      outliers?: Array<MetricOutlier<ChangeRequestAverageOutlierItem>>;
    }>
  > {
    const changeRequests = await this.filterChangeRequests(filters);
    const merged = changeRequests.filter(
      (changeRequest) => Boolean(changeRequest.mergedAt) || Boolean(changeRequest.closedAt)
    );
    const grouped = new Map<string, Array<MetricSample<ChangeRequestAverageOutlierItem>>>();

    for (const changeRequest of merged) {
      const start = this.toTimestamp(changeRequest.createdAt);
      const end = this.toTimestamp(changeRequest.mergedAt || changeRequest.closedAt);
      if (Number.isNaN(start) || Number.isNaN(end)) {
        continue;
      }
      const days = (end - start) / (1000 * 60 * 60 * 24);
      const author = changeRequest.author?.login || 'unknown';
      const existing = grouped.get(author) || [];
      existing.push(this.toChangeRequestSample(changeRequest, days));
      grouped.set(author, existing);
    }

    const maxRows = top || 10;
    return Array.from(grouped.entries())
      .map(([author, values]) => {
        const cleaned = this.cleanChangeRequestSamples(values, filters?.cleaning);
        return {
          author,
          value: computeMetricSamples(cleaned.samples, method),
          method,
          outliers: this.shouldExposeOutliers(filters?.cleaning) ? cleaned.outliers : undefined,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, maxRows);
  }

  async getAverageReviewTime(
    filters?: ChangeRequestFilters,
    top?: number
  ): Promise<
    Array<{
      author: string;
      value: number;
      method: MetricMethod;
      outliers?: Array<MetricOutlier<ChangeRequestAverageOutlierItem>>;
    }>
  > {
    return this.getReviewTime(filters, top, 'average');
  }

  async getOpenTimeBy(
    filters?: ChangeRequestFilters,
    aggregateBy?: string,
    method: MetricMethod = 'average'
  ): Promise<
    Array<{
      period: string;
      value: number;
      method: MetricMethod;
      outliers?: Array<MetricOutlier<ChangeRequestAverageOutlierItem>>;
    }>
  > {
    const changeRequests = await this.filterChangeRequests(filters);
    const mode = this.normalizeAggregation(aggregateBy);
    const grouped = new Map<string, Array<MetricSample<ChangeRequestAverageOutlierItem>>>();

    for (const changeRequest of changeRequests) {
      const period = this.toPeriodKey(changeRequest.createdAt, mode);
      const start = this.toTimestamp(changeRequest.createdAt);
      const end = this.toTimestamp(
        changeRequest.mergedAt || changeRequest.closedAt || changeRequest.createdAt
      );
      if (Number.isNaN(start) || Number.isNaN(end)) {
        continue;
      }
      const days = (end - start) / (1000 * 60 * 60 * 24);
      const existing = grouped.get(period) || [];
      existing.push(this.toChangeRequestSample(changeRequest, days));
      grouped.set(period, existing);
    }

    return Array.from(grouped.entries())
      .map(([period, values]) => {
        const cleaned = this.cleanChangeRequestSamples(values, filters?.cleaning);
        return {
          period,
          value: computeMetricSamples(cleaned.samples, method),
          method,
          outliers: this.shouldExposeOutliers(filters?.cleaning) ? cleaned.outliers : undefined,
        };
      })
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  async getAverageOpenBy(
    filters?: ChangeRequestFilters,
    aggregateBy?: string
  ): Promise<
    Array<{
      period: string;
      value: number;
      method: MetricMethod;
      outliers?: Array<MetricOutlier<ChangeRequestAverageOutlierItem>>;
    }>
  > {
    return this.getOpenTimeBy(filters, aggregateBy, 'average');
  }

  /**
   * Filter change requests by the provided criteria.
   */
  private async filterChangeRequests(
    filters?: ChangeRequestFilters
  ): Promise<ChangeRequestDetails[]> {
    return await this.changeRequestRepository.loadChangeRequestsWithFilters(filters);
  }

  private calculateOpenDays(changeRequest: ChangeRequestDetails): number {
    const created = new Date(changeRequest.createdAt);
    const closed = changeRequest.mergedAt
      ? new Date(changeRequest.mergedAt)
      : changeRequest.closedAt
        ? new Date(changeRequest.closedAt)
        : new Date(); // Use current time if still open

    const diffMs = closed.getTime() - created.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24)); // Convert to days
  }

  private getMonthKey(date: Date): string {
    return this.tz.getMonthKey(date);
  }

  private getWeekKey(date: Date): string {
    return this.tz.getWeekKey(date);
  }

  private calculateTimeframeMetrics(
    period: string,
    changeRequests: ChangeRequestDetails[],
    method: MetricMethod = 'average',
    cleaning?: MetricCleaningOptions
  ): ChangeRequestsByTimeframe {
    const cleanedOpenDays = this.cleanChangeRequestSamples(
      changeRequests.map((changeRequest) =>
        this.toChangeRequestSample(changeRequest, this.calculateOpenDays(changeRequest))
      ),
      cleaning
    );
    const openDays = computeMetricSamples(cleanedOpenDays.samples, method);

    const cleanedComments = this.cleanChangeRequestSamples(
      changeRequests.map((changeRequest) =>
        this.toChangeRequestSample(changeRequest, changeRequest.totalComments || 0)
      ),
      cleaning
    );
    const comments = computeMetricSamples(cleanedComments.samples, method);

    return {
      period,
      count: changeRequests.length,
      openDays: Math.round(openDays * 100) / 100,
      comments: Math.round(comments * 100) / 100,
      method,
      outliers: this.shouldExposeOutliers(cleaning)
        ? {
            openDays: cleanedOpenDays.outliers,
            comments: cleanedComments.outliers,
          }
        : undefined,
    };
  }

  private extractTopThemes(
    changeRequests: ChangeRequestDetails[]
  ): Array<{ text: string; value: number }> {
    const ngramCounts = new Map<string, number>();

    for (const changeRequest of changeRequests) {
      const commentsText = (changeRequest.comments || [])
        .map((comment) => comment.body)
        .filter((body) => typeof body === 'string' && body.trim().length > 0)
        .join(' ')
        .toLowerCase();

      if (!commentsText.trim()) {
        continue;
      }

      const normalized = commentsText
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`[^`]*`/g, ' ')
        .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const words = normalized
        .split(' ')
        .map((w) => w.trim())
        .filter((w) => w.length >= 3)
        .filter((w) => !stopWords.has(w))
        .filter((w) => !/^\d+$/.test(w));

      // unigrams, bigrams, trigrams
      for (let n = 1; n <= 3; n++) {
        for (let i = 0; i <= words.length - n; i++) {
          const ngram = words.slice(i, i + n).join(' ');
          ngramCounts.set(ngram, (ngramCounts.get(ngram) || 0) + 1);
        }
      }
    }

    return Array.from(ngramCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 30)
      .map(([text, value]) => ({ text, value }));
  }

  private extractLabelSummary(
    changeRequests: ChangeRequestDetails[]
  ): Array<{ label: string; change_requests: number }> {
    const labelToChangeRequests = new Map<string, number>();

    for (const changeRequest of changeRequests) {
      // Count each label at most once per change request.
      const uniqueLabels = new Set(
        (changeRequest.labels || [])
          .map((label) => (label.name || '').trim())
          .filter((name) => name.length > 0)
      );

      for (const label of uniqueLabels) {
        labelToChangeRequests.set(label, (labelToChangeRequests.get(label) || 0) + 1);
      }
    }

    return Array.from(labelToChangeRequests.entries())
      .map(([label, count]) => ({ label, change_requests: count }))
      .sort((a, b) => b.change_requests - a.change_requests || a.label.localeCompare(b.label));
  }

  private extractCommentsByAuthor(
    changeRequests: ChangeRequestDetails[]
  ): Array<{ author: string; count: number }> {
    const grouped = new Map<string, number>();

    for (const changeRequest of changeRequests) {
      for (const comment of changeRequest.comments || []) {
        const author = comment.author?.login || 'unknown';
        grouped.set(author, (grouped.get(author) || 0) + 1);
      }
    }

    return Array.from(grouped.entries())
      .map(([author, count]) => ({ author, count }))
      .sort((a, b) => b.count - a.count || a.author.localeCompare(b.author));
  }

  private toSummaryEntry(changeRequest: ChangeRequestDetails): ChangeRequestSummaryEntry {
    return {
      number: changeRequest.number,
      title: changeRequest.title,
      author: changeRequest.author?.login || 'unknown',
      created: changeRequest.createdAt,
      merged: changeRequest.mergedAt,
      closed: changeRequest.closedAt,
    };
  }

  private calculateFirstCommentTimeSummary(
    changeRequests: ChangeRequestDetails[]
  ): ChangeRequestSummaryFirstCommentTime {
    const hoursUntilFirstComment: number[] = [];

    for (const changeRequest of changeRequests) {
      if (!Array.isArray(changeRequest.comments) || changeRequest.comments.length === 0) {
        continue;
      }

      const firstComment = [...changeRequest.comments]
        .filter((comment) => Boolean(comment.createdAt))
        .sort((a, b) => this.toTimestamp(a.createdAt) - this.toTimestamp(b.createdAt))[0];

      if (!firstComment) {
        continue;
      }

      const changeRequestOpenedAt = this.toTimestamp(changeRequest.createdAt);
      const firstCommentAt = this.toTimestamp(firstComment.createdAt);
      if (
        !Number.isFinite(changeRequestOpenedAt) ||
        !Number.isFinite(firstCommentAt) ||
        changeRequestOpenedAt === 0 ||
        firstCommentAt === 0 ||
        firstCommentAt < changeRequestOpenedAt
      ) {
        continue;
      }

      hoursUntilFirstComment.push((firstCommentAt - changeRequestOpenedAt) / (1000 * 60 * 60));
    }

    const sorted = [...hoursUntilFirstComment].sort((a, b) => a - b);
    const rawSamples: Array<MetricSample<unknown>> = sorted.map((v) => ({
      value: v,
      timestamp: '',
      item: undefined,
    }));

    return {
      average: computeMetricSamples(rawSamples, 'average'),
      median: computeMetricSamples(rawSamples, 'median'),
      min: sorted[0] || 0,
      max: sorted[sorted.length - 1] || 0,
      change_requests_with_comment: sorted.length,
      change_requests_without_comment: changeRequests.length - sorted.length,
    };
  }

  private normalizeAggregation(aggregateBy?: string): 'day' | 'week' | 'month' {
    const mode = (aggregateBy || 'week').toLowerCase();
    return mode === 'day' || mode === 'month' ? mode : 'week';
  }

  private toPeriodKey(dateString: string | undefined, mode: 'day' | 'week' | 'month'): string {
    return this.tz.getIntervalKey(dateString, mode);
  }

  private toTimestamp(value?: string): number {
    if (!value) {
      return 0;
    }
    return new Date(value).getTime();
  }

  async getCommentsByAuthor(
    filters?: ChangeRequestFilters,
    top?: number
  ): Promise<Array<{ author: string; count: number }>> {
    const changeRequests = await this.filterChangeRequests(filters);
    const maxRows = top || 10;
    return this.extractCommentsByAuthor(changeRequests).slice(0, maxRows);
  }

  async getFirstCommentTime(
    filters?: ChangeRequestFilters,
    top?: number,
    method: MetricMethod = 'average'
  ): Promise<
    Array<{
      author: string;
      value: number;
      method: MetricMethod;
      change_requests_with_comments: number;
      outliers?: Array<MetricOutlier<ChangeRequestAverageOutlierItem>>;
    }>
  > {
    const changeRequests = await this.filterChangeRequests(filters);
    const grouped = new Map<string, Array<MetricSample<ChangeRequestAverageOutlierItem>>>();

    for (const changeRequest of changeRequests) {
      if (!Array.isArray(changeRequest.comments) || changeRequest.comments.length === 0) {
        continue;
      }

      const firstComment = [...changeRequest.comments]
        .filter((comment) => Boolean(comment.createdAt))
        .sort((a, b) => this.toTimestamp(a.createdAt) - this.toTimestamp(b.createdAt))[0];

      if (!firstComment) {
        continue;
      }

      const changeRequestOpenedAt = this.toTimestamp(changeRequest.createdAt);
      const firstCommentAt = this.toTimestamp(firstComment.createdAt);
      if (
        !Number.isFinite(changeRequestOpenedAt) ||
        !Number.isFinite(firstCommentAt) ||
        changeRequestOpenedAt === 0 ||
        firstCommentAt === 0 ||
        firstCommentAt < changeRequestOpenedAt
      ) {
        continue;
      }

      const author = changeRequest.author?.login || 'unknown';
      const hours = (firstCommentAt - changeRequestOpenedAt) / (1000 * 60 * 60);
      const existing = grouped.get(author) || [];
      existing.push(this.toChangeRequestSample(changeRequest, hours));
      grouped.set(author, existing);
    }

    const maxRows = top || 10;
    return Array.from(grouped.entries())
      .map(([author, values]) => {
        const cleaned = this.cleanChangeRequestSamples(values, filters?.cleaning);
        return {
          author,
          value: computeMetricSamples(cleaned.samples, method),
          method,
          change_requests_with_comments: cleaned.samples.length,
          outliers: this.shouldExposeOutliers(filters?.cleaning) ? cleaned.outliers : undefined,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, maxRows);
  }

  private toChangeRequestSample(
    changeRequest: ChangeRequestDetails,
    value: number
  ): MetricSample<ChangeRequestAverageOutlierItem> {
    return {
      value,
      timestamp: changeRequest.mergedAt || changeRequest.closedAt || changeRequest.createdAt,
      item: {
        id: changeRequest.id,
        number: changeRequest.number,
        title: changeRequest.title,
        author: changeRequest.author?.login || 'unknown',
        url: changeRequest.url,
      },
    };
  }

  private cleanChangeRequestSamples(
    samples: Array<MetricSample<ChangeRequestAverageOutlierItem>>,
    options?: MetricCleaningOptions
  ): CleanedMetricSamples<ChangeRequestAverageOutlierItem> {
    return cleanMetricSamples(samples, options);
  }

  private shouldExposeOutliers(options?: MetricCleaningOptions): boolean {
    return options?.outlierMode === 'flag' || options?.outlierMode === 'exclude';
  }
}
