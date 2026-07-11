import { Logger } from '@smmachine/utils';
import { IRepository, RepositoryFactory } from '../../infrastructure';
import { type IGithubPrsClient } from '.';
import { PullRequestCommentJsonResponse, PullRequestJsonResponse } from './github-response-types';
import { Configuration } from '../../';
import {
  PullRequestFilterOptions,
  PullRequestFiltersRepository,
} from '../../domain/prs/repositories/pull-request-filters-repository-json';

export interface IPullRequestsRepository {
  fetchPRs(options?: {
    startDate?: string;
    endDate?: string;
    forceRefresh?: boolean;
    incrementalUpdate?: boolean;
    rawFilters?: string;
  }): Promise<PullRequestJsonResponse[]>;

  fetchPRComments(
    prNumber: number,
    options?: { forceRefresh?: boolean; incrementalUpdate?: boolean }
  ): Promise<PullRequestCommentJsonResponse[]>;
}

export class GitHubPullRequestsFetchRepository implements IPullRequestsRepository {
  private pullRequestsJsonRepository: IRepository<PullRequestJsonResponse>;
  private pullRequestCommentsJsonRepository: IRepository<PullRequestCommentJsonResponse>;
  private pullRequestFiltersRepository: PullRequestFiltersRepository;

  constructor(
    private githubPrsClient: IGithubPrsClient,
    config: Configuration,
    private logger: Logger
  ) {
    const providerDir = config.getPathFromGitProvider();
    this.pullRequestsJsonRepository = RepositoryFactory.create<PullRequestJsonResponse>(
      `${providerDir}/prs.json`,
      logger,
      config
    );
    this.pullRequestCommentsJsonRepository =
      RepositoryFactory.create<PullRequestCommentJsonResponse>(
        `${providerDir}/pr-comments.json`,
        logger,
        config
      );
    const pullRequestFiltersJsonRepository = RepositoryFactory.create<PullRequestFilterOptions>(
      `${providerDir}/pull-request-filter-options.json`,
      logger,
      config
    );
    this.pullRequestFiltersRepository = new PullRequestFiltersRepository(
      this.pullRequestsJsonRepository,
      this.pullRequestCommentsJsonRepository,
      pullRequestFiltersJsonRepository
    );
  }

  /**
   * Refresh PR data from GitHub
   */
  async fetchPRs(options?: {
    startDate?: string;
    endDate?: string;
    forceRefresh?: boolean;
    incrementalUpdate?: boolean;
    rawFilters?: string;
  }): Promise<PullRequestJsonResponse[]> {
    const fromCache = await this.pullRequestsJsonRepository.loadAll();

    if (options?.incrementalUpdate && fromCache.length > 0) {
      const latestDate = this.findLatestDate(fromCache.map((pr) => pr.updated_at));
      this.logger.info(`Incremental update: fetching PRs updated after ${latestDate}...`);
      const freshPRs = await this.githubPrsClient.fetchPRs({
        startDate: latestDate,
        endDate: options?.endDate,
        rawFilters: options?.rawFilters,
      });
      const merged = this.mergePRs(fromCache, freshPRs);
      await this.pullRequestsJsonRepository.saveAll(merged);
      await this.refreshFilterOptions();
      return merged;
    }

    // Manual date range with merge
    if (
      (options?.startDate || options?.endDate) &&
      !options?.forceRefresh &&
      fromCache.length > 0
    ) {
      this.logger.info(
        `Fetching PRs for range [${options?.startDate || 'any'}..${options?.endDate || 'any'}] and merging with cache...`
      );
      const freshPRs = await this.githubPrsClient.fetchPRs({
        startDate: options?.startDate,
        endDate: options?.endDate,
        rawFilters: options?.rawFilters,
      });
      const merged = this.mergePRs(fromCache, freshPRs);
      await this.pullRequestsJsonRepository.saveAll(merged);
      await this.refreshFilterOptions();
      return merged;
    }

    if (!options?.forceRefresh && fromCache.length > 0) {
      this.logger.debug(`Using cached PRs: ${fromCache.length} records`);
      return fromCache;
    }

    this.logger.info('Fetching PRs from GitHub...');
    const freshPRs = await this.githubPrsClient.fetchPRs({
      startDate: options?.startDate,
      endDate: options?.endDate,
      rawFilters: options?.rawFilters,
    });

    // Persist fetched data to disk so subsequent commands can reuse cached data.
    await this.pullRequestsJsonRepository.saveAll(freshPRs);
    await this.refreshFilterOptions();

    return freshPRs;
  }

