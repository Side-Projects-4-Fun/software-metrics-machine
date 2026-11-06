import type { Logger } from '@smmachine/utils';
import type { IRepository, TimeZoneProvider } from '../../infrastructure';
import { RepositoryFactory, Configuration } from '../../infrastructure';
import type { Issue, IssueComment, IssueProvider } from '../../domain-types';
import type { IIssuesClient } from '../../providers/issues-client';

export interface IssueFilters {
  startDate?: string;
  endDate?: string;
  status?: string;
  labels?: string[];
  forceRefresh?: boolean;
  incrementalUpdate?: boolean;
}

export interface IssueCommentFilters {
  issueKey?: string;
  startDate?: string;
  endDate?: string;
  forceRefresh?: boolean;
  incrementalUpdate?: boolean;
}

export interface IIssuesRepository {
  readonly provider: IssueProvider;
  getIssues(filters?: IssueFilters): Promise<Issue[]>;
  getComments(filters?: IssueCommentFilters): Promise<IssueComment[]>;
}

/**
 * Combines a provider-neutral issue client with caching and filtering.
 *
 * Handles:
 * - Fetching issues and comments from the configured provider
 * - Caching both collections locally
 * - Merging incremental updates by id
 */
export class IssuesRepository implements IIssuesRepository {
  readonly provider: IssueProvider;
  private issuesJsonRepository: IRepository<Issue>;
  private commentsJsonRepository: IRepository<IssueComment>;
  private timeZoneProvider: TimeZoneProvider;

  constructor(
    private issuesClient: IIssuesClient,
    cacheDir: string,
    private logger: Logger,
    timeZoneProvider: TimeZoneProvider,
    private config: Configuration = new Configuration()
  ) {
    this.provider = issuesClient.provider;
    this.timeZoneProvider = timeZoneProvider;
    this.issuesJsonRepository = RepositoryFactory.create<Issue>(
      `${cacheDir}/issues.json`,
      logger,
      this.config
    );
    this.commentsJsonRepository = RepositoryFactory.create<IssueComment>(
      `${cacheDir}/comments.json`,
      logger,
      this.config
    );
  }

  /**
   * Refresh issue data from the configured provider.
   */
  async refreshIssues(options?: IssueFilters): Promise<Issue[]> {
    const fromCache = await this.issuesJsonRepository.loadAll();

    if (options?.incrementalUpdate && fromCache.length > 0) {
      const latestDate = this.findLatestDate(
        fromCache.map((issue) => issue.updatedAt ?? issue.createdAt)
      );
      this.logger.info(
        `Incremental update: fetching ${this.provider} issues updated after ${latestDate}...`
      );
      const freshIssues = await this.issuesClient.fetchIssues({
        startDate: latestDate,
        endDate: options.endDate,
        status: options.status,
        labels: options.labels,
      });
      const merged = this.mergeIssuesById(fromCache, freshIssues);
      await this.issuesJsonRepository.saveAll(merged);
      return this.applyFilters(merged, options);
    }

    if (
      (options?.startDate || options?.endDate) &&
      !options?.forceRefresh &&
      fromCache.length > 0
    ) {
      this.logger.info(
        `Fetching ${this.provider} issues for range [${options.startDate || 'any'}..${options.endDate || 'any'}] and merging with cache...`
      );
      const freshIssues = await this.issuesClient.fetchIssues({
        startDate: options.startDate,
        endDate: options.endDate,
        status: options.status,
        labels: options.labels,
      });
      const merged = this.mergeIssuesById(fromCache, freshIssues);
      await this.issuesJsonRepository.saveAll(merged);
      return this.applyFilters(merged, options);
    }

    if (!options?.forceRefresh && fromCache.length > 0) {
      this.logger.info(`Using cached ${this.provider} issues: ${fromCache.length} records`);
      return this.applyFilters(fromCache, options);
    }

    this.logger.info(`Fetching issues from ${this.provider}...`);
    const freshIssues = await this.issuesClient.fetchIssues({
      startDate: options?.startDate,
      endDate: options?.endDate,
      status: options?.status,
      labels: options?.labels,
    });

    await this.issuesJsonRepository.saveAll(freshIssues);

    return this.applyFilters(freshIssues, options);
  }

  /**
   * Get issues with optional filters.
   */
  async getIssues(filters?: IssueFilters): Promise<Issue[]> {
    return this.refreshIssues(filters);
  }

