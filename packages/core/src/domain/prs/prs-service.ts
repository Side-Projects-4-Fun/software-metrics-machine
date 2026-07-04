import { Logger } from '@smmachine/utils';
import {
  PRDetails,
  PRFilters,
  PRMetrics,
  PRsByTimeframe,
  LabelSummary,
  PRSummary,
  PRSummaryFirstCommentTime,
  PRSummaryPullRequest,
  PRSummaryResponse,
  PRAverageOutlierItem,
} from './pr-types';
import { IReadPullRequestsRepository } from './repositories/pull-requests-repository-json';
import { TimeZoneProvider } from '../../infrastructure/timezone-provider';
import { stopWords } from './stop-words';
import {
  averageMetricSamples,
  cleanMetricSamples,
  MetricCleaningOptions,
  MetricOutlier,
  MetricSample,
} from '../metric-samples';

export interface IPRsService {
  getMetrics(filters?: PRFilters): Promise<PRMetrics>;
  getMetricsByMonth(filters?: PRFilters): Promise<PRsByTimeframe[]>;
  getMetricsByWeek(filters?: PRFilters): Promise<PRsByTimeframe[]>;
  getLabelSummaries(filters?: PRFilters): Promise<LabelSummary[]>;
  getCommentsByAuthor(
    filters?: PRFilters,
    top?: number
  ): Promise<Array<{ author: string; count: number }>>;
  getFirstCommentTime(
    filters?: PRFilters,
    top?: number
  ): Promise<
    Array<{
      author: string;
      avg_hours: number;
      prs_with_comments: number;
      outliers?: Array<MetricOutlier<PRAverageOutlierItem>>;
    }>
  >;
  getThroughTime(
    filters?: PRFilters,
    aggregateBy?: string
  ): Promise<Array<{ date: string; kind: string; count: number }>>;
  getByAuthor(filters?: PRFilters, top?: number): Promise<Array<{ author: string; count: number }>>;
  getAverageReviewTime(
    filters?: PRFilters,
    top?: number
  ): Promise<
    Array<{ author: string; avg_days: number; outliers?: Array<MetricOutlier<PRAverageOutlierItem>> }>
  >;
  getAverageOpenBy(
    filters?: PRFilters,
    aggregateBy?: string
  ): Promise<
    Array<{ period: string; avg_days: number; outliers?: Array<MetricOutlier<PRAverageOutlierItem>> }>
  >;
}

/**
 * PRsRepository provides analytics on Pull Requests.
 * Calculates lead time, review speed, and other PR metrics.
 */
export class PRsService implements IPRsService {
  private tz: TimeZoneProvider;

  constructor(
    private prRepository: IReadPullRequestsRepository,
    timeZoneProvider: TimeZoneProvider,
    private logger: Logger
  ) {
    this.tz = timeZoneProvider;
  }

