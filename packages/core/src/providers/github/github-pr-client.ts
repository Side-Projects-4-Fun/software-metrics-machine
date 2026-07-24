import type { AxiosInstance } from 'axios';
import axios from 'axios';
import type { Logger } from '@smmachine/utils';
import type {
  PullRequestCommentJsonResponse,
  PullRequestJsonResponse,
} from './github-response-types';
import type { GitHubRateLimitManager } from './github-rate-limit-manager';
import { GithubClientRetriable } from './github-client-retriable';
import { RawFiltersParser } from './raw-filters-parser';

type PrStatuses = 'open' | 'closed' | 'all' | 'draft' | 'merged';

export interface IGithubPrsClient {
  fetchPRs(options?: {
    startDate?: string;
    endDate?: string;
    state?: PrStatuses;
    rawFilters?: string;
  }): Promise<PullRequestJsonResponse[]>;

  fetchPRComments(prNumber: number): Promise<PullRequestCommentJsonResponse[]>;
}

/**
 * GitHub API client for Pull Requests
 * Real implementation using GitHub REST API v3
 * Endpoints utilized:
 *   - GET /repos/{owner}/{repo}/pulls - List PRs with state filtering
 *   - GET /repos/{owner}/{repo}/pulls/{pull_number}/comments - Get PR comments
 */
export class GithubPrsClient implements IGithubPrsClient {
  private readonly axiosInstance: AxiosInstance;
  private logger: Logger;
  private readonly baseUrl = 'https://api.github.com';
  private retriableClient: GithubClientRetriable;
  private readonly rawFiltersParser = new RawFiltersParser();

  constructor(
    token: string,
    private owner: string,
    private repo: string,
    private rateLimitManager: GitHubRateLimitManager,
    logger: Logger
  ) {
    this.logger = logger;

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
      timeout: 30000,
    });

    this.retriableClient = new GithubClientRetriable(
      this.axiosInstance,
      this.rateLimitManager,
      logger
    );
  }

  async fetchPRs(options?: {
    startDate?: string;
    endDate?: string;
    state?: PrStatuses;
    rawFilters?: string;
  }): Promise<PullRequestJsonResponse[]> {
    const state = options?.state || 'all';
    const per_page = 100;
    let page = 1;
    const allPRs: PullRequestJsonResponse[] = [];

    try {
      // Fetch all PRs with pagination (newest first by created_at)
      while (true) {
        this.logger.info(
          `Fetching PRs page ${page} for ${this.owner}/${this.repo} (state: ${state})`
        );

        const response = await this.retriableClient.rateLimitedGet<PullRequestJsonResponse[]>(
          `/repos/${this.owner}/${this.repo}/pulls`,
          {
            params: {
              state,
              sort: 'created',
              direction: 'desc',
              per_page,
              page,
              ...this.rawFiltersParser.parse(options?.rawFilters),
            },
          }
        );

        const prs = response.data;

        if (prs.length === 0) {
          break; // No more pages
        }

        // Keep the full GitHub payload and add compatibility aliases.
        for (const pr of prs) {
          const prDetail: PullRequestJsonResponse = { ...pr };

          if (options?.startDate && new Date(pr.created_at) < new Date(options.startDate)) {
            break;
          }

          if (!options?.endDate || new Date(pr.created_at) <= new Date(options.endDate)) {
            allPRs.push(prDetail);
          }
        }

        // Stop if we got fewer items than requested (last page)
        if (prs.length < per_page) {
          break;
        }

        page++;
      }

      this.logger.info(`Fetched ${allPRs.length} PRs total`);
      return allPRs;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `GitHub API error fetching PRs: ${error.response?.status} - ${error.response?.statusText}`
        );
        if (error.response?.status === 401) {
          throw new Error('GitHub authentication failed - invalid token');
        }
        throw new Error(`Failed to fetch PRs: ${error.message}`);
      }
      throw error;
    }
  }

  async fetchPRComments(prNumber: number): Promise<PullRequestCommentJsonResponse[]> {
    let allComments: PullRequestCommentJsonResponse[] = [];
    let page = 1;
    const per_page = 100;

    try {
      while (true) {
        this.logger.info(
          `Fetching comments for PR #${prNumber} page ${page} in ${this.owner}/${this.repo}`
        );

        const response = await this.retriableClient.rateLimitedGet<
          PullRequestCommentJsonResponse[]
        >(`/repos/${this.owner}/${this.repo}/pulls/${prNumber}/comments`, {
          params: {
            per_page,
            page,
          },
        });

        const comments: PullRequestCommentJsonResponse[] = response.data.map(
          (comment: PullRequestCommentJsonResponse) => comment
        );

        if (comments.length === 0) {
          break; // No more pages
        }

        allComments = allComments.concat(comments);

        if (comments.length < per_page) {
          break; // Last page
        }

        page++;
      }

      this.logger.info(`Fetched ${allComments.length} comments for PR #${prNumber} total`);
      return allComments;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`GitHub API error fetching PR comments: ${error.message}`);
        throw new Error(`Failed to fetch PR comments: ${error.message}`);
      }
      throw error;
    }
  }
}
