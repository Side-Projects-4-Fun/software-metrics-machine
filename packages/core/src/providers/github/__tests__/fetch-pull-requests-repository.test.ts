import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { GitHubPullRequestsFetchRepository, IGithubPrsClient } from '../../..';
import { RepositoryFactory } from '../../../infrastructure/repository-factory';
import { PullRequestCommentJsonResponse, PullRequestJsonResponse } from '../github-response-types';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';

function createSqliteConfig(providerDir: string): {
  internal: { storageType: 'sqlite' };
  getPathFromGitProvider: () => string;
  getBaseDirectory: () => string;
} {
  return {
    internal: { storageType: 'sqlite' },
    getPathFromGitProvider: () => providerDir,
    getBaseDirectory: () => providerDir,
  };
}

async function seedPullRequests(
  providerDir: string,
  items: PullRequestJsonResponse[]
): Promise<void> {
  const config = createSqliteConfig(providerDir);
  const repository = RepositoryFactory.create<PullRequestJsonResponse>(
    `${providerDir}/prs.json`,
    new MockLoggerBuilder().build(),
    config as never
  );
  await repository.saveAll(items);
}

async function seedPullRequestComments(
  providerDir: string,
  items: PullRequestCommentJsonResponse[]
): Promise<void> {
  const config = createSqliteConfig(providerDir);
  const repository = RepositoryFactory.create<PullRequestCommentJsonResponse>(
    `${providerDir}/pr-comments.json`,
    new MockLoggerBuilder().build(),
    config as never
  );
  await repository.saveAll(items);
}

async function loadPullRequestComments(
  providerDir: string
): Promise<PullRequestCommentJsonResponse[]> {
  const config = createSqliteConfig(providerDir);
  const repository = RepositoryFactory.create<PullRequestCommentJsonResponse>(
    `${providerDir}/pr-comments.json`,
    new MockLoggerBuilder().build(),
    config as never
  );
  return repository.loadAll();
}

function createPullRequest(
  overrides: Partial<PullRequestJsonResponse> = {}
): PullRequestJsonResponse {
  return {
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
    labels: [
      {
        id: '1',
        node_id: '',
        url: '',
        name: 'bug',
        color: '',
        default: false,
        description: '',
      },
    ],
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
    ...overrides,
  };
}

function createComment(
  overrides: Partial<PullRequestCommentJsonResponse> = {}
): PullRequestCommentJsonResponse {
  return {
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
    pull_request_url: 'https://api.github.com/repos/org/repo/pulls/1',
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
    ...overrides,
  };
}