  private async refreshFilterOptions(): Promise<void> {
    await this.pullRequestFiltersRepository.refreshOptions();
  }

  private findLatestDate(dates: (string | undefined | null)[]): string {
    const valid = dates.filter((d): d is string => !!d).map((d) => new Date(d).getTime());
    if (valid.length === 0) return new Date(0).toISOString();
    return new Date(Math.max(...valid)).toISOString();
  }

  private mergePRs(
    existing: PullRequestJsonResponse[],
    incoming: PullRequestJsonResponse[]
  ): PullRequestJsonResponse[] {
    const map = new Map<string, PullRequestJsonResponse>();
    for (const pr of existing) map.set(pr.id, pr);
    for (const pr of incoming) map.set(pr.id, pr);
    return Array.from(map.values());
  }

  async fetchPRComments(
    prNumber: number,
    options?: { forceRefresh?: boolean; incrementalUpdate?: boolean }
  ): Promise<PullRequestCommentJsonResponse[]> {
    const fromCache = await this.pullRequestCommentsJsonRepository.loadAll();
    const cachedCommentsForPR = fromCache.filter((comment) =>
      comment.pull_request_url.includes(`/pulls/${prNumber}`)
    );

    if (options?.incrementalUpdate && cachedCommentsForPR.length > 0) {
      const latestDate = this.findLatestCommentDate(cachedCommentsForPR);
      this.logger.info(
        `Incremental update for PR #${prNumber}: fetching comments updated after ${latestDate}...`
      );
      const freshComments = await this.githubPrsClient.fetchPRComments(prNumber);
      const filtered = freshComments.filter(
        (c) => !c.updated_at || new Date(c.updated_at) >= new Date(latestDate)
      );
      const merged = this.mergeCommentsByIdForPR(cachedCommentsForPR, filtered);
      const otherComments = fromCache.filter(
        (comment) => !comment.pull_request_url.includes(`/pulls/${prNumber}`)
      );
      const updatedComments = otherComments.concat(merged);
      await this.pullRequestCommentsJsonRepository.saveAll(updatedComments);
      return merged;
    }

    if (!options?.forceRefresh && cachedCommentsForPR.length > 0) {
      this.logger.debug(
        `Using cached comments for PR #${prNumber}: ${cachedCommentsForPR.length} records`
      );
      return cachedCommentsForPR;
    }

    this.logger.info(`Fetching comments for PR #${prNumber} from GitHub...`);
    const freshComments = await this.githubPrsClient.fetchPRComments(prNumber);

    const updatedComments = fromCache
      .filter((comment) => !comment.pull_request_url.includes(`/pulls/${prNumber}`))
      .concat(freshComments);

    await this.pullRequestCommentsJsonRepository.saveAll(updatedComments);

    return freshComments;
  }

  private findLatestCommentDate(comments: PullRequestCommentJsonResponse[]): string {
    const dates = comments
      .map((c) => c.updated_at)
      .filter((d): d is string => !!d)
      .map((d) => new Date(d).getTime());
    if (dates.length === 0) return new Date(0).toISOString();
    return new Date(Math.max(...dates)).toISOString();
  }

  private mergeCommentsByIdForPR(
    existing: PullRequestCommentJsonResponse[],
    incoming: PullRequestCommentJsonResponse[]
  ): PullRequestCommentJsonResponse[] {
    const map = new Map<string, PullRequestCommentJsonResponse>();
    for (const comment of existing) map.set(String(comment.id), comment);
    for (const comment of incoming) map.set(String(comment.id), comment);
    return Array.from(map.values());
  }
}
