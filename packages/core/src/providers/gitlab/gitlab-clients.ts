import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Logger } from '@smmachine/utils';
import type {
  PullRequestCommentJsonResponse,
  PullRequestJsonResponse,
  WorkflowJobJsonResponse,
  WorkflowJsonResponse,
} from '../github/github-response-types';
import type {
  GitHubWorkflowJobResponse,
  GitHubWorkflowResponse,
  IGithubWorkflowClient,
  IGithubWorkflowJobClient,
} from '../github/workflow-types';
import type { IGithubPrsClient } from '../github/github-pr-client';
import type { PipelineRun } from '../../domain';
import { RawFiltersParser } from '../github/raw-filters-parser';

const execFileAsync = promisify(execFile);

export type GitlabCliRunner = (args: string[], env?: NodeJS.ProcessEnv) => Promise<string>;

type GitlabUser = {
  id?: number;
  username?: string;
  name?: string;
  avatar_url?: string;
  web_url?: string;
};

type GitlabMergeRequest = {
  id: number;
  iid: number;
  project_id?: number;
  title: string;
  description?: string | null;
  state: string;
  created_at: string;
  updated_at: string;
  merged_at?: string | null;
  closed_at?: string | null;
  web_url?: string;
  author?: GitlabUser;
  labels?: string[];
};

type GitlabNote = {
  id: number;
  body: string;
  created_at: string;
  updated_at: string;
  web_url?: string;
  author?: GitlabUser;
};

type GitlabPipeline = {
  id: number;
  iid?: number;
  name?: string | null;
  ref?: string | null;
  sha?: string | null;
  status?: string;
  source?: string;
  created_at?: string;
  updated_at?: string;
  started_at?: string | null;
  finished_at?: string | null;
  web_url?: string;
};

type GitlabJob = {
  id: number;
  name?: string;
  stage?: string;
  ref?: string | null;
  commit?: { id?: string };
  status?: string;
  created_at?: string;
  started_at?: string | null;
  finished_at?: string | null;
  web_url?: string;
  pipeline?: { id?: number; web_url?: string };
};

type GitlabFetchOptions = {
  startDate?: string;
  endDate?: string;
  state?: 'opened' | 'closed' | 'merged' | 'all';
  status?: string;
  rawFilters?: string;
};

/**
 * GitLab provider backed by the official GitLab CLI.
 *
 * It calls `glab api` instead of depending on direct HTTP credentials here. The
 * returned payloads are normalized to the cache schemas already consumed by the
 * GitHub dashboards and domain services.
 */
export class GitlabMrClient implements IGithubPrsClient {
  private readonly encodedProjectId: string;
  private readonly rawFiltersParser = new RawFiltersParser();

  constructor(
    private token: string | undefined,
    private projectId: string,
    private logger: Logger,
    private runner: GitlabCliRunner = defaultGitlabCliRunner
  ) {
    this.encodedProjectId = encodeURIComponent(projectId);
  }

  async fetchPRs(options?: {
    startDate?: string;
    endDate?: string;
    state?: 'open' | 'closed' | 'all';
    rawFilters?: string;
  }): Promise<PullRequestJsonResponse[]> {
    return this.fetchMergeRequests({
      startDate: options?.startDate,
      endDate: options?.endDate,
      state: this.toGitlabState(options?.state),
      rawFilters: options?.rawFilters,
    });
  }

  async fetchMergeRequests(options?: GitlabFetchOptions): Promise<PullRequestJsonResponse[]> {
    const mergeRequests = await this.fetchAllPages<GitlabMergeRequest>('merge_requests', {
      state: options?.state || 'all',
      order_by: 'created_at',
      sort: 'desc',
      ...(options?.startDate ? { created_after: options.startDate } : {}),
      ...(options?.endDate ? { created_before: options.endDate } : {}),
      ...this.rawFiltersParser.parse(options?.rawFilters),
    });

    return mergeRequests.map((mr) => this.mapMergeRequest(mr));
  }

  async fetchPRComments(prNumber: number): Promise<PullRequestCommentJsonResponse[]> {
    return this.fetchMRComments(prNumber);
  }

  async fetchMRComments(mrIid: number): Promise<PullRequestCommentJsonResponse[]> {
    const notes = await this.fetchAllPages<GitlabNote>(`merge_requests/${mrIid}/notes`, {
      sort: 'asc',
      order_by: 'created_at',
    });

    return notes.map((note) => this.mapNote(note, mrIid));
  }

