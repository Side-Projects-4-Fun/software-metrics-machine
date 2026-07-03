import { Commit, PullRequest, PipelineRun, CodeChange } from '../domain-types';
import type { IReadPullRequestsRepository } from '../index';
import type {
  IPipelinesRepository,
  LoadPipelinesOptions,
} from '../aggregates/pipelines-repository';
import type { IRepository } from '../index';
import type { PRDetails, PRFilters } from '../index';
import {
  PullRequestJsonResponse,
  PullRequestCommentJsonResponse,
  PullRequestLabelJsonResponse,
} from '../providers/github/github-response-types';
import { shouldIncludeTimestampForWeekendsMode } from '../domain/metric-samples';
import type { Configuration } from '../infrastructure/configuration';

/**
 * Builder for creating mock Commit objects
 */
export class CommitBuilder {
  private commit: Commit = {
    author: 'Test Author',
    msg: 'Test commit message',
    hash: 'abc123def456',
    timestamp: new Date().toISOString(),
    files: [],
  };

  withAuthor(author: string): CommitBuilder {
    this.commit.author = author;
    return this;
  }

  withMessage(msg: string): CommitBuilder {
    this.commit.msg = msg;
    return this;
  }

  withHash(hash: string): CommitBuilder {
    this.commit.hash = hash;
    return this;
  }

  withTimestamp(timestamp: string): CommitBuilder {
    this.commit.timestamp = timestamp;
    return this;
  }

  withFiles(files: CodeChange[]): CommitBuilder {
    this.commit.files = files;
    return this;
  }

  build(): Commit {
    return { ...this.commit };
  }
}

/**
 * Builder for creating mock PullRequest objects
 */
export class PullRequestBuilder {
  private pr: any = {
    id: 1,
    number: 1,
    title: 'Test Pull Request',
    author: { login: 'Test Author', id: 1 },
    url: 'https://github.com/example/pr/1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    state: 'open',
    labels: [],
    comments: 0,
  };

  withId(id: number): PullRequestBuilder {
    this.pr.id = id;
    return this;
  }

  withNumber(number: number): PullRequestBuilder {
    this.pr.number = number;
    return this;
  }

  withTitle(title: string): PullRequestBuilder {
    this.pr.title = title;
    return this;
  }

  withAuthor(author: string): PullRequestBuilder {
    this.pr.author = { login: author, id: 1 };
    return this;
  }

  withState(state: 'open' | 'closed' | 'merged'): PullRequestBuilder {
    this.pr.state = state;
    return this;
  }

  withCreatedAt(createdAt: string): PullRequestBuilder {
    this.pr.createdAt = createdAt;
    return this;
  }

  withMergedAt(mergedAt: string): PullRequestBuilder {
    this.pr.mergedAt = mergedAt;
    this.pr.state = 'merged';
    return this;
  }

  withClosedAt(closedAt: string): PullRequestBuilder {
    this.pr.closedAt = closedAt;
    this.pr.state = 'closed';
    return this;
  }

  withComments(comments: number): PullRequestBuilder {
    this.pr.totalComments = comments;
    this.pr.comments = [];
    return this;
  }

  withLabels(labels: Array<{ name: string }>): PullRequestBuilder {
    this.pr.labels = labels;
    return this;
  }

  build(): any {
    return { ...this.pr };
  }
}

/**
 * Builder for creating mock PipelineRun objects
 */
export class PipelineRunBuilder {
  private run: any = {
    id: 'run-1',
    number: 1,
    name: 'Build',
    status: 'completed',
    conclusion: 'success',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    branch: 'main',
    commit: 'abc123',
    path: '.github/workflows/build.yml',
    jobs: [],
  };

  withId(id: string): PipelineRunBuilder {
    this.run.id = id;
    return this;
  }

  withNumber(number: number): PipelineRunBuilder {
    this.run.number = number;
    return this;
  }

  withName(name: string): PipelineRunBuilder {
    this.run.name = name;
    return this;
  }

  withStatus(status: string): PipelineRunBuilder {
    this.run.status = status;
    return this;
  }

