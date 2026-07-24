import type { AxiosInstance } from 'axios';
import axios from 'axios';
import type { Logger } from '@smmachine/utils';
import type {
  GitHubWorkflowJobFilters,
  GitHubWorkflowJobResponse,
  IGithubWorkflowJobClient,
} from './workflow-types';
import type { GitHubRateLimitManager } from './github-rate-limit-manager';
import type { WorkflowJobJsonResponse } from './github-response-types';
import { GithubClientRetriable } from './github-client-retriable';
import { RawFiltersParser } from './raw-filters-parser';

export class GithubWorkflowJobClient implements IGithubWorkflowJobClient {
  private axiosInstance: AxiosInstance;
  private logger: Logger;
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

  async fetchJobsPage(
    runId: string,
    page: number,
    perPage: number = 100,
    options?: GitHubWorkflowJobFilters
  ): Promise<GitHubWorkflowJobResponse> {
    const url = `/repos/${this.owner}/${this.repo}/actions/runs/${runId}/jobs`;
    const requestParams = {
      params: {
        per_page: perPage,
        page,
        ...this.rawFiltersParser.parse(options?.rawFilters),
      },
    };

    this.logger.info(`${url} ${JSON.stringify(requestParams.params)}`);

    const response = await this.retriableClient.rateLimitedGet<{
      jobs: WorkflowJobJsonResponse[];
    }>(url, requestParams);

    const jobs = response.data.jobs || [];
    const hasNext = this.hasNextLink(response.headers?.link) || jobs.length === perPage;
    return { jobs, hasNext };
  }

  private hasNextLink(linkHeader?: string): boolean {
    if (!linkHeader) {
      return false;
    }
    return linkHeader.includes('rel="next"');
  }
}
