import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import type { IGithubPrsClient } from '../../..';
import { GitHubPullRequestsFetchRepository } from '../../..';
import { RepositoryFactory } from '../../../infrastructure/repository-factory';
import type {
  PullRequestCommentJsonResponse,
  PullRequestJsonResponse,
  PullRequestLabelJsonResponse,
} from '../github-response-types';
import {
  PullRequestJsonResponseBuilder,
  PullRequestCommentJsonResponseBuilder,
} from '../../../test/github/github-builders';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';

const BUG_LABEL: PullRequestLabelJsonResponse = {
  id: '1',
  node_id: '',
  url: '',
  name: 'bug',
  color: '',
  default: false,
  description: '',
};

const FEATURE_LABEL: PullRequestLabelJsonResponse = {
  id: '2',
  node_id: '',
  url: '',
  name: 'feature',
  color: '',
  default: false,
  description: '',
};

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

describe('GitHubPullRequestsFetchRepository', () => {
  const logger = new MockLoggerBuilder().build();

  it('should perform incremental update fetching PRs created since latest cached update', async () => {
    const providerDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-pr-incr-'));
    const cachedPrs = [
      new PullRequestJsonResponseBuilder()
        .withId('1')
        .withCreatedAt('2026-05-01T00:00:00Z')
        .withUpdatedAt('2026-05-10T00:00:00Z')
        .withLabels([BUG_LABEL])
        .build(),
      new PullRequestJsonResponseBuilder()
        .withId('2')
        .withCreatedAt('2026-05-05T00:00:00Z')
        .withUpdatedAt('2026-05-15T00:00:00Z')
        .withLabels([BUG_LABEL])
        .build(),
    ];

    // Pre-populate cache
    await seedPullRequests(providerDir, cachedPrs);

    const newPrs = [
      new PullRequestJsonResponseBuilder()
        .withId('3')
        .withCreatedAt('2026-05-20T00:00:00Z')
        .withUpdatedAt('2026-05-20T00:00:00Z')
        .build(),
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
    const newPrs = [new PullRequestJsonResponseBuilder().withId('1').build()];

    const fetchPRs = vi.fn().mockResolvedValue(newPrs);
    const githubPrsClient: IGithubPrsClient = {
      fetchPRs,
      fetchPRComments: vi.fn(),
    };
    const config = {
      getPathFromGitProvider: (): string => providerDir,
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
      new PullRequestJsonResponseBuilder().withId('1').withTitle('Stale title').build(),
      new PullRequestJsonResponseBuilder().withId('2').withTitle('Untouched PR').build(),
    ];

    await seedPullRequests(providerDir, cachedPrs);

    const freshPrs = [
      new PullRequestJsonResponseBuilder().withId('1').withTitle('Fresh title').build(),
    ];

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
    const freshPrs = [new PullRequestJsonResponseBuilder().withId('1').build()];

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
    const cachedPrs = [
      new PullRequestJsonResponseBuilder().withId('1').build(),
      new PullRequestJsonResponseBuilder().withId('2').build(),
    ];
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
      new PullRequestJsonResponseBuilder()
        .withId('1')
        .withUpdatedAt('2026-05-15T00:00:00Z')
        .build(),
    ];
    await seedPullRequests(providerDir, cachedPrs);

    const freshPrs = [new PullRequestJsonResponseBuilder().withId('2').build()];
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
      fetchPRs: vi
        .fn()
        .mockResolvedValue([
          new PullRequestJsonResponseBuilder()
            .withId('1')
            .withAuthor('alice')
            .withLabels([BUG_LABEL])
            .build(),
          new PullRequestJsonResponseBuilder()
            .withId('2')
            .withAuthor('bob')
            .withLabels([FEATURE_LABEL])
            .build(),
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
      const cachedCommentForPR1 = new PullRequestCommentJsonResponseBuilder()
        .withId(1)
        .withPullRequestUrl('https://api.github.com/repos/org/repo/pulls/1')
        .withUpdatedAt('2026-05-10T00:00:00Z')
        .build();
      const cachedCommentForOtherPR = new PullRequestCommentJsonResponseBuilder()
        .withId(99)
        .withPullRequestUrl('https://api.github.com/repos/org/repo/pulls/2')
        .withUpdatedAt('2026-05-01T00:00:00Z')
        .build();
      await seedPullRequestComments(providerDir, [cachedCommentForPR1, cachedCommentForOtherPR]);

      const staleFreshComment = new PullRequestCommentJsonResponseBuilder()
        .withId(1)
        .withPullRequestUrl('https://api.github.com/repos/org/repo/pulls/1')
        .withUpdatedAt('2026-05-09T00:00:00Z')
        .withBody('should be excluded, older than cached latest')
        .build();
      const freshComment = new PullRequestCommentJsonResponseBuilder()
        .withId(2)
        .withPullRequestUrl('https://api.github.com/repos/org/repo/pulls/1')
        .withUpdatedAt('2026-05-12T00:00:00Z')
        .withBody('new comment after cached latest')
        .build();
      const noDateComment = new PullRequestCommentJsonResponseBuilder()
        .withId(3)
        .withPullRequestUrl('https://api.github.com/repos/org/repo/pulls/1')
        .withUpdatedAt(undefined as unknown as string)
        .withBody('always included regardless of date')
        .build();

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
      const cachedCommentForOtherPR = new PullRequestCommentJsonResponseBuilder()
        .withId(99)
        .withPullRequestUrl('https://api.github.com/repos/org/repo/pulls/2')
        .build();
      await seedPullRequestComments(providerDir, [cachedCommentForOtherPR]);

      const freshComment = new PullRequestCommentJsonResponseBuilder()
        .withId(1)
        .withPullRequestUrl('https://api.github.com/repos/org/repo/pulls/1')
        .build();
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
      const cachedCommentForPR1 = new PullRequestCommentJsonResponseBuilder()
        .withId(1)
        .withPullRequestUrl('https://api.github.com/repos/org/repo/pulls/1')
        .build();
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
      const cachedCommentForOtherPR = new PullRequestCommentJsonResponseBuilder()
        .withId(99)
        .withPullRequestUrl('https://api.github.com/repos/org/repo/pulls/2')
        .build();
      await seedPullRequestComments(providerDir, [cachedCommentForOtherPR]);

      const freshComment = new PullRequestCommentJsonResponseBuilder()
        .withId(1)
        .withPullRequestUrl('https://api.github.com/repos/org/repo/pulls/1')
        .build();
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
      const cachedCommentForPR1 = new PullRequestCommentJsonResponseBuilder()
        .withId(1)
        .withPullRequestUrl('https://api.github.com/repos/org/repo/pulls/1')
        .withUpdatedAt('2026-05-10T00:00:00Z')
        .build();
      await seedPullRequestComments(providerDir, [cachedCommentForPR1]);

      const freshComment = new PullRequestCommentJsonResponseBuilder()
        .withId(2)
        .withPullRequestUrl('https://api.github.com/repos/org/repo/pulls/1')
        .withUpdatedAt('2026-05-12T00:00:00Z')
        .build();
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