  withConclusion(conclusion: string): PipelineRunBuilder {
    this.run.conclusion = conclusion;
    return this;
  }

  withBranch(branch: string): PipelineRunBuilder {
    this.run.branch = branch;
    return this;
  }

  withCommit(commit: string): PipelineRunBuilder {
    this.run.commit = commit;
    return this;
  }

  withCreatedAt(createdAt: string): PipelineRunBuilder {
    this.run.createdAt = createdAt;
    return this;
  }

  withStartedAt(startedAt: string): PipelineRunBuilder {
    this.run.startedAt = startedAt;
    return this;
  }

  withCompletedAt(completedAt: string): PipelineRunBuilder {
    this.run.completedAt = completedAt;
    return this;
  }

  withPath(path: string): PipelineRunBuilder {
    this.run.path = path;
    return this;
  }

  withDuration(seconds: number): PipelineRunBuilder {
    this.run.durationSeconds = seconds;
    const startDate = new Date(this.run.startedAt);
    this.run.completedAt = new Date(startDate.getTime() + seconds * 1000).toISOString();
    return this;
  }

  build(): any {
    return { ...this.run };
  }
}

/**
 * Factory for creating test data collections
 */
export class TestDataFactory {
  static createCommits(count: number): Commit[] {
    const commits: Commit[] = [];
    for (let i = 0; i < count; i++) {
      commits.push(
        new CommitBuilder()
          .withHash(`commit${i}`)
          .withAuthor(`author${i % 3}`)
          .withMessage(`Commit message ${i}`)
          .build()
      );
    }
    return commits;
  }

  static createPullRequests(count: number): PullRequest[] {
    const prs: PullRequest[] = [];
    for (let i = 0; i < count; i++) {
      prs.push(
        new PullRequestBuilder()
          .withNumber(i + 1)
          .withAuthor(`author${i % 3}`)
          .withTitle(`PR: Feature ${i}`)
          .build()
      );
    }
    return prs;
  }

  static createPipelineRuns(count: number): PipelineRun[] {
    const runs: PipelineRun[] = [];
    for (let i = 0; i < count; i++) {
      runs.push(
        new PipelineRunBuilder()
          .withNumber(i + 1)
          .withCommit(`commit${i}`)
          .withDuration(Math.random() * 3600)
          .build()
      );
    }
    return runs;
  }
}

// ---------------------------------------------------------------------------
// GitHub API Response Type Builders
// ---------------------------------------------------------------------------

/**
 * Builder for creating mock PullRequestJsonResponse objects (GitHub API response).
 * Replaces ad-hoc createPullRequest() helpers across multiple test files.
 *
 * Usage:
 *   new PullRequestJsonResponseBuilder()
 *     .withAuthor('alice')
 *     .withLabels([{ ... }])
 *     .build()
 */
export class PullRequestJsonResponseBuilder {
  private data: PullRequestJsonResponse = {
    url: '',
    id: '1',
    node_id: '',
    html_url: '',
    diff_url: '',
    patch_url: '',
    issue_url: '',
    number: '1',
    state: 'open',
    locked: false,
    title: 'Test PR',
    body: '',
    created_at: '2026-05-10T00:00:00Z',
    updated_at: '2026-05-10T00:00:00Z',
    closed_at: '',
    merged_at: '',
    labels: [],
    user: {
      login: 'alice',
      id: 1,
      node_id: '',
      avatar_url: '',
      gravatar_id: '',
      url: '',
      html_url: '',
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
      user_view_type: '',
      site_admin: false,
    },
  };

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withNumber(number: string): this {
    this.data.number = number;
    return this;
  }

  withTitle(title: string): this {
    this.data.title = title;
    return this;
  }

  withState(state: string): this {
    this.data.state = state;
    return this;
  }

  withAuthor(login: string, id: number = 1): this {
    this.data.user = {
      ...this.data.user!,
      login,
      id,
    };
    return this;
  }

  withCreatedAt(date: string): this {
    this.data.created_at = date;
    return this;
  }