  private async fetchAllPages<T>(
    resource: string,
    query: Record<string, string | number | undefined> = {}
  ): Promise<T[]> {
    const perPage = 100;
    let page = 1;
    const allItems: T[] = [];

    while (true) {
      this.logger.info(`Fetching GitLab ${resource} page ${page} for ${this.projectId}`);
      const endpoint = this.buildProjectEndpoint(resource, {
        ...query,
        per_page: perPage,
        page,
      });
      const items = await this.runJson<T[]>(endpoint);

      allItems.push(...items);

      if (items.length < perPage) {
        break;
      }

      page += 1;
    }

    return allItems;
  }

  private mapMergeRequest(mr: GitlabMergeRequest): PullRequestJsonResponse {
    const author = this.mapUser(mr.author);
    const htmlUrl = mr.web_url || '';
    const apiUrl = this.projectApiUrl(`merge_requests/${mr.iid}`);

    return {
      url: apiUrl,
      id: String(mr.id),
      node_id: String(mr.id),
      html_url: htmlUrl,
      diff_url: `${htmlUrl}.diff`,
      patch_url: `${htmlUrl}.patch`,
      issue_url: apiUrl,
      number: String(mr.iid),
      state: this.toPullRequestState(mr),
      locked: false,
      title: mr.title,
      body: mr.description || '',
      created_at: mr.created_at,
      updated_at: mr.updated_at,
      closed_at: mr.closed_at || '',
      merged_at: mr.merged_at || '',
      labels: (mr.labels || []).map((label, index) => ({
        id: `${mr.id}:${index}:${label}`,
        node_id: `${mr.id}:${index}:${label}`,
        url: '',
        name: label,
        color: '',
        default: false,
        description: '',
      })),
      user: author,
    };
  }

  private mapNote(note: GitlabNote, mrIid: number): PullRequestCommentJsonResponse {
    const author = this.mapUser(note.author);

    return {
      url: note.web_url || this.projectApiUrl(`merge_requests/${mrIid}/notes/${note.id}`),
      id: note.id,
      node_id: String(note.id),
      diff_hunk: '',
      path: '',
      commit_id: '',
      original_commit_id: '',
      user: author,
      body: note.body,
      created_at: note.created_at,
      updated_at: note.updated_at,
      html_url: note.web_url || '',
      pull_request_url: this.syntheticPullRequestUrl(mrIid),
      reactions: emptyReactions(),
    };
  }

  private toGitlabState(state?: 'open' | 'closed' | 'all'): 'opened' | 'closed' | 'all' {
    if (state === 'open') {
      return 'opened';
    }
    if (state === 'closed') {
      return 'closed';
    }
    return 'all';
  }

  private toPullRequestState(mr: GitlabMergeRequest): string {
    if (mr.merged_at || mr.state === 'merged') {
      return 'merged';
    }
    if (mr.state === 'opened') {
      return 'open';
    }
    return mr.state || 'closed';
  }

  private mapUser(user?: GitlabUser): PullRequestJsonResponse['user'] {
    const login = user?.username || user?.name || 'unknown';
    const id = user?.id || 0;

    return {
      login,
      id,
      node_id: String(id),
      avatar_url: user?.avatar_url || '',
      gravatar_id: '',
      url: '',
      html_url: user?.web_url || '',
      followers_url: '',
      following_url: '',
      gists_url: '',
      starred_url: '',
      subscriptions_url: '',
      organizations_url: '',
      repos_url: '',
      events_url: '',
      received_events_url: '',
      type: 'User',
      user_view_type: 'public',
      site_admin: false,
    };
  }

  private syntheticPullRequestUrl(mrIid: number): string {
    return `https://gitlab.local/${this.projectId}/pulls/${mrIid}`;
  }

  private projectApiUrl(resource: string): string {
    return `/projects/${this.encodedProjectId}/${resource}`;
  }

  private buildProjectEndpoint(
    resource: string,
    query: Record<string, string | number | undefined>
  ): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        search.set(key, String(value));
      }
    }

    return `${this.projectApiUrl(resource)}?${search.toString()}`;
  }

  private async runJson<T>(endpoint: string): Promise<T> {
    const output = await this.runner(['api', endpoint], this.buildEnv());
    return JSON.parse(output) as T;
  }

  private buildEnv(): NodeJS.ProcessEnv {
    if (!this.token) {
      return process.env;
    }

    return {
      ...process.env,
      GITLAB_TOKEN: this.token,
      GLAB_TOKEN: this.token,
    };
  }
}