  /**
   * Refresh comments from the configured provider.
   *
   * With `issueKey`, only that issue's comments are fetched. Without it, every
   * comment created inside the requested window is fetched. `--update` merges
   * by comment id; `--force` replaces the cache.
   */
  async refreshComments(options?: IssueCommentFilters): Promise<IssueComment[]> {
    const fromCache = await this.commentsJsonRepository.loadAll();

    if (options?.issueKey) {
      return this.refreshIssueComments(options, fromCache);
    }

    const start = this.toStartBoundary(options?.startDate);
    const end = this.toEndBoundary(options?.endDate);

    if (options?.incrementalUpdate && fromCache.length > 0) {
      const latestDate = this.findLatestDate(
        fromCache.map((comment) => comment.updatedAt ?? comment.createdAt)
      );
      this.logger.info(
        `Incremental update: fetching ${this.provider} comments after ${latestDate}...`
      );
      const fresh = await this.issuesClient.fetchComments({
        startDate: latestDate,
        endDate: end,
      });
      const merged = this.mergeCommentsById(fromCache, fresh);
      await this.commentsJsonRepository.saveAll(merged);
      return this.applyCommentFilters(merged, options);
    }

    if ((start || end) && !options?.forceRefresh && fromCache.length > 0) {
      const fresh = await this.issuesClient.fetchComments({ startDate: start, endDate: end });
      const merged = this.mergeCommentsById(fromCache, fresh);
      await this.commentsJsonRepository.saveAll(merged);
      return this.applyCommentFilters(merged, options);
    }

    if (!options?.forceRefresh && fromCache.length > 0) {
      this.logger.info(`Using cached ${this.provider} comments: ${fromCache.length} records`);
      return this.applyCommentFilters(fromCache, options);
    }

    this.logger.info(`Fetching comments from ${this.provider}...`);
    const fresh = await this.issuesClient.fetchComments({ startDate: start, endDate: end });
    await this.commentsJsonRepository.saveAll(fresh);
    return this.applyCommentFilters(fresh, options);
  }

  /**
   * Get comments with optional filters.
   */
  async getComments(filters?: IssueCommentFilters): Promise<IssueComment[]> {
    return this.refreshComments(filters);
  }

  private async refreshIssueComments(
    options: IssueCommentFilters,
    fromCache: IssueComment[]
  ): Promise<IssueComment[]> {
    const issueKey = options.issueKey as string;
    const cachedForIssue = fromCache.filter((comment) => comment.issueKey === issueKey);

    if (!options.forceRefresh && !options.incrementalUpdate && cachedForIssue.length > 0) {
      this.logger.info(
        `Using cached ${this.provider} comments for ${issueKey}: ${cachedForIssue.length} records`
      );
      return cachedForIssue;
    }

    const fresh = await this.issuesClient.fetchComments({ issueKey });

    const base = options.forceRefresh
      ? fromCache.filter((comment) => comment.issueKey !== issueKey)
      : fromCache;
    const merged = this.mergeCommentsById(base, fresh);
    await this.commentsJsonRepository.saveAll(merged);

    return merged.filter((comment) => comment.issueKey === issueKey);
  }

  private toStartBoundary(value?: string): string | undefined {
    return value ? this.timeZoneProvider.getStartOfDayBoundary(value).toISOString() : undefined;
  }

  private toEndBoundary(value?: string): string | undefined {
    return value ? this.timeZoneProvider.getEndOfDayBoundary(value).toISOString() : undefined;
  }

  private findLatestDate(dates: (string | undefined | null)[]): string {
    const valid = dates
      .filter((date): date is string => !!date)
      .map((date) => new Date(date).getTime());
    if (valid.length === 0) return new Date(0).toISOString();
    return new Date(Math.max(...valid)).toISOString();
  }

  private mergeIssuesById(existing: Issue[], incoming: Issue[]): Issue[] {
    const map = new Map<string, Issue>();
    for (const issue of existing) map.set(issue.id, issue);
    for (const issue of incoming) map.set(issue.id, issue);
    return Array.from(map.values());
  }

  private mergeCommentsById(existing: IssueComment[], incoming: IssueComment[]): IssueComment[] {
    const map = new Map<string, IssueComment>();
    for (const comment of existing) map.set(comment.id, comment);
    for (const comment of incoming) map.set(comment.id, comment);
    return Array.from(map.values());
  }

  private applyFilters(issues: Issue[], filters?: IssueFilters): Issue[] {
    if (!filters) {
      return issues;
    }

    const start = this.toStartBoundary(filters.startDate);
    const end = this.toEndBoundary(filters.endDate);
    const status = filters.status?.toLowerCase();
    const labels = filters.labels?.map((label) => label.toLowerCase());

    return issues.filter((issue) => {
      if (start || end) {
        const createdAt = new Date(issue.createdAt);
        if (Number.isNaN(createdAt.getTime())) {
          return false;
        }
        if (start && createdAt < new Date(start)) return false;
        if (end && createdAt > new Date(end)) return false;
      }

      if (status && issue.status.toLowerCase() !== status) {
        return false;
      }

      if (labels && labels.length > 0) {
        const issueLabels = (issue.labels ?? []).map((label) => label.toLowerCase());
        if (!labels.some((label) => issueLabels.includes(label))) {
          return false;
        }
      }

      return true;
    });
  }

  private applyCommentFilters(
    comments: IssueComment[],
    filters?: IssueCommentFilters
  ): IssueComment[] {
    if (!filters) {
      return comments;
    }

    const start = this.toStartBoundary(filters.startDate);
    const end = this.toEndBoundary(filters.endDate);

    return comments.filter((comment) => {
      if (filters.issueKey && comment.issueKey !== filters.issueKey) {
        return false;
      }

      if (start || end) {
        const createdAt = new Date(comment.createdAt);
        if (Number.isNaN(createdAt.getTime())) {
          return false;
        }
        if (start && createdAt < new Date(start)) return false;
        if (end && createdAt > new Date(end)) return false;
      }

      return true;
    });
  }
}