  withUpdatedAt(date: string): this {
    this.data.updated_at = date;
    return this;
  }

  withMergedAt(date: string): this {
    this.data.merged_at = date;
    this.data.state = 'closed';
    return this;
  }

  withClosedAt(date: string): this {
    this.data.closed_at = date;
    return this;
  }

  withBody(body: string): this {
    this.data.body = body;
    return this;
  }

  withLabels(labels: PullRequestLabelJsonResponse[]): this {
    this.data.labels = labels;
    return this;
  }

  withUrl(url: string): this {
    this.data.html_url = url;
    return this;
  }

  build(): PullRequestJsonResponse {
    return { ...this.data };
  }
}

/**
 * Builder for creating mock PullRequestCommentJsonResponse objects (GitHub API response).
 */
export class PullRequestCommentJsonResponseBuilder {
  private data: PullRequestCommentJsonResponse = {
    url: '',
    pull_request_review_id: 1,
    id: 1,
    node_id: '',
    diff_hunk: '',
    path: '',
    commit_id: '',
    original_commit_id: '',
    user: {
      login: 'reviewer',
      id: 1,
    },
    body: 'Looks good',
    created_at: '2026-05-10T00:00:00Z',
    updated_at: '2026-05-10T00:00:00Z',
    html_url: '',
    pull_request_url: '',
    reactions: {
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
    },
  };

  withId(id: number): this {
    this.data.id = id;
    return this;
  }

  withBody(body: string): this {
    this.data.body = body;
    return this;
  }

  withAuthor(login: string, id: number = 1): this {
    this.data.user = { ...this.data.user!, login, id };
    return this;
  }

  withCreatedAt(date: string): this {
    this.data.created_at = date;
    return this;
  }

  withPullRequestUrl(url: string): this {
    this.data.pull_request_url = url;
    return this;
  }

  withReviewId(reviewId: number): this {
    this.data.pull_request_review_id = reviewId;
    return this;
  }

  build(): PullRequestCommentJsonResponse {
    return { ...this.data };
  }
}

// ---------------------------------------------------------------------------
// In-Memory Repository Builders
// ---------------------------------------------------------------------------

/**
 * Builder for creating an in-memory IReadPullRequestsRepository.
 * Returns a real implementation — no vi.fn() mocks.
 *
 * Usage:
 *   const repo = new ReadPullRequestsRepositoryBuilder()
 *     .withPullRequests([prDetails1, prDetails2])
 *     .build();
 *
 *   const service = new PRsService(repo);
 *
 * If the test needs to spy on method calls, wrap with vi.fn() in the test:
 *   const repo = new ReadPullRequestsRepositoryBuilder()
 *     .withPullRequests([prDetails1, prDetails2])
 *     .build();
 *   vi.spyOn(repo, 'loadPrsWithFilters');
 */
export class ReadPullRequestsRepositoryBuilder {
  private prs: PRDetails[] = [];

  withPullRequests(prs: PRDetails[]): this {
    this.prs = prs;
    return this;
  }

  build(): IReadPullRequestsRepository {
    return {
      loadPrsWithFilters: async (filters?: PRFilters) => {
        return this.prs.filter((pr) =>
          shouldIncludeTimestampForWeekendsMode(
            pr.mergedAt || pr.closedAt || pr.createdAt,
            filters?.cleaning?.weekends,
            (dateString) => this.isWeekday(dateString)
          )
        );
      },
    };
  }

  private isWeekday(dateString?: string): boolean {
    if (!dateString) {
      return true;
    }

    const day = new Date(dateString).getUTCDay();
    return day >= 1 && day <= 5;
  }
}

/**
 * Builder for creating an in-memory IPipelinesRepository.
 * Returns a real implementation — no vi.fn() mocks.
 *
 * Usage:
 *   const repo = new PipelinesRepositoryBuilder()
 *     .withPipelineRuns([run1, run2])
 *     .build();
 *
 *   const service = new PipelinesService(repo);
 */
export class PipelinesRepositoryBuilder {
  private runs: PipelineRun[] = [];

