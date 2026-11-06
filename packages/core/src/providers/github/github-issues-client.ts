import type { AxiosInstance } from 'axios';
import axios from 'axios';
import type { Logger } from '@smmachine/utils';
import type { Issue, IssueComment } from '../../domain-types';
import type { IIssuesClient, IssueCommentQueryOptions, IssueQueryOptions } from '../issues-client';
import type {
  GitHubIssueCommentJsonResponse,
  GitHubIssueJsonResponse,
} from './github-response-types';
import type { GitHubRateLimitManager } from './github-rate-limit-manager';
import { GithubClientRetriable } from './github-client-retriable';

type IssueState = 'open' | 'closed' | 'all';

const PAGE_SIZE = 100;

function normalizeState(status?: string): IssueState {
  const normalized = status?.toLowerCase();
  if (normalized === 'open' || normalized === 'closed' || normalized === 'all') {
    return normalized;
  }
  return 'all';
}

function isWithinWindow(value: string | undefined, start?: string, end?: string): boolean {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return false;
  }

  if (start) {
    const startTimestamp = new Date(start).getTime();
    if (!Number.isNaN(startTimestamp) && timestamp < startTimestamp) {
      return false;
    }
  }

  if (end) {
    const endTimestamp = new Date(end).getTime();
    if (!Number.isNaN(endTimestamp) && timestamp > endTimestamp) {
      return false;
    }
  }

  return true;
}

function normalizeLabels(labels: GitHubIssueJsonResponse['labels']): string[] {
  return labels.map((label) => (typeof label === 'string' ? label : label.name));
}

function extractIssueNumber(value: string): string | undefined {
  const match = value.match(/\/issues\/(\d+)/);
  return match ? match[1] : undefined;
}

/**
 * GitHub API client for issues and issue comments.
 *
 * Endpoints:
 *   - GET /repos/{owner}/{repo}/issues
 *   - GET /repos/{owner}/{repo}/issues/{number}/comments
 *   - GET /repos/{owner}/{repo}/issues/comments (repository-wide)
 *
 * GitHub returns pull requests from the `/issues` endpoint. Every entry that
 * carries a `pull_request` field is filtered out.
 */
export class GitHubIssuesClient implements IIssuesClient {
  readonly provider = 'github' as const;
  private readonly axiosInstance: AxiosInstance;
  private readonly retriableClient: GithubClientRetriable;
  private readonly logger: Logger;