describe('GitHubPullRequestsFetchRepository', () => {
  const logger = new MockLoggerBuilder().build();

  it('should perform incremental update fetching PRs created since latest cached update', async () => {
    const providerDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-pr-incr-'));
    const cachedPrs = [
      createPullRequest({
        id: '1',
        created_at: '2026-05-01T00:00:00Z',
        updated_at: '2026-05-10T00:00:00Z',
      }),
      createPullRequest({
        id: '2',
        created_at: '2026-05-05T00:00:00Z',
        updated_at: '2026-05-15T00:00:00Z',
      }),
    ];

    // Pre-populate cache
    await seedPullRequests(providerDir, cachedPrs);

    const newPrs = [
      createPullRequest({
        id: '3',
        created_at: '2026-05-20T00:00:00Z',
        updated_at: '2026-05-20T00:00:00Z',
      }),
    ];

    const fetchPRs = vi.fn().mockResolvedValue(newPrs);
    const githubPrsClient: IGithubPrsClient = {
      fetchPRs,
      fetchPRComments: vi.fn(),
    };
    const config = createSqliteConfig(providerDir);

    const repository = new GitHubPullRequestsFetchRepository(
      githubPrsClient,
      config as never,
      logger
    );

    const result = await repository.fetchPRs({ incrementalUpdate: true });

    // startDate is the latest updated_at from cache (2026-05-15)
    expect(fetchPRs).toHaveBeenCalledWith({
      startDate: '2026-05-15T00:00:00.000Z',
      endDate: undefined,
    });

    // Merged result includes cached + new PRs (3 total)
    expect(result).toHaveLength(3);
    const ids = result.map((pr) => pr.id).sort();
    expect(ids).toEqual(['1', '2', '3']);
  });

  it('falls through to a plain fetch when incrementalUpdate is true but the cache is empty', async () => {
    const providerDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-pr-incr-empty-'));
    const newPrs = [createPullRequest({ id: '1' })];

    const fetchPRs = vi.fn().mockResolvedValue(newPrs);
    const githubPrsClient: IGithubPrsClient = {
      fetchPRs,
      fetchPRComments: vi.fn(),
    };
    const config = {
      getPathFromGitProvider: () => providerDir,
    };

    const repository = new GitHubPullRequestsFetchRepository(
      githubPrsClient,
      config as never,
      logger
    );

    const result = await repository.fetchPRs({ incrementalUpdate: true });

    expect(fetchPRs).toHaveBeenCalledWith({
      startDate: undefined,
      endDate: undefined,
    });
    expect(result).toEqual(newPrs);
  });

  it('fetches a manual date range and merges with a non-empty cache, with incoming PRs winning collisions', async () => {
    const providerDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-pr-range-merge-'));
    const cachedPrs = [
      createPullRequest({ id: '1', title: 'Stale title' }),
      createPullRequest({ id: '2', title: 'Untouched PR' }),
    ];

    await seedPullRequests(providerDir, cachedPrs);

    const freshPrs = [createPullRequest({ id: '1', title: 'Fresh title' })];

    const fetchPRs = vi.fn().mockResolvedValue(freshPrs);
    const githubPrsClient: IGithubPrsClient = {
      fetchPRs,
      fetchPRComments: vi.fn(),
    };
    const config = createSqliteConfig(providerDir);

    const repository = new GitHubPullRequestsFetchRepository(
      githubPrsClient,
      config as never,
      logger
    );

    const result = await repository.fetchPRs({
      startDate: '2026-05-01T00:00:00Z',
      endDate: '2026-05-31T00:00:00Z',
    });

    expect(fetchPRs).toHaveBeenCalledWith({
      startDate: '2026-05-01T00:00:00Z',
      endDate: '2026-05-31T00:00:00Z',
    });

    expect(result).toHaveLength(2);
    const merged = result.find((pr) => pr.id === '1');
    expect(merged?.title).toBe('Fresh title');
  });

  it('falls through to a plain fetch for a manual date range when the cache is empty', async () => {
    const providerDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-pr-range-empty-'));
    const freshPrs = [createPullRequest({ id: '1' })];

    const fetchPRs = vi.fn().mockResolvedValue(freshPrs);
    const githubPrsClient: IGithubPrsClient = {
      fetchPRs,
      fetchPRComments: vi.fn(),
    };
    const config = createSqliteConfig(providerDir);

    const repository = new GitHubPullRequestsFetchRepository(
      githubPrsClient,
      config as never,
      logger
    );

    const result = await repository.fetchPRs({
      startDate: '2026-05-01T00:00:00Z',
      endDate: '2026-05-31T00:00:00Z',
    });

    expect(fetchPRs).toHaveBeenCalledWith({
      startDate: '2026-05-01T00:00:00Z',
      endDate: '2026-05-31T00:00:00Z',
    });
    expect(result).toEqual(freshPrs);
  });

  it('serves cached PRs directly when there is no date range or incrementalUpdate and forceRefresh is not set', async () => {
    const providerDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-pr-cache-hit-'));
    const cachedPrs = [createPullRequest({ id: '1' }), createPullRequest({ id: '2' })];
    await seedPullRequests(providerDir, cachedPrs);

    const fetchPRs = vi.fn().mockResolvedValue([]);
    const githubPrsClient: IGithubPrsClient = {
      fetchPRs,
      fetchPRComments: vi.fn(),
    };
    const config = createSqliteConfig(providerDir);

    const repository = new GitHubPullRequestsFetchRepository(
      githubPrsClient,
      config as never,
      logger
    );

    const result = await repository.fetchPRs();

    expect(fetchPRs).not.toHaveBeenCalled();
    expect(result).toEqual(cachedPrs);

    const optionsRepository = RepositoryFactory.create<{
      authors: string[];
      labels: string[];
    }>(`${providerDir}/pull-request-filter-options.json`, logger, config as never);
    const options = await optionsRepository.load();
    expect(options).toBeNull();
  });

  it('bypasses the date-range merge guard but not the incremental guard when forceRefresh and incrementalUpdate are both set', async () => {
    const providerDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-pr-force-incr-'));
    const cachedPrs = [
      createPullRequest({
        id: '1',
        updated_at: '2026-05-15T00:00:00Z',
      }),
    ];
    await seedPullRequests(providerDir, cachedPrs);

    const freshPrs = [createPullRequest({ id: '2' })];
    const fetchPRs = vi.fn().mockResolvedValue(freshPrs);
    const githubPrsClient: IGithubPrsClient = {
      fetchPRs,
      fetchPRComments: vi.fn(),
    };
    const config = createSqliteConfig(providerDir);

    const repository = new GitHubPullRequestsFetchRepository(
      githubPrsClient,
      config as never,
      logger
    );

    const result = await repository.fetchPRs({ incrementalUpdate: true, forceRefresh: true });

    // forceRefresh does NOT bypass guard 1 (incremental): the client is still called
    // with startDate derived from the cache's latest updated_at, not a plain fetch.
    expect(fetchPRs).toHaveBeenCalledWith({
      startDate: '2026-05-15T00:00:00.000Z',
      endDate: undefined,
    });
    expect(result).toHaveLength(2);
  });

  it('creates pull request filter options after fetching pull requests', async () => {
    const providerDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-pr-filters-'));
    const githubPrsClient: IGithubPrsClient = {
      fetchPRs: vi.fn().mockResolvedValue([
        createPullRequest(),
        createPullRequest({
          id: '2',
          user: { ...createPullRequest().user!, login: 'bob' },
          labels: [
            {
              id: '2',
              node_id: '',
              url: '',
              name: 'feature',
              color: '',
              default: false,
              description: '',
            },
          ],
        }),
      ]),
      fetchPRComments: vi.fn(),
    };
    const config = createSqliteConfig(providerDir);

    const repository = new GitHubPullRequestsFetchRepository(
      githubPrsClient,
      config as never,
      logger
    );

    await repository.fetchPRs({ forceRefresh: true });

    const optionsRepository = RepositoryFactory.create<{
      authors: string[];
      labels: string[];
    }>(`${providerDir}/pull-request-filter-options.json`, logger, config as never);
    const options = await optionsRepository.load();
    if (!options) {
      throw new Error('Expected pull-request filter options to be cached in repository');
    }

    expect(options).toEqual({
      authors: ['alice', 'bob'],
      labels: ['bug', 'feature'],
    });
  });

  describe('fetchPRComments', () => {
    it('incrementally updates: fetches all fresh comments, filters out ones older than the cached latest, always includes ones with no updated_at, and merges with cache, preserving other PRs untouched', async () => {
      const providerDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-comments-incr-'));
      const cachedCommentForPR1 = createComment({
        id: 1,
        pull_request_url: 'https://api.github.com/repos/org/repo/pulls/1',
        updated_at: '2026-05-10T00:00:00Z',
      });
      const cachedCommentForOtherPR = createComment({
        id: 99,
        pull_request_url: 'https://api.github.com/repos/org/repo/pulls/2',
        updated_at: '2026-05-01T00:00:00Z',
      });
      await seedPullRequestComments(providerDir, [cachedCommentForPR1, cachedCommentForOtherPR]);

      const staleFreshComment = {
        ...createComment({
          id: 1,
          pull_request_url: 'https://api.github.com/repos/org/repo/pulls/1',
        }),
        updated_at: '2026-05-09T00:00:00Z',
        body: 'should be excluded, older than cached latest',
      };
      const freshComment = {
        ...createComment({
          id: 2,
          pull_request_url: 'https://api.github.com/repos/org/repo/pulls/1',
        }),
        updated_at: '2026-05-12T00:00:00Z',
        body: 'new comment after cached latest',
      };
      const noDateComment = {
        ...createComment({
          id: 3,
          pull_request_url: 'https://api.github.com/repos/org/repo/pulls/1',
        }),
        updated_at: undefined as unknown as string,
        body: 'always included regardless of date',
      };

      const fetchPRComments = vi
        .fn()
        .mockResolvedValue([staleFreshComment, freshComment, noDateComment]);
      const githubPrsClient: IGithubPrsClient = {
        fetchPRs: vi.fn(),
        fetchPRComments,
      };
      const config = createSqliteConfig(providerDir);

      const repository = new GitHubPullRequestsFetchRepository(
        githubPrsClient,
        config as never,
        logger
      );

      const result = await repository.fetchPRComments(1, { incrementalUpdate: true });

      expect(fetchPRComments).toHaveBeenCalledWith(1);

      const ids = result.map((c) => c.id).sort();
      expect(ids).toEqual([1, 2, 3]);
      expect(result.some((c) => c.body.includes('older than cached latest'))).toBe(false);

      const saved = await loadPullRequestComments(providerDir);
      const savedForOtherPR = saved.find((c) => c.id === 99);
      expect(savedForOtherPR).toEqual(cachedCommentForOtherPR);
    });

    it('falls through past the incremental guard when there are no cached comments for this PR', async () => {
      const providerDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-comments-incr-empty-'));
      const cachedCommentForOtherPR = createComment({
        id: 99,
        pull_request_url: 'https://api.github.com/repos/org/repo/pulls/2',
      });
      await seedPullRequestComments(providerDir, [cachedCommentForOtherPR]);

      const freshComment = createComment({
        id: 1,
        pull_request_url: 'https://api.github.com/repos/org/repo/pulls/1',
      });
      const fetchPRComments = vi.fn().mockResolvedValue([freshComment]);
      const githubPrsClient: IGithubPrsClient = {
        fetchPRs: vi.fn(),
        fetchPRComments,
      };
      const config = createSqliteConfig(providerDir);

      const repository = new GitHubPullRequestsFetchRepository(
        githubPrsClient,
        config as never,
        logger
      );

      const result = await repository.fetchPRComments(1, { incrementalUpdate: true });

      expect(fetchPRComments).toHaveBeenCalledWith(1);
      expect(result).toEqual([freshComment]);
    });

    it('serves cached comments for the PR directly on a cache hit, without calling fetchPRComments', async () => {
      const providerDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-comments-cache-hit-'));
      const cachedCommentForPR1 = createComment({
        id: 1,
        pull_request_url: 'https://api.github.com/repos/org/repo/pulls/1',
      });
      await seedPullRequestComments(providerDir, [cachedCommentForPR1]);

      const fetchPRComments = vi.fn().mockResolvedValue([]);
      const githubPrsClient: IGithubPrsClient = {
        fetchPRs: vi.fn(),
        fetchPRComments,
      };
      const config = createSqliteConfig(providerDir);

      const repository = new GitHubPullRequestsFetchRepository(
        githubPrsClient,
        config as never,
        logger
      );

      const result = await repository.fetchPRComments(1);

      expect(fetchPRComments).not.toHaveBeenCalled();
      expect(result).toEqual([cachedCommentForPR1]);
    });

    it('plain-fetches when the cache for this PR is empty, replacing this PR slice without merging, leaving other PRs untouched', async () => {
      const providerDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-comments-plain-fetch-'));
      const cachedCommentForOtherPR = createComment({
        id: 99,
        pull_request_url: 'https://api.github.com/repos/org/repo/pulls/2',
      });
      await seedPullRequestComments(providerDir, [cachedCommentForOtherPR]);

      const freshComment = createComment({
        id: 1,
        pull_request_url: 'https://api.github.com/repos/org/repo/pulls/1',
      });
      const fetchPRComments = vi.fn().mockResolvedValue([freshComment]);
      const githubPrsClient: IGithubPrsClient = {
        fetchPRs: vi.fn(),
        fetchPRComments,
      };
      const config = createSqliteConfig(providerDir);

      const repository = new GitHubPullRequestsFetchRepository(
        githubPrsClient,
        config as never,
        logger
      );

      const result = await repository.fetchPRComments(1);

      expect(fetchPRComments).toHaveBeenCalledWith(1);
      expect(result).toEqual([freshComment]);

      const saved = await loadPullRequestComments(providerDir);
      const ids = saved.map((c) => c.id).sort();
      expect(ids).toEqual([1, 99]);
    });

    it('bypasses the cache-hit guard but not the incremental guard when forceRefresh and incrementalUpdate are both set with cached comments present', async () => {
      const providerDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-comments-force-incr-'));
      const cachedCommentForPR1 = createComment({
        id: 1,
        pull_request_url: 'https://api.github.com/repos/org/repo/pulls/1',
        updated_at: '2026-05-10T00:00:00Z',
      });
      await seedPullRequestComments(providerDir, [cachedCommentForPR1]);

      const freshComment = createComment({
        id: 2,
        pull_request_url: 'https://api.github.com/repos/org/repo/pulls/1',
        updated_at: '2026-05-12T00:00:00Z',
      });
      const fetchPRComments = vi.fn().mockResolvedValue([freshComment]);
      const githubPrsClient: IGithubPrsClient = {
        fetchPRs: vi.fn(),
        fetchPRComments,
      };
      const config = createSqliteConfig(providerDir);

      const repository = new GitHubPullRequestsFetchRepository(
        githubPrsClient,
        config as never,
        logger
      );

      const result = await repository.fetchPRComments(1, {
        incrementalUpdate: true,
        forceRefresh: true,
      });

      // forceRefresh does NOT bypass the incremental guard: the merge path still runs,
      // not the plain-fetch/replace path.
      expect(fetchPRComments).toHaveBeenCalledWith(1);
      const ids = result.map((c) => c.id).sort();
      expect(ids).toEqual([1, 2]);
    });
  });
});