  withPipelineRuns(runs: PipelineRun[]): this {
    this.runs = runs;
    return this;
  }

  build(): IPipelinesRepository {
    return {
      loadPipelines: async (options?: LoadPipelinesOptions) => this.loadPipelines(options),
    };
  }

  private loadPipelines(options: LoadPipelinesOptions = { includeJobs: true }): PipelineRun[] {
    const selectedJobNames = this.parseCsvList(options.jobName)
      .concat(options.jobNames || [])
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean);
    const selectedBranches = this.parseCsvList(options.targetBranch);
    const selectedStatuses = this.parseCsvList(options.status).map((status) => status.toLowerCase());
    const selectedConclusions = this.parseCsvList(options.conclusion).map((conclusion) =>
      conclusion.toLowerCase()
    );
    const selectedEvents = this.parseCsvList(options.event);
    const targetJobConclusion = options.jobConclusion?.trim().toLowerCase();
    const start = options.startDate ? this.toDateBoundaryTimestamp(options.startDate, 'start') : 0;
    const end = options.endDate ? this.toDateBoundaryTimestamp(options.endDate, 'end') : 0;

    let runs = this.runs.filter((run) => {
      if (start || end) {
        const runTimestamp = this.toTimestamp(run.completedAt || run.createdAt);
        if (start && runTimestamp < start) return false;
        if (end && runTimestamp > end) return false;
      }
      if (
        !shouldIncludeTimestampForWeekendsMode(
          run.completedAt || run.createdAt,
          options.weekends,
          (dateString) => this.isWeekday(dateString)
        )
      ) {
        return false;
      }
      if (options.workflowPath && run.path !== options.workflowPath) return false;
      if (selectedBranches.length > 0 && !selectedBranches.includes(run.branch || '')) return false;
      if (
        selectedStatuses.length > 0 &&
        !selectedStatuses.includes((run.status || '').toLowerCase())
      ) {
        return false;
      }
      if (
        selectedConclusions.length > 0 &&
        !selectedConclusions.includes((run.conclusion || '').toLowerCase())
      ) {
        return false;
      }
      if (selectedEvents.length > 0 && !selectedEvents.includes((run as { event?: string }).event || '')) {
        return false;
      }

      return true;
    });

    if (selectedJobNames.length > 0 || targetJobConclusion) {
      runs = runs
        .map((run) => ({
          ...run,
          jobs: (run.jobs || [])
            .filter(
              (job) =>
                selectedJobNames.length === 0 ||
                selectedJobNames.includes((job.name || '').toLowerCase())
            )
            .filter((job) => {
              if (!targetJobConclusion) return true;
              return (job.conclusion || '').toLowerCase() === targetJobConclusion;
            }),
        }))
        .filter((run) => (run.jobs || []).length > 0);
    } else {
      runs = runs.map((run) => ({ ...run, jobs: run.jobs ? [...run.jobs] : undefined }));
    }

    if (options.includeJobs === false) {
      return runs.map(({ jobs: _jobs, ...run }) => run);
    }