export class GitlabPipelineClient implements IGithubWorkflowClient, IGithubWorkflowJobClient {
  private readonly encodedProjectId: string;
  private readonly rawFiltersParser = new RawFiltersParser();

  constructor(
    private token: string | undefined,
    private projectId: string,
    private logger: Logger,
    private runner: GitlabCliRunner = defaultGitlabCliRunner
  ) {
    this.encodedProjectId = encodeURIComponent(projectId);
  }

  async fetchWorkflows(options?: {
    startDate?: string;
    endDate?: string;
    rawFilters?: string;
    byDay?: boolean;
  }): Promise<PipelineRun[]> {
    const allRuns: PipelineRun[] = [];
    let page = 1;

    while (true) {
      const response = await this.fetchWorkflowRunsPage(page, 100, {
        created: this.buildCreatedFilter(options?.startDate, options?.endDate),
        rawFilters: options?.rawFilters,
      });

      allRuns.push(...response.runs.map((run) => this.mapWorkflowToPipelineRun(run)));

      if (!response.hasNext) {
        break;
      }

      page += 1;
    }

    return allRuns;
  }

  async fetchPipelines(options?: GitlabFetchOptions): Promise<WorkflowJsonResponse[]> {
    const allPipelines: WorkflowJsonResponse[] = [];
    let page = 1;

    while (true) {
      const response = await this.fetchWorkflowRunsPage(page, 100, {
        created: this.buildCreatedFilter(options?.startDate, options?.endDate),
        rawFilters: options?.rawFilters || this.buildStatusFilter(options?.status),
      });

      allPipelines.push(...response.runs);

      if (!response.hasNext) {
        break;
      }

      page += 1;
    }

    return allPipelines;
  }

  async fetchWorkflowRunsPage(
    page: number,
    perPage: number = 100,
    options?: { created?: string; rawFilters?: string }
  ): Promise<GitHubWorkflowResponse> {
    const query = {
      ...this.parseCreatedFilter(options?.created),
      ...this.rawFiltersParser.parse(options?.rawFilters),
      per_page: perPage,
      page,
    };
    const endpoint = this.buildProjectEndpoint('pipelines', query);
    this.logger.info(`glab api ${endpoint}`);

    const pipelines = await this.runJson<GitlabPipeline[]>(endpoint);
    const detailedPipelines = await Promise.all(
      pipelines.map((pipeline) => this.fetchPipelineDetails(pipeline))
    );
    const runs = detailedPipelines.map((pipeline) => this.mapPipeline(pipeline));

    return {
      runs,
      hasNext: pipelines.length === perPage,
    };
  }

  async fetchJobsForPipelines(pipelineIds: string[]): Promise<WorkflowJobJsonResponse[]> {
    const allJobs: WorkflowJobJsonResponse[] = [];

    for (const pipelineId of pipelineIds) {
      let page = 1;

      while (true) {
        const response = await this.fetchJobsPage(pipelineId, page, 100);
        allJobs.push(...response.jobs);

        if (!response.hasNext) {
          break;
        }

        page += 1;
      }
    }

    return allJobs;
  }

  async fetchJobsPage(
    runId: string,
    page: number,
    perPage: number = 100
  ): Promise<GitHubWorkflowJobResponse> {
    const endpoint = this.buildProjectEndpoint(`pipelines/${runId}/jobs`, {
      include_retried: true,
      per_page: perPage,
      page,
    });
    this.logger.info(`glab api ${endpoint}`);

    const jobs = await this.runJson<GitlabJob[]>(endpoint);

    return {
      jobs: jobs.map((job) => this.mapJob(job, runId)),
      hasNext: jobs.length === perPage,
    };
  }

  private async fetchPipelineDetails(pipeline: GitlabPipeline): Promise<GitlabPipeline> {
    try {
      const endpoint = this.projectApiUrl(`pipelines/${pipeline.id}`);
      const details = await this.runJson<GitlabPipeline>(endpoint);
      return { ...pipeline, ...details };
    } catch (error) {
      this.logger.error(`Failed to fetch GitLab pipeline ${pipeline.id} details`, error);
      return pipeline;
    }
  }

