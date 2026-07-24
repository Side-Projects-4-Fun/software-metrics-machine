import type { AxiosInstance } from 'axios';
import axios from 'axios';
import type { Logger } from '@smmachine/utils';
import type { PipelineRun } from '../../domain';
import type { GitHubWorkflowResponse, IGithubWorkflowClient } from './workflow-types';
import type { WorkflowJsonResponse } from './github-response-types';
import type { GitHubRateLimitManager } from './github-rate-limit-manager';
import { buildCreatedFilter, toISODateString } from './github-date-utils';
import { GithubClientRetriable } from './github-client-retriable';
import { RawFiltersParser } from './raw-filters-parser';

function isDateOnly(value?: string): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export class GithubWorkflowClient implements IGithubWorkflowClient {
  private readonly axiosInstance: AxiosInstance;
  private readonly logger: Logger;
  private readonly baseUrl = 'https://api.github.com';
  private readonly retriableClient: GithubClientRetriable;
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

  async fetchWorkflows(options?: {
    startDate?: string;
    endDate?: string;
    rawFilters?: string;
    byDay?: boolean;
  }): Promise<PipelineRun[]> {
    const allRuns: PipelineRun[] = [];

    try {
      if (options?.byDay && isDateOnly(options?.startDate) && isDateOnly(options?.endDate)) {
        // Fetch workflows day by day
        const days = this.generateDayRange(options.startDate, options.endDate);
        this.logger.info(`Fetching workflows by day: ${days.length} day(s)`);

        for (const day of days) {
          const dayRuns = await this.fetchWorkflowsForDay(day.start, day.end, options.rawFilters);
          allRuns.push(...dayRuns);
        }
      } else {
        // Fetch workflows with original behavior (all at once)
        const dayRuns = await this.fetchWorkflowsForDay(
          options?.startDate,
          options?.endDate,
          options?.rawFilters
        );
        allRuns.push(...dayRuns);
      }

      this.logger.info(`Fetched ${allRuns.length} workflow runs total`);
      return allRuns;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `GitHub API error fetching workflows: ${error.response?.status} - ${error.response?.statusText}`
        );
        if (error.response?.status === 401) {
          throw new Error('GitHub authentication failed - invalid token');
        }
        throw new Error(`Failed to fetch workflows: ${error.message}`);
      }
      throw error;
    }
  }

  private async fetchWorkflowsForDay(
    startDate?: string,
    endDate?: string,
    rawFilters?: string
  ): Promise<PipelineRun[]> {
    const per_page = 100;
    let page = 1;
    const dayRuns: PipelineRun[] = [];

    while (true) {
      this.logger.info(`Fetching workflow runs page ${page} for ${this.owner}/${this.repo}`);

      const optionsParams: { created?: string; rawFilters?: string } = {
        rawFilters,
      };

      const created = buildCreatedFilter(startDate, endDate);
      if (created) {
        optionsParams.created = created;
      }

      const response = await this.fetchWorkflowRunsPage(page, per_page, optionsParams);
      const runs = response.runs;

      if (!runs || runs.length === 0) {
        break; // No more runs
      }

      for (const run of runs) {
        dayRuns.push({
          ...run,
          commit: run.head_sha,
          jobs: [],
          number: Number(run.run_number),
          createdAt: run.created_at,
          updatedAt: run.updated_at,
          startedAt: run.run_started_at,
          completedAt: run.updated_at,
          branch: run.head_branch,
          path: run.path,
        });
      }

      if (page < 0) break;
      if (!response.hasNext) break;

      page++;
    }

    return dayRuns;
  }

  private generateDayRange(
    startDate: string,
    endDate: string
  ): Array<{ start: string; end: string }> {
    const days: Array<{ start: string; end: string }> = [];
    const current = new Date(toISODateString(startDate, 'start'));
    const end = new Date(toISODateString(endDate, 'end'));

    while (current <= end) {
      const dayStart = new Date(current);
      dayStart.setUTCHours(0, 0, 0, 0);

      const dayEnd = new Date(current);
      dayEnd.setUTCHours(23, 59, 59, 999);

      days.push({
        start: dayStart.toISOString().split('T')[0] + 'T00:00:00Z',
        end: dayEnd.toISOString().split('T')[0] + 'T23:59:59Z',
      });

      current.setUTCDate(current.getUTCDate() + 1);
    }

    return days;
  }

  async fetchWorkflowRunsPage(
    page: number,
    perPage: number = 100,
    options?: { created?: string; rawFilters?: string }
  ): Promise<GitHubWorkflowResponse> {
    const requestParams = {
      params: {
        per_page: perPage,
        page,
        ...(options?.created ? { created: options.created } : {}),
        ...this.rawFiltersParser.parse(options?.rawFilters),
      },
    };
    const url = `/repos/${this.owner}/${this.repo}/actions/runs`;

    this.logger.info(`${url} ${JSON.stringify(requestParams.params)}`);

    const response = await this.retriableClient.rateLimitedGet<{
      workflow_runs: WorkflowJsonResponse[];
    }>(url, requestParams);

    const runs = response.data.workflow_runs || [];
    this.logger.info(`Fetched ${runs.length} workflow runs on page ${page}`);

    const hasNext = this.hasNextLink(response.headers?.link) || runs.length === perPage;
    return { runs, hasNext };
  }

  private hasNextLink(linkHeader?: string): boolean {
    if (!linkHeader) {
      return false;
    }
    return linkHeader.includes('rel="next"');
  }
}
