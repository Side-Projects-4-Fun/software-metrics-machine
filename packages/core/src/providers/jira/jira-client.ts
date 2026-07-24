import type { AxiosInstance } from 'axios';
import axios from 'axios';
import type { Issue } from '../../domain-types';
import type { Logger } from '@smmachine/utils';

function toJiraDateBoundary(value: string): string {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }

  return value;
}

export interface IJiraIssuesClient {
  fetchIssues(options?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    issueType?: string;
    project?: string;
  }): Promise<Issue[]>;

  fetchIssueChanges(issueKey: string): Promise<unknown[]>;

  fetchIssueComments(issueKey: string): Promise<unknown[]>;
}

/**
 * Jira API client for Issues
 * Real implementation using Jira REST API v3
 * Endpoints utilized:
 *   - GET /rest/api/3/search/jql - Search/list issues with JQL
 *   - GET /rest/api/3/issue/{issueIdOrKey} - Get single issue with changelog
 *   - GET /rest/api/3/issue/{issueIdOrKey}/comment - Get issue comments
 */
export class JiraIssuesClient implements IJiraIssuesClient {
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

    // Ensure URL ends without slash for consistency
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

  async fetchIssues(options?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    issueType?: string;
    project?: string;
  }): Promise<Issue[]> {
    const project = options?.project || this.project;
    const allIssues: Issue[] = [];
    let startAt = 0;
    const maxResults = 100;

    try {
      // Build JQL query
      const jqlParts: string[] = [];

      if (project) {
        jqlParts.push(`project = "${project}"`);
      }

      if (options?.startDate) {
        jqlParts.push(`created >= "${toJiraDateBoundary(options.startDate)}"`);
      }

      if (options?.endDate) {
        jqlParts.push(`created <= "${toJiraDateBoundary(options.endDate)}"`);
      }

      if (options?.status) {
        jqlParts.push(`status = "${options.status}"`);
      }

      if (options?.issueType) {
        jqlParts.push(`type = "${options.issueType}"`);
      }

      const jql = jqlParts.length > 0 ? jqlParts.join(' AND ') : ''; // Empty returns all if no filters

      this.logger.info(`Fetching Jira issues with JQL: ${jql || '(no filters)'}`);

      // Fetch all issues with pagination
      while (true) {
        this.logger.info(`Fetching Jira issues (startAt: ${startAt}, maxResults: ${maxResults})`);

        const response = await this.axiosInstance.get('/rest/api/3/search/jql', {
          params: {
            jql,
            startAt,
            maxResults,
            expand: 'changelog',
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

        const { issues, total } = response.data;

        if (!issues || issues.length === 0) {
          break; // No more issues
        }

        // Keep the full Jira payload and add compatibility aliases.
        for (const issue of issues) {
          const domainIssue: Issue = {
            ...issue,
            id: issue.key,
            key: issue.key,
            title: issue.fields?.summary,
            status: issue.fields?.status?.name || 'UNKNOWN',
            createdAt: issue.fields?.created,
            description: issue.fields?.description,
            assignee: issue.fields?.assignee?.displayName || 'Unassigned',
            labels: issue.fields?.labels || [],
          };

          allIssues.push(domainIssue);
        }

        // Check if there are more issues to fetch
        if (startAt + maxResults >= total) {
          break;
        }

        startAt += maxResults;
      }

      this.logger.info(`Fetched ${allIssues.length} Jira issues total`);
      return allIssues;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to fetch Jira issues: ${errorMsg}`);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Jira authentication failed. Check email and token.');
        } else if (error.response?.status === 404) {
          throw new Error('Jira project not found or API endpoint not accessible.');
        } else if (error.code === 'ECONNABORTED') {
          throw new Error('Jira API request timeout (30s).');
        }
      }

      throw error;
    }
  }

  async fetchIssueChanges(issueKey: string): Promise<unknown[]> {
    try {
      this.logger.info(`Fetching changelog for Jira issue: ${issueKey}`);

      const response = await this.axiosInstance.get(`/rest/api/3/issue/${issueKey}`, {
        params: {
          expand: 'changelog',
        },
      });

      const changelog = response.data.changelog?.histories || [];
      this.logger.info(`Fetched ${changelog.length} changelog entries for ${issueKey}`);

      return changelog;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to fetch changelog for ${issueKey}: ${errorMsg}`);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error(`Jira issue ${issueKey} not found.`);
        }
      }

      throw error;
    }
  }

  async fetchIssueComments(issueKey: string): Promise<unknown[]> {
    try {
      this.logger.info(`Fetching comments for Jira issue: ${issueKey}`);

      const response = await this.axiosInstance.get(`/rest/api/3/issue/${issueKey}/comment`);

      const comments = response.data.comments || [];
      this.logger.info(`Fetched ${comments.length} comments for ${issueKey}`);

      return comments;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to fetch comments for ${issueKey}: ${errorMsg}`);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error(`Jira issue ${issueKey} not found.`);
        }
      }

      throw error;
    }
  }
}