  constructor(
    token: string,
    private owner: string,
    private repo: string,
    rateLimitManager: GitHubRateLimitManager,
    logger: Logger
  ) {
    this.logger = logger;
    this.axiosInstance = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
      timeout: 30000,
    });
    this.retriableClient = new GithubClientRetriable(this.axiosInstance, rateLimitManager, logger);
  }

  async fetchIssues(options?: IssueQueryOptions): Promise<Issue[]> {
    try {
      return await this.fetchIssuesInternal(options);
    } catch (error) {
      throw this.toActionableError(error, 'fetch GitHub issues');
    }
  }

  async fetchComments(options?: IssueCommentQueryOptions): Promise<IssueComment[]> {
    try {
      if (options?.issueKey) {
        return await this.fetchCommentsForIssue(options.issueKey);
      }
      return await this.fetchAllComments(options?.startDate, options?.endDate);
    } catch (error) {
      throw this.toActionableError(error, 'fetch GitHub issue comments');
    }
  }

  private async fetchIssuesInternal(options?: IssueQueryOptions): Promise<Issue[]> {
    const state = normalizeState(options?.status);
    const issues: Issue[] = [];
    let page = 1;

    while (true) {
      this.logger.info(
        `Fetching GitHub issues page ${page} for ${this.owner}/${this.repo} (state: ${state})`
      );

      const response = await this.retriableClient.rateLimitedGet<GitHubIssueJsonResponse[]>(
        `/repos/${this.owner}/${this.repo}/issues`,
        {
          params: {
            state,
            sort: 'created',
            direction: 'asc',
            per_page: PAGE_SIZE,
            page,
            since: options?.startDate,
            labels: options?.labels?.join(',') || undefined,
          },
        }
      );

      const batch = response.data;
      if (batch.length === 0) {
        break;
      }

      for (const item of batch) {
        if (item.pull_request) {
          continue;
        }

        if (!isWithinWindow(item.created_at, options?.startDate, options?.endDate)) {
          continue;
        }

        if (!this.matchesStatus(item, options?.status)) {
          continue;
        }

        issues.push(this.toDomainIssue(item));
      }

      const lastCreatedAt = batch[batch.length - 1]?.created_at;
      if (
        options?.endDate &&
        lastCreatedAt &&
        new Date(lastCreatedAt).getTime() > new Date(options.endDate).getTime()
      ) {
        break;
      }

      if (batch.length < PAGE_SIZE) {
        break;
      }

      page += 1;
    }

    this.logger.info(`Fetched ${issues.length} GitHub issues total`);
    return issues;
  }

  private async fetchCommentsForIssue(issueKey: string): Promise<IssueComment[]> {
    const issueNumber = issueKey.replace(/^#/, '');
    const comments: IssueComment[] = [];
    let page = 1;

    while (true) {
      const response = await this.retriableClient.rateLimitedGet<GitHubIssueCommentJsonResponse[]>(
        `/repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments`,
        { params: { per_page: PAGE_SIZE, page } }
      );

      const batch = response.data;
      if (batch.length === 0) {
        break;
      }

      for (const comment of batch) {
        comments.push(this.toDomainComment(comment, issueNumber));
      }

      if (batch.length < PAGE_SIZE) {
        break;
      }

      page += 1;
    }

    this.logger.info(`Fetched ${comments.length} comments for GitHub issue #${issueNumber}`);
    return comments;
  }

  private async fetchAllComments(startDate?: string, endDate?: string): Promise<IssueComment[]> {
    const comments: IssueComment[] = [];
    let page = 1;

    while (true) {
      this.logger.info(
        `Fetching GitHub issue comments page ${page} for ${this.owner}/${this.repo}`
      );

      const response = await this.retriableClient.rateLimitedGet<GitHubIssueCommentJsonResponse[]>(
        `/repos/${this.owner}/${this.repo}/issues/comments`,
        {
          params: {
            sort: 'created',
            direction: 'asc',
            per_page: PAGE_SIZE,
            page,
            since: startDate,
          },
        }
      );

      const batch = response.data;
      if (batch.length === 0) {
        break;
      }

      for (const comment of batch) {
        if (comment.html_url.includes('/pull/')) {
          continue;
        }

        if (!isWithinWindow(comment.created_at, startDate, endDate)) {
          continue;
        }

        const issueKey = extractIssueNumber(comment.issue_url);
        if (!issueKey) {
          continue;
        }

        comments.push(this.toDomainComment(comment, issueKey));
      }

      const lastCreatedAt = batch[batch.length - 1]?.created_at;
      if (
        endDate &&
        lastCreatedAt &&
        new Date(lastCreatedAt).getTime() > new Date(endDate).getTime()
      ) {
        break;
      }

      if (batch.length < PAGE_SIZE) {
        break;
      }

      page += 1;
    }

    this.logger.info(`Fetched ${comments.length} GitHub issue comments total`);
    return comments;
  }

  private matchesStatus(issue: GitHubIssueJsonResponse, status?: string): boolean {
    if (!status) {
      return true;
    }

    const normalized = status.toLowerCase();
    if (normalized === 'open' || normalized === 'closed' || normalized === 'all') {
      return normalized === 'all' || issue.state === normalized;
    }

    return issue.state.toLowerCase() === normalized;
  }

  private toDomainIssue(issue: GitHubIssueJsonResponse): Issue {
    return {
      id: String(issue.id),
      key: String(issue.number),
      title: issue.title,
      description: issue.body ?? undefined,
      status: issue.state,
      assignee: issue.assignee?.login ?? 'Unassigned',
      createdAt: issue.created_at,
      labels: normalizeLabels(issue.labels),
      provider: 'github',
      url: issue.html_url,
      updatedAt: issue.updated_at,
      closedAt: issue.closed_at ?? undefined,
    };
  }

  private toDomainComment(comment: GitHubIssueCommentJsonResponse, issueKey: string): IssueComment {
    return {
      id: String(comment.id),
      issueKey,
      author: comment.user?.login,
      body: comment.body ?? '',
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      url: comment.html_url,
      provider: 'github',
    };
  }

  private toActionableError(error: unknown, action: string): Error {
    const errorMsg = error instanceof Error ? error.message : String(error);
    this.logger.error(`Failed to ${action}: ${errorMsg}`);

    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        return new Error('GitHub authentication failed - invalid token');
      }
      if (error.response?.status === 404 || error.response?.status === 410) {
        return new Error('GitHub repository or issue not found');
      }
      if (error.code === 'ECONNABORTED') {
        return new Error('GitHub API request timeout (30s).');
      }
    }

    return error instanceof Error ? error : new Error(errorMsg);
  }
}