  private mapPipeline(pipeline: GitlabPipeline): WorkflowJsonResponse {
    const id = String(pipeline.id);
    const status = this.toWorkflowStatus(pipeline.status);
    const conclusion = status === 'completed' ? this.toConclusion(pipeline.status) : '';
    const createdAt = pipeline.created_at || pipeline.updated_at || '';
    const updatedAt = pipeline.finished_at || pipeline.updated_at || createdAt;
    const name = pipeline.name || '.gitlab-ci.yml';

    return {
      id,
      name,
      node_id: id,
      head_branch: pipeline.ref || '',
      head_sha: pipeline.sha || '',
      path: '.gitlab-ci.yml',
      display_title: name,
      run_number: String(pipeline.iid || pipeline.id),
      event: pipeline.source || '',
      status,
      conclusion,
      workflow_id: '.gitlab-ci.yml',
      check_suite_id: id,
      check_suite_node_id: id,
      url: this.projectApiUrl(`pipelines/${pipeline.id}`),
      html_url: pipeline.web_url || '',
      created_at: createdAt,
      updated_at: updatedAt,
      run_attempt: '1',
      run_started_at: pipeline.started_at || createdAt,
    };
  }

  private mapJob(job: GitlabJob, runId: string): WorkflowJobJsonResponse {
    const id = String(job.id);
    const status = this.toWorkflowStatus(job.status);
    const conclusion = status === 'completed' ? this.toConclusion(job.status) : '';
    const createdAt = job.created_at || job.started_at || '';

    return {
      id,
      run_id: String(job.pipeline?.id || runId),
      workflow_name: '.gitlab-ci.yml',
      head_branch: job.ref || '',
      run_url: job.pipeline?.web_url || '',
      run_attempt: '1',
      node_id: id,
      head_sha: job.commit?.id || '',
      url: this.projectApiUrl(`jobs/${job.id}`),
      html_url: job.web_url || '',
      status,
      conclusion,
      created_at: createdAt,
      started_at: job.started_at || createdAt,
      completed_at: job.finished_at || '',
      name: job.name || job.stage || `job-${id}`,
      steps: [],
    };
  }

  private mapWorkflowToPipelineRun(run: WorkflowJsonResponse): PipelineRun {
    return {
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
    };
  }

  private parseCreatedFilter(created?: string): Record<string, string> {
    if (!created) {
      return {};
    }

    const [startDate, endDate] = created.split('..');
    return {
      ...(startDate ? { updated_after: startDate } : {}),
      ...(endDate ? { updated_before: endDate } : {}),
    };
  }

  private buildCreatedFilter(startDate?: string, endDate?: string): string | undefined {
    if (!startDate && !endDate) {
      return undefined;
    }

    return `${startDate || ''}..${endDate || ''}`;
  }

  private buildStatusFilter(status?: string): string | undefined {
    return status ? `status=${status}` : undefined;
  }

  private toWorkflowStatus(status?: string): string {
    if (
      ['success', 'failed', 'canceled', 'cancelled', 'skipped', 'manual'].includes(status || '')
    ) {
      return 'completed';
    }

    if (['running'].includes(status || '')) {
      return 'in_progress';
    }

    return status || 'queued';
  }

  private toConclusion(status?: string): string {
    if (status === 'failed') {
      return 'failure';
    }
    if (status === 'canceled') {
      return 'cancelled';
    }
    return status || '';
  }

  private projectApiUrl(resource: string): string {
    return `/projects/${this.encodedProjectId}/${resource}`;
  }

  private buildProjectEndpoint(
    resource: string,
    query: Record<string, string | number | boolean | undefined>
  ): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        search.set(key, String(value));
      }
    }

    return `${this.projectApiUrl(resource)}?${search.toString()}`;
  }

  private async runJson<T>(endpoint: string): Promise<T> {
    const output = await this.runner(['api', endpoint], this.buildEnv());
    return JSON.parse(output) as T;
  }

  private buildEnv(): NodeJS.ProcessEnv {
    if (!this.token) {
      return process.env;
    }

    return {
      ...process.env,
      GITLAB_TOKEN: this.token,
      GLAB_TOKEN: this.token,
    };
  }
}

async function defaultGitlabCliRunner(args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
  const { stdout } = await execFileAsync('glab', args, {
    env,
    maxBuffer: 20 * 1024 * 1024,
  });

  return stdout;
}

function emptyReactions(): PullRequestCommentJsonResponse['reactions'] {
  return {
    url: '',
    total_count: 0,
    '+1': 0,
    '-1': 0,
    laugh: 0,
    hooray: 0,
    confused: 0,
    heart: 0,
    rocket: 0,
    eyes: 0,
  };
}