    return runs;
  }

  private parseCsvList(value?: string): string[] {
    if (!value) {
      return [];
    }

    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private toTimestamp(value?: string): number {
    if (!value) {
      return 0;
    }

    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toDateBoundaryTimestamp(value: string, boundary: 'start' | 'end'): number {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return boundary === 'end'
        ? new Date(`${value}T23:59:59.999Z`).getTime()
        : new Date(`${value}T00:00:00.000Z`).getTime();
    }

    const isoWeekMatch = value.match(/^(\d{4})-W(\d{2})$/);
    if (isoWeekMatch) {
      const year = Number(isoWeekMatch[1]);
      const week = Number(isoWeekMatch[2]);
      const weekBoundary = this.getIsoWeekBoundaryTimestamp(year, week, boundary);
      if (weekBoundary !== undefined) {
        return weekBoundary;
      }
    }

    return this.toTimestamp(value);
  }

  private getIsoWeekBoundaryTimestamp(
    year: number,
    week: number,
    boundary: 'start' | 'end'
  ): number | undefined {
    const weekStart = this.getIsoWeekStartDate(year, week);
    if (!weekStart) {
      return undefined;
    }

    const boundaryDate = new Date(weekStart);
    if (boundary === 'end') {
      boundaryDate.setUTCDate(boundaryDate.getUTCDate() + 6);
      boundaryDate.setUTCHours(23, 59, 59, 999);
    } else {
      boundaryDate.setUTCHours(0, 0, 0, 0);
    }

    return boundaryDate.getTime();
  }

  private getIsoWeekStartDate(year: number, week: number): Date | undefined {
    if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1 || week > 53) {
      return undefined;
    }

    const january4th = new Date(Date.UTC(year, 0, 4, 12, 0, 0));
    const january4thDayOfWeek = january4th.getUTCDay() || 7;
    const week1Monday = new Date(january4th);
    week1Monday.setUTCDate(january4th.getUTCDate() - (january4thDayOfWeek - 1));

    const targetMonday = new Date(week1Monday);
    targetMonday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);

    return targetMonday;
  }

  private isWeekday(dateString?: string): boolean {
    if (!dateString) {
      return true;
    }

    const day = new Date(dateString).getUTCDay();
    return day >= 1 && day <= 5;
  }
}

/**
 * Builder for creating an in-memory IRepository<T>.
 * Returns a real implementation — no vi.fn() mocks.
 *
 * Usage:
 *   const repo = new RepositoryBuilder<Commit>()
 *     .withLoadAll([commit1, commit2])
 *     .build();
 *
 *   const service = new PairingIndexService(repo);
 */
export class RepositoryBuilder<T> {
  private items: T[] = [];
  private singleItem: T | null = null;
  private existsResult: boolean = false;

  withLoadAll(items: T[]): this {
    this.items = items;
    return this;
  }

  withLoad(item: T | null): this {
    this.singleItem = item;
    return this;
  }

  withExists(exists: boolean): this {
    this.existsResult = exists;
    return this;
  }

  build(): IRepository<T> {
    return {
      save: async (_item: T) => {},
      saveAll: async (_items: T[]) => {},
      load: async () => this.singleItem,
      loadAll: async () => [...this.items],
      delete: async () => {},
      exists: async () => this.existsResult,
    };
  }
}

// ---------------------------------------------------------------------------
// Configuration Builder
// ---------------------------------------------------------------------------

/**
 * Builder for creating test configuration objects.
 * Replaces `{ getPathFromGitProvider: () => '/tmp' } as any` patterns in tests.
 *
 * Produces an object that is structurally compatible with the `Configuration`
 * class used by fetch repositories and services.
 *
 * Usage:
 *   const config = new TestConfigurationBuilder()
 *     .withGetPathFromGitProvider('/tmp')
 *     .build();
 *
 *   const repository = new PipelinesFetchRepository(config, client, store);
 *
 * If the test needs additional properties not covered by the builder methods,
 * use withExtra():
 *   const config = new TestConfigurationBuilder()
 *     .withGetPathFromGitProvider('/tmp')
 *     .withExtra('gitProvider', 'github')
 *     .build();
 */
export class TestConfigurationBuilder {
  private config: Record<string, unknown> = {
    getPathFromGitProvider: () => '/tmp',
    internal: { storageType: 'json' },
  };

  /** Sets the return value of `getPathFromGitProvider()` (default: `'/tmp'`). */
  withGetPathFromGitProvider(path: string): this {
    this.config.getPathFromGitProvider = () => path;
    return this;
  }

  /**
   * Sets the internal storage type (default: `'json'`).
   */
  withStorageType(storageType: 'json' | 'sqlite'): this {
    this.config.internal = { storageType };
    return this;
  }

  /**
   * Sets an arbitrary property on the configuration object.
   * Use this when a test needs a property not covered by the dedicated builder methods.
   */
  withExtra(key: string, value: unknown): this {
    this.config[key] = value;
    return this;
  }

  /** Returns a plain object cast to Configuration for use in constructor parameters. */
  build(): Configuration {
    return this.config as unknown as Configuration;
  }
}