  /**
   * Get overall PR metrics for the given filters.
   */
  async getMetrics(filters?: PRFilters): Promise<PRMetrics> {
    const prs = await this.filterPRs(filters);

    const mergedPRs = prs.filter((pr) => pr.mergedAt);
    const closedPRs = prs.filter((pr) => pr.closedAt && !pr.mergedAt);
    const openPRs = prs.filter((pr) => !pr.closedAt && !pr.mergedAt);

    const cleanedOpenDays = this.cleanPRSamples(
      mergedPRs.map((pr) => this.toPRSample(pr, this.calculateOpenDays(pr))),
      filters?.cleaning
    );
    const averageOpenDays = averageMetricSamples(cleanedOpenDays.samples);

    const cleanedComments = this.cleanPRSamples(
      prs.map((pr) => this.toPRSample(pr, pr.totalComments || 0)),
      filters?.cleaning
    );
    const averageComments = averageMetricSamples(cleanedComments.samples);

    const mostCommentedPRs = prs
      .filter((pr) => pr.totalComments > 0)
      .sort((a, b) => b.totalComments - a.totalComments)
      .slice(0, 10)
      .map((pr) => ({
        pull_request_id: pr.id,
        pull_request_title: pr.title,
        pull_request_url: pr.url,
        comments_count: pr.totalComments,
      }));

    const commentSummary = await this.getCommentsByAuthor(filters);
    const labelSummary = await this.getLabelSummaries(filters);

    this.logger.debug(
      `PR Metrics: ${prs.length} total, ${mergedPRs.length} merged, avg ${averageOpenDays.toFixed(2)} days open`
    );

    return {
      averageOpenDays: Math.round(averageOpenDays * 100) / 100,
      totalPRs: prs.length,
      mergedPRs: mergedPRs.length,
      closedPRs: closedPRs.length,
      openPRs: openPRs.length,
      averageComments: Math.round(averageComments * 100) / 100,
      most_commented_prs: mostCommentedPRs,
      leadTime: Math.round(averageOpenDays * 100) / 100,
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
   * Get PR metrics grouped by month.
   */
  async getMetricsByMonth(filters?: PRFilters): Promise<PRsByTimeframe[]> {
    const prs = await this.filterPRs(filters);

    // Group PRs by month
    const byMonth = new Map<string, PRDetails[]>();

    for (const pr of prs) {
      const createdDate = new Date(pr.createdAt);
      const monthKey = this.getMonthKey(createdDate);

      if (!byMonth.has(monthKey)) {
        byMonth.set(monthKey, []);
      }
      byMonth.get(monthKey)!.push(pr);
    }

    // Calculate metrics for each month
    const result: PRsByTimeframe[] = [];
    const months = Array.from(byMonth.keys()).sort();

    for (const month of months) {
      const monthPRs = byMonth.get(month)!;
      const metrics = this.calculateTimeframeMetrics(month, monthPRs, filters?.cleaning);
      result.push(metrics);
    }

    return result;
  }

  /**
   * Get PR metrics grouped by week.
   */
  async getMetricsByWeek(filters?: PRFilters): Promise<PRsByTimeframe[]> {
    const prs = await this.filterPRs(filters);

    // Group PRs by week (only merged PRs)
    const byWeek = new Map<string, PRDetails[]>();

    for (const pr of prs) {
      if (!pr.mergedAt) continue; // Only count merged PRs for weekly view

      const mergedDate = new Date(pr.mergedAt);
      const weekKey = this.getWeekKey(mergedDate);

      if (!byWeek.has(weekKey)) {
        byWeek.set(weekKey, []);
      }
      byWeek.get(weekKey)!.push(pr);
    }

    // Calculate metrics for each week
    const result: PRsByTimeframe[] = [];
    const weeks = Array.from(byWeek.keys()).sort();

    for (const week of weeks) {
      const weekPRs = byWeek.get(week)!;
      const metrics = this.calculateTimeframeMetrics(week, weekPRs, filters?.cleaning);
      result.push(metrics);
    }

    return result;
  }

  /**
   * Get summary statistics for each label.
   */
  async getLabelSummaries(filters?: PRFilters): Promise<LabelSummary[]> {
    const prs = await this.filterPRs(filters);

    const labelMap = new Map<string, PRDetails[]>();

    for (const pr of prs) {
      for (const label of pr.labels || []) {
        const labelKey = label.name.toLowerCase();
        if (!labelMap.has(labelKey)) {
          labelMap.set(labelKey, []);
        }
        labelMap.get(labelKey)!.push(pr);
      }
    }

    const result: LabelSummary[] = [];

    for (const [label, labelPRs] of labelMap.entries()) {
      const cleanedOpenDays = this.cleanPRSamples(
        labelPRs.map((pr) => this.toPRSample(pr, this.calculateOpenDays(pr))),
        filters?.cleaning
      );
      const averageOpenDays = averageMetricSamples(cleanedOpenDays.samples);

      result.push({
        label,
        count: labelPRs.length,
        averageOpenDays: Math.round(averageOpenDays * 100) / 100,
        outliers: this.shouldExposeOutliers(filters?.cleaning) ? cleanedOpenDays.outliers : undefined,
      });
    }

    return result.sort((a, b) => b.count - a.count);
  }

  async getSummary(filters?: PRFilters): Promise<PRSummaryResponse> {
    const prs = await this.filterPRs(filters);
    const merged = prs.filter((pr) => Boolean(pr.mergedAt)).length;
    const closed = prs.filter((pr) => Boolean(pr.closedAt)).length;
    const open = prs.filter((pr) => !pr.closedAt && !pr.mergedAt).length;
    const totalComments = prs.reduce((sum, pr) => sum + (pr.totalComments || 0), 0);
    const avgComments = prs.length > 0 ? totalComments / prs.length : 0;
    const authorsSet = new Set(
      prs.map((pr) => pr.author?.login || '').filter((name) => name.length > 0)
    );
    const labelSummary = this.extractLabelSummary(prs);

    const sorted = [...prs].sort(
      (a, b) => this.toTimestamp(a.createdAt) - this.toTimestamp(b.createdAt)
    );
    const sortedByComments = [...prs].sort(
      (a, b) => (b.totalComments || 0) - (a.totalComments || 0)
    );

    const mostCommentedPRs = prs
      .filter((pr) => (pr.totalComments || 0) > 0 && pr.id && pr.title && pr.url)
      .sort((a, b) => b.totalComments - a.totalComments)
      .slice(0, 10)
      .map((pr) => ({
        pull_request_id: pr.id!,
        pull_request_title: pr.title!,
        pull_request_url: pr.url!,
        comments_count: pr.totalComments!,
      }));

    const commentsByAuthor = this.extractCommentsByAuthor(prs);
    const topCommenter = commentsByAuthor[0] || null;
    const summary: PRSummary = {
      total_prs: prs.length,
      merged_prs: merged,
      closed_prs: closed,
      prs_without_conclusion: prs.length - merged,
      open_prs: open,
      avg_comments_per_pr: avgComments,
      unique_authors: authorsSet.size,
      unique_labels: labelSummary.length,
      labels: labelSummary,
      first_pr: sorted.length > 0 ? this.toSummaryPullRequest(sorted[0]) : null,
      last_pr: sorted.length > 0 ? this.toSummaryPullRequest(sorted[sorted.length - 1]) : null,
      top_themes: this.extractTopThemes(prs),
      most_commented_pr:
        sortedByComments.length > 0 && (sortedByComments[0].totalComments || 0) > 0
          ? {
              number: sortedByComments[0].number,
              title: sortedByComments[0].title,
              author: sortedByComments[0].author?.login || 'unknown',
              comments: sortedByComments[0].totalComments,
            }
          : null,
      most_commented_prs: mostCommentedPRs,
      top_commenter: topCommenter
        ? {
            login: topCommenter.author,
            comments: topCommenter.count,
          }
        : null,
      time_to_first_comment_hours: this.calculateFirstCommentTimeSummary(prs),
    };

    return {
      result: summary,
    };
  }

  async getThroughTime(
    filters?: PRFilters,
    aggregateBy?: string
  ): Promise<Array<{ date: string; kind: string; count: number }>> {
    const prs = await this.filterPRs(filters);
    const mode = this.normalizeAggregation(aggregateBy);
    const counts = new Map<string, { Opened: number; Closed: number }>();

    for (const pr of prs) {
      const opened = this.toPeriodKey(pr.createdAt, mode);
      const current = counts.get(opened) || { Opened: 0, Closed: 0 };
      current.Opened += 1;
      counts.set(opened, current);

      const closedAt = pr.mergedAt || pr.closedAt;
      if (closedAt) {
        const closedKey = this.toPeriodKey(closedAt, mode);
        const closedCurrent = counts.get(closedKey) || { Opened: 0, Closed: 0 };
        closedCurrent.Closed += 1;
        counts.set(closedKey, closedCurrent);
      }
    }

    const dates = Array.from(counts.keys()).sort();
    const rows: Array<{ date: string; kind: string; count: number }> = [];

    for (const date of dates) {
      const value = counts.get(date)!;
      rows.push({ date, kind: 'Opened', count: value.Opened });
      rows.push({ date, kind: 'Closed', count: value.Closed });
    }

    return rows;
  }

  async getByAuthor(
    filters?: PRFilters,
    top?: number
  ): Promise<Array<{ author: string; count: number }>> {
    const prs = await this.filterPRs(filters);
    const grouped = new Map<string, number>();

    for (const pr of prs) {
      const author = pr.author?.login || 'unknown';
      grouped.set(author, (grouped.get(author) || 0) + 1);
    }

    const maxRows = top || 10;
    return Array.from(grouped.entries())
      .map(([author, count]) => ({ author, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, maxRows);
  }

  async getAverageReviewTime(
    filters?: PRFilters,
    top?: number
  ): Promise<
    Array<{ author: string; avg_days: number; outliers?: Array<MetricOutlier<PRAverageOutlierItem>> }>
  > {
    const prs = await this.filterPRs(filters);
    const merged = prs.filter((pr) => Boolean(pr.mergedAt) || Boolean(pr.closedAt));
    const grouped = new Map<string, Array<MetricSample<PRAverageOutlierItem>>>();

    for (const pr of merged) {
      const start = this.toTimestamp(pr.createdAt);
      const end = this.toTimestamp(pr.mergedAt || pr.closedAt);
      const days = (end - start) / (1000 * 60 * 60 * 24);
      const author = pr.author?.login || 'unknown';
      const existing = grouped.get(author) || [];
      existing.push(this.toPRSample(pr, days));
      grouped.set(author, existing);
    }

    const maxRows = top || 10;
    return Array.from(grouped.entries())
      .map(([author, values]) => {
        const cleaned = this.cleanPRSamples(values, filters?.cleaning);
        return {
          author,
          avg_days: averageMetricSamples(cleaned.samples),
          outliers: this.shouldExposeOutliers(filters?.cleaning) ? cleaned.outliers : undefined,
        };
      })
      .sort((a, b) => b.avg_days - a.avg_days)
      .slice(0, maxRows);
  }

  async getAverageOpenBy(
    filters?: PRFilters,
    aggregateBy?: string
  ): Promise<
    Array<{ period: string; avg_days: number; outliers?: Array<MetricOutlier<PRAverageOutlierItem>> }>
  > {
    const prs = await this.filterPRs(filters);
    const mode = this.normalizeAggregation(aggregateBy);
    const grouped = new Map<string, Array<MetricSample<PRAverageOutlierItem>>>();

    for (const pr of prs) {
      const period = this.toPeriodKey(pr.createdAt, mode);
      const start = this.toTimestamp(pr.createdAt);
      const end = this.toTimestamp(pr.mergedAt || pr.closedAt || pr.createdAt);
      const days = (end - start) / (1000 * 60 * 60 * 24);
      const existing = grouped.get(period) || [];
      existing.push(this.toPRSample(pr, days));
      grouped.set(period, existing);
    }

    return Array.from(grouped.entries())
      .map(([period, values]) => {
        const cleaned = this.cleanPRSamples(values, filters?.cleaning);
        return {
          period,
          avg_days: averageMetricSamples(cleaned.samples),
          outliers: this.shouldExposeOutliers(filters?.cleaning) ? cleaned.outliers : undefined,
        };
      })
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * Filter PRs by the provided criteria.
   */
  private async filterPRs(filters?: PRFilters): Promise<PRDetails[]> {
    return await this.prRepository.loadPrsWithFilters(filters);
  }

  private calculateOpenDays(pr: PRDetails): number {
    const created = new Date(pr.createdAt);
    const closed = pr.mergedAt
      ? new Date(pr.mergedAt)
      : pr.closedAt
        ? new Date(pr.closedAt)
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
    prs: PRDetails[],
    cleaning?: MetricCleaningOptions
  ): PRsByTimeframe {
    const cleanedOpenDays = this.cleanPRSamples(
      prs.map((pr) => this.toPRSample(pr, this.calculateOpenDays(pr))),
      cleaning
    );
    const averageOpenDays = averageMetricSamples(cleanedOpenDays.samples);

    const cleanedComments = this.cleanPRSamples(
      prs.map((pr) => this.toPRSample(pr, pr.totalComments || 0)),
      cleaning
    );
    const averageComments = averageMetricSamples(cleanedComments.samples);

    return {
      period,
      count: prs.length,
      averageOpenDays: Math.round(averageOpenDays * 100) / 100,
      averageComments: Math.round(averageComments * 100) / 100,
      outliers: this.shouldExposeOutliers(cleaning)
        ? {
            openDays: cleanedOpenDays.outliers,
            comments: cleanedComments.outliers,
          }
        : undefined,
    };
  }

  private extractTopThemes(prs: PRDetails[]): Array<{ text: string; value: number }> {
    const ngramCounts = new Map<string, number>();

    for (const pr of prs) {
      const commentsText = (pr.comments || [])
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

  private extractLabelSummary(prs: PRDetails[]): Array<{ label: string; prs: number }> {
    const labelToPrs = new Map<string, number>();

    for (const pr of prs) {
      // Count each label at most once per PR.
      const uniqueLabels = new Set(
        (pr.labels || [])
          .map((label) => (label.name || '').trim())
          .filter((name) => name.length > 0)
      );

      for (const label of uniqueLabels) {
        labelToPrs.set(label, (labelToPrs.get(label) || 0) + 1);
      }
    }

    return Array.from(labelToPrs.entries())
      .map(([label, count]) => ({ label, prs: count }))
      .sort((a, b) => b.prs - a.prs || a.label.localeCompare(b.label));
  }

  private extractCommentsByAuthor(prs: PRDetails[]): Array<{ author: string; count: number }> {
    const grouped = new Map<string, number>();

    for (const pr of prs) {
      for (const comment of pr.comments || []) {
        const author = comment.author?.login || 'unknown';
        grouped.set(author, (grouped.get(author) || 0) + 1);
      }
    }

    return Array.from(grouped.entries())
      .map(([author, count]) => ({ author, count }))
      .sort((a, b) => b.count - a.count || a.author.localeCompare(b.author));
  }

  private toSummaryPullRequest(pr: PRDetails): PRSummaryPullRequest {
    return {
      number: pr.number,
      title: pr.title,
      author: pr.author?.login || 'unknown',
      created: pr.createdAt,
      merged: pr.mergedAt,
      closed: pr.closedAt,
    };
  }

  private calculateFirstCommentTimeSummary(prs: PRDetails[]): PRSummaryFirstCommentTime {
    const hoursUntilFirstComment: number[] = [];

    for (const pr of prs) {
      if (!Array.isArray(pr.comments) || pr.comments.length === 0) {
        continue;
      }

      const firstComment = [...pr.comments]
        .filter((comment) => Boolean(comment.createdAt))
        .sort((a, b) => this.toTimestamp(a.createdAt) - this.toTimestamp(b.createdAt))[0];

      if (!firstComment) {
        continue;
      }

      const prOpenedAt = this.toTimestamp(pr.createdAt);
      const firstCommentAt = this.toTimestamp(firstComment.createdAt);
      if (prOpenedAt === 0 || firstCommentAt === 0 || firstCommentAt < prOpenedAt) {
        continue;
      }

      hoursUntilFirstComment.push((firstCommentAt - prOpenedAt) / (1000 * 60 * 60));
    }

    const sorted = [...hoursUntilFirstComment].sort((a, b) => a - b);
    const average =
      sorted.length > 0 ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : 0;
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length === 0
        ? 0
        : sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];

    return {
      average,
      median,
      min: sorted[0] || 0,
      max: sorted[sorted.length - 1] || 0,
      prs_with_comment: sorted.length,
      prs_without_comment: prs.length - sorted.length,
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
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async getCommentsByAuthor(
    filters?: PRFilters,
    top?: number
  ): Promise<Array<{ author: string; count: number }>> {
    const prs = await this.filterPRs(filters);
    const maxRows = top || 10;
    return this.extractCommentsByAuthor(prs).slice(0, maxRows);
  }

  async getFirstCommentTime(
    filters?: PRFilters,
    top?: number
  ): Promise<
    Array<{
      author: string;
      avg_hours: number;
      prs_with_comments: number;
      outliers?: Array<MetricOutlier<PRAverageOutlierItem>>;
    }>
  > {
    const prs = await this.filterPRs(filters);
    const grouped = new Map<string, Array<MetricSample<PRAverageOutlierItem>>>();

    for (const pr of prs) {
      if (!Array.isArray(pr.comments) || pr.comments.length === 0) {
        continue;
      }

      const firstComment = [...pr.comments]
        .filter((comment) => Boolean(comment.createdAt))
        .sort((a, b) => this.toTimestamp(a.createdAt) - this.toTimestamp(b.createdAt))[0];

      if (!firstComment) {
        continue;
      }

      const prOpenedAt = this.toTimestamp(pr.createdAt);
      const firstCommentAt = this.toTimestamp(firstComment.createdAt);
      if (prOpenedAt === 0 || firstCommentAt === 0 || firstCommentAt < prOpenedAt) {
        continue;
      }

      const author = pr.author?.login || 'unknown';
      const hours = (firstCommentAt - prOpenedAt) / (1000 * 60 * 60);
      const existing = grouped.get(author) || [];
      existing.push(this.toPRSample(pr, hours));
      grouped.set(author, existing);
    }

    const maxRows = top || 10;
    return Array.from(grouped.entries())
      .map(([author, values]) => {
        const cleaned = this.cleanPRSamples(values, filters?.cleaning);
        return {
          author,
          avg_hours: averageMetricSamples(cleaned.samples),
          prs_with_comments: cleaned.samples.length,
          outliers: this.shouldExposeOutliers(filters?.cleaning) ? cleaned.outliers : undefined,
        };
      })
      .sort((a, b) => b.avg_hours - a.avg_hours)
      .slice(0, maxRows);
  }

  private toPRSample(pr: PRDetails, value: number): MetricSample<PRAverageOutlierItem> {
    return {
      value,
      timestamp: pr.mergedAt || pr.closedAt || pr.createdAt,
      item: {
        id: pr.id,
        number: pr.number,
        title: pr.title,
        author: pr.author?.login || 'unknown',
        url: pr.url,
      },
    };
  }

  private cleanPRSamples(
    samples: Array<MetricSample<PRAverageOutlierItem>>,
    options?: MetricCleaningOptions
  ) {
    return cleanMetricSamples(samples, options);
  }

  private shouldExposeOutliers(options?: MetricCleaningOptions): boolean {
    return options?.outlierMode === 'flag' || options?.outlierMode === 'exclude';
  }
}
