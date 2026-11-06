import type { AxiosInstance } from 'axios';
import axios from 'axios';
import type { Issue, IssueComment } from '../../domain-types';
import type { Logger } from '@smmachine/utils';
import type { IIssuesClient, IssueCommentQueryOptions, IssueQueryOptions } from '../issues-client';
import { adfToPlainText } from './adf-to-text';

function toJiraDateBoundary(value: string): string {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }

  return value;
}

function escapeJqlString(value: string): string {
  return value.replace(/"/g, '\\"');
}

type JiraIssueResponse = {
  key: string;
  self?: string;
  fields?: {
    summary?: string;
    status?: { name?: string };
    created?: string;
    updated?: string;
    assignee?: { displayName?: string } | null;
    labels?: string[];
    description?: unknown;
  };
};

type JiraCommentResponse = {
  id: string;
  self?: string;
  author?: { displayName?: string };
  body?: unknown;
  created?: string;
  updated?: string;
};

type JiraCommentPage = {
  comments?: JiraCommentResponse[];
  total?: number;
  startAt?: number;
  maxResults?: number;
};

const COMMENT_PAGE_SIZE = 100;
const COMMENT_FETCH_CONCURRENCY = 5;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await mapper(items[current]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

/**
 * Jira API client for issues and comments.
 *
 * Real implementation using Jira REST API v3:
 *   - GET /rest/api/3/search/jql - Search/list issues with JQL
 *   - GET /rest/api/3/issue/{issueIdOrKey}/comment - Get issue comments
 *
 * Jira has no repository-wide comment endpoint. Bulk comment fetching resolves
 * candidate parent issues through JQL and then pages each issue's comments.
 */
export class JiraIssuesClient implements IIssuesClient {
  readonly provider = 'jira' as const;
  private axiosInstance: AxiosInstance;
  private logger: Logger;

  constructor(
    private url: string,
    private email: string,
    private token: string,
    private project: string | undefined,
    logger: Logger
  ) {
    this.logger = logger;

    const baseURL = this.url.endsWith('/') ? this.url.slice(0, -1) : this.url;

    this.axiosInstance = axios.create({
      baseURL,
      headers: {
        Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  async fetchIssues(options?: IssueQueryOptions): Promise<Issue[]> {
    const project = options?.project || this.project;
    const jqlParts: string[] = [];

    if (project) {
      jqlParts.push(`project = "${escapeJqlString(project)}"`);
    }

    if (options?.startDate) {
      jqlParts.push(`created >= "${toJiraDateBoundary(options.startDate)}"`);
    }

    if (options?.endDate) {
      jqlParts.push(`created <= "${toJiraDateBoundary(options.endDate)}"`);
    }

    if (options?.status) {
      jqlParts.push(`status = "${escapeJqlString(options.status)}"`);
    }

    if (options?.issueType) {
      jqlParts.push(`type = "${escapeJqlString(options.issueType)}"`);
    }

    if (options?.labels && options.labels.length > 0) {
      const labels = options.labels.map((label) => `"${escapeJqlString(label)}"`).join(', ');
      jqlParts.push(`labels in (${labels})`);
    }

    const jql = jqlParts.length > 0 ? jqlParts.join(' AND ') : '';
    this.logger.info(`Fetching Jira issues with JQL: ${jql || '(no filters)'}`);

    try {
      return await this.searchIssues(jql);
    } catch (error) {
      throw this.toActionableError(error, 'fetch Jira issues');
    }
  }

  async fetchComments(options?: IssueCommentQueryOptions): Promise<IssueComment[]> {
    try {
      return await this.fetchCommentsInternal(options);
    } catch (error) {
      throw this.toActionableError(error, 'fetch Jira comments');
    }
  }

  private async fetchCommentsInternal(options?: IssueCommentQueryOptions): Promise<IssueComment[]> {
    if (options?.issueKey) {
      return this.fetchCommentsForIssue(options.issueKey);
    }

    const project = this.project;
    const jqlParts: string[] = [];

    if (project) {
      jqlParts.push(`project = "${escapeJqlString(project)}"`);
    }

    if (options?.startDate) {
      jqlParts.push(`updated >= "${toJiraDateBoundary(options.startDate)}"`);
    }

    if (options?.endDate) {
      jqlParts.push(`updated <= "${toJiraDateBoundary(options.endDate)}"`);
    }

    const jql = jqlParts.length > 0 ? jqlParts.join(' AND ') : '';
    this.logger.info(
      `Fetching Jira comments for issues matching: ${jql || '(all issues)'} (N+1 per issue)`
    );

    const issues = await this.searchIssues(jql);
    this.logger.info(`Resolved ${issues.length} Jira issues to scan for comments`);

    const commentsPerIssue = await mapWithConcurrency(issues, COMMENT_FETCH_CONCURRENCY, (issue) =>
      this.fetchCommentsForIssue(issue.key ?? issue.id)
    );

    const start = options?.startDate ? new Date(options.startDate).getTime() : null;
    const end = options?.endDate ? new Date(options.endDate).getTime() : null;

    return commentsPerIssue.flat().filter((comment) => {
      const createdAt = new Date(comment.createdAt).getTime();
      if (Number.isNaN(createdAt)) {
        return false;
      }
      if (start !== null && createdAt < start) {
        return false;
      }
      if (end !== null && createdAt > end) {
        return false;
      }
      return true;
    });
  }

  private async searchIssues(jql: string): Promise<Issue[]> {
    const allIssues: Issue[] = [];
    let startAt = 0;
    const maxResults = 100;

    while (true) {
      this.logger.info(`Fetching Jira issues (startAt: ${startAt}, maxResults: ${maxResults})`);

      const response = await this.axiosInstance.get('/rest/api/3/search/jql', {
        params: {
          jql,
          startAt,
          maxResults,
          fields: [
            'key',
            'summary',
            'status',
            'created',
            'updated',
            'assignee',
            'creator',
            'issuetype',
            'priority',
            'labels',
          ],
        },
      });

      const { issues, total } = response.data as {
        issues?: JiraIssueResponse[];
        total?: number;
      };

      if (!issues || issues.length === 0) {
        break;
      }

      for (const issue of issues) {
        allIssues.push({
          id: issue.key,
          key: issue.key,
          title: issue.fields?.summary ?? '',
          status: issue.fields?.status?.name || 'UNKNOWN',
          createdAt: issue.fields?.created ?? '',
          description: adfToPlainText(issue.fields?.description) || undefined,
          assignee: issue.fields?.assignee?.displayName || 'Unassigned',
          labels: issue.fields?.labels || [],
          provider: 'jira',
          url: this.url ? `${this.url.replace(/\/$/, '')}/browse/${issue.key}` : undefined,
          updatedAt: issue.fields?.updated,
        });
      }

      if (typeof total !== 'number' || startAt + maxResults >= total) {
        break;
      }

      startAt += maxResults;
    }

    this.logger.info(`Fetched ${allIssues.length} Jira issues total`);
    return allIssues;
  }

  private async fetchCommentsForIssue(issueKey: string): Promise<IssueComment[]> {
    const allComments: IssueComment[] = [];
    let startAt = 0;

    while (true) {
      const response = await this.axiosInstance.get(
        `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`,
        {
          params: { startAt, maxResults: COMMENT_PAGE_SIZE },
        }
      );

      const page = response.data as JiraCommentPage;
      const comments = page.comments ?? [];

      for (const comment of comments) {
        allComments.push({
          id: String(comment.id),
          issueKey,
          author: comment.author?.displayName,
          body: adfToPlainText(comment.body),
          createdAt: comment.created ?? '',
          updatedAt: comment.updated,
          url: comment.self,
          provider: 'jira',
        });
      }

      const total = page.total ?? Number.POSITIVE_INFINITY;
      if (comments.length === 0 || startAt + comments.length >= total) {
        break;
      }

      startAt += comments.length;
    }

    return allComments;
  }

  private toActionableError(error: unknown, action: string): Error {
    const errorMsg = error instanceof Error ? error.message : String(error);
    this.logger.error(`Failed to ${action}: ${errorMsg}`);

    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        return new Error('Jira authentication failed. Check email and token.');
      }
      if (error.response?.status === 404) {
        return new Error('Jira project or issue not found, or API endpoint not accessible.');
      }
      if (error.code === 'ECONNABORTED') {
        return new Error('Jira API request timeout (30s).');
      }
    }

    return error instanceof Error ? error : new Error(errorMsg);
  }
}
