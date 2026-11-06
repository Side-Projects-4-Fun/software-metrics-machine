import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { IssuesRepository } from '../../../domain/issues/issues-repository-json';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';
import { TimeZoneProvider } from '../../../infrastructure/timezone-provider';
import type { Issue, IssueComment } from '../../../domain-types';
import type { IIssuesClient } from '../../../providers';
import type { Configuration } from '../../../infrastructure/configuration';
import { RepositoryFactory } from '../../../infrastructure/repository-factory';

function createIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: '1',
    key: 'PROJ-1',
    title: 'Test issue',
    status: 'Open',
    createdAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

function createComment(overrides: Partial<IssueComment> = {}): IssueComment {
  return {
    id: 'comment-1',
    issueKey: 'PROJ-1',
    body: 'A comment',
    createdAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

function createIssuesClient(overrides: Partial<IIssuesClient> = {}): IIssuesClient {
  return {
    provider: 'jira',
    fetchIssues: vi.fn().mockResolvedValue([]),
    fetchComments: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function createSqliteConfig(baseDir: string): Configuration {
  return {
    internal: { storageType: 'sqlite' },
    getBaseDirectory: () => baseDir,
  } as never as Configuration;
}

async function seedIssues(baseDir: string, issues: Issue[]): Promise<void> {
  const config = createSqliteConfig(baseDir);
  const repo = RepositoryFactory.create<Issue>(
    `${baseDir}/issues.json`,
    new MockLoggerBuilder().build(),
    config
  );
  await repo.saveAll(issues);
}

async function seedComments(baseDir: string, comments: IssueComment[]): Promise<void> {
  const config = createSqliteConfig(baseDir);
  const repo = RepositoryFactory.create<IssueComment>(
    `${baseDir}/comments.json`,
    new MockLoggerBuilder().build(),
    config
  );
  await repo.saveAll(comments);
}

describe('IssuesRepository', () => {
  const logger = new MockLoggerBuilder().build();
  const timeZoneProvider = new TimeZoneProvider('UTC');

  describe('refreshIssues', () => {
    it('incremental update with a non-empty cache fetches issues updated after the latest cached date and merges them', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-issues-incr-'));
      const cachedIssues = [
        createIssue({ id: '1', createdAt: '2026-05-01T00:00:00.000Z' }),
        createIssue({ id: '2', createdAt: '2026-05-05T00:00:00.000Z' }),
      ];
      await seedIssues(cacheDir, cachedIssues);

      const freshIssue = createIssue({ id: '3', createdAt: '2026-05-20T00:00:00.000Z' });
      const fetchIssues = vi.fn().mockResolvedValue([freshIssue]);
      const issuesClient = createIssuesClient({ fetchIssues });

      const repository = new IssuesRepository(
        issuesClient,
        cacheDir,
        logger,
        timeZoneProvider,
        createSqliteConfig(cacheDir)
      );

      const result = await repository.refreshIssues({ incrementalUpdate: true });

      expect(fetchIssues).toHaveBeenCalledWith({
        startDate: '2026-05-05T00:00:00.000Z',
        endDate: undefined,
        status: undefined,
        labels: undefined,
      });

      expect(result).toHaveLength(3);
      expect(result.map((issue) => issue.id).sort()).toEqual(['1', '2', '3']);
    });

    it('incremental update uses updatedAt as the cursor when present', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-issues-incr-updated-'));
      await seedIssues(cacheDir, [
        createIssue({
          id: '1',
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-20T00:00:00.000Z',
        }),
      ]);

      const fetchIssues = vi.fn().mockResolvedValue([]);
      const issuesClient = createIssuesClient({ fetchIssues });

      const repository = new IssuesRepository(
        issuesClient,
        cacheDir,
        logger,
        timeZoneProvider,
        createSqliteConfig(cacheDir)
      );

      await repository.refreshIssues({ incrementalUpdate: true });

      expect(fetchIssues).toHaveBeenCalledWith({
        startDate: '2026-05-20T00:00:00.000Z',
        endDate: undefined,
        status: undefined,
        labels: undefined,
      });
    });

    it('incremental update with an empty cache falls through to a plain fetch', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-issues-incr-empty-'));
      const fresh = [createIssue({ id: '1', createdAt: '2026-04-15T00:00:00.000Z' })];
      const fetchIssues = vi.fn().mockResolvedValue(fresh);
      const issuesClient = createIssuesClient({ fetchIssues });

      const repository = new IssuesRepository(
        issuesClient,
        cacheDir,
        logger,
        timeZoneProvider,
        createSqliteConfig(cacheDir)
      );

      const options = { incrementalUpdate: true };
      const result = await repository.refreshIssues(options);

      expect(fetchIssues).toHaveBeenCalledWith({
        startDate: undefined,
        endDate: undefined,
        status: undefined,
        labels: undefined,
      });
      expect(result).toEqual(fresh);
    });

    it('manual date range with a non-empty cache fetches for that range and merges with the cache', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-issues-range-'));
      const cachedIssue = createIssue({ id: '1', createdAt: '2026-04-01T00:00:00.000Z' });
      await seedIssues(cacheDir, [cachedIssue]);

      const freshIssue = createIssue({ id: '2', createdAt: '2026-04-15T00:00:00.000Z' });
      const fetchIssues = vi.fn().mockResolvedValue([freshIssue]);
      const issuesClient = createIssuesClient({ fetchIssues });

      const repository = new IssuesRepository(
        issuesClient,
        cacheDir,
        logger,
        timeZoneProvider,
        createSqliteConfig(cacheDir)
      );

      const result = await repository.refreshIssues({
        startDate: '2026-04-01T00:00:00.000Z',
        endDate: '2026-04-30T00:00:00.000Z',
      });

      expect(fetchIssues).toHaveBeenCalledWith({
        startDate: '2026-04-01T00:00:00.000Z',
        endDate: '2026-04-30T00:00:00.000Z',
        status: undefined,
        labels: undefined,
      });
      expect(result).toHaveLength(2);
      expect(result.map((issue) => issue.id).sort()).toEqual(['1', '2']);
    });

    it('applies exact datetime filters after merging cached and fresh issues', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-issues-datetime-range-'));
      const beforeRange = createIssue({ id: '1', createdAt: '2026-04-01T07:00:00.000Z' });
      const cachedInRange = createIssue({ id: '2', createdAt: '2026-04-01T08:00:00.000Z' });
      await seedIssues(cacheDir, [beforeRange, cachedInRange]);

      const freshInRange = createIssue({ id: '3', createdAt: '2026-04-01T16:00:00.000Z' });
      const afterRange = createIssue({ id: '4', createdAt: '2026-04-01T18:00:00.000Z' });
      const fetchIssues = vi.fn().mockResolvedValue([freshInRange, afterRange]);
      const issuesClient = createIssuesClient({ fetchIssues });

      const repository = new IssuesRepository(
        issuesClient,
        cacheDir,
        logger,
        timeZoneProvider,
        createSqliteConfig(cacheDir)
      );

      const result = await repository.refreshIssues({
        startDate: '2026-04-01T08:30:00+01:00',
        endDate: '2026-04-01T17:45:00+01:00',
      });

      expect(result.map((issue) => issue.id).sort()).toEqual(['2', '3']);
    });

    it('manual date range with an empty cache falls through to a plain fetch', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-issues-range-empty-'));
      const fresh = [createIssue({ id: '1', createdAt: '2026-04-15T00:00:00.000Z' })];
      const fetchIssues = vi.fn().mockResolvedValue(fresh);
      const issuesClient = createIssuesClient({ fetchIssues });

      const repository = new IssuesRepository(
        issuesClient,
        cacheDir,
        logger,
        timeZoneProvider,
        createSqliteConfig(cacheDir)
      );

      const options = {
        startDate: '2026-04-01T00:00:00.000Z',
        endDate: '2026-04-30T00:00:00.000Z',
      };
      const result = await repository.refreshIssues(options);

      expect(fetchIssues).toHaveBeenCalledWith({
        startDate: options.startDate,
        endDate: options.endDate,
        labels: undefined,
        status: undefined,
      });
      expect(result).toEqual(fresh);
    });

    it('returns cached issues directly without fetching when no date range or incremental flag is set', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-issues-cache-hit-'));
      const cachedIssues = [createIssue({ id: '1' }), createIssue({ id: '2' })];
      await seedIssues(cacheDir, cachedIssues);

      const fetchIssues = vi.fn();
      const issuesClient = createIssuesClient({ fetchIssues });

      const repository = new IssuesRepository(
        issuesClient,
        cacheDir,
        logger,
        timeZoneProvider,
        createSqliteConfig(cacheDir)
      );

      const result = await repository.refreshIssues();

      expect(fetchIssues).not.toHaveBeenCalled();
      expect(result).toEqual(cachedIssues);
    });

    it('forceRefresh does NOT bypass the incremental branch when incrementalUpdate is also set on a non-empty cache', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-issues-force-incr-'));
      const cachedIssue = createIssue({ id: '1', createdAt: '2026-05-01T00:00:00.000Z' });
      await seedIssues(cacheDir, [cachedIssue]);

      const freshIssue = createIssue({ id: '2', createdAt: '2026-06-01T00:00:00.000Z' });
      const fetchIssues = vi.fn().mockResolvedValue([freshIssue]);
      const issuesClient = createIssuesClient({ fetchIssues });

      const repository = new IssuesRepository(
        issuesClient,
        cacheDir,
        logger,
        timeZoneProvider,
        createSqliteConfig(cacheDir)
      );

      const result = await repository.refreshIssues({
        incrementalUpdate: true,
        forceRefresh: true,
      });

      expect(fetchIssues).toHaveBeenCalledWith({
        startDate: '2026-05-01T00:00:00.000Z',
        endDate: undefined,
        status: undefined,
        labels: undefined,
      });
      expect(result).toHaveLength(2);
      expect(result.map((issue) => issue.id).sort()).toEqual(['1', '2']);
    });

    it('merging by id: the incoming fresh issue wins over the stale cached issue on collision', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-issues-merge-collision-'));
      const cachedIssue = createIssue({
        id: '1',
        createdAt: '2026-05-01T00:00:00.000Z',
        status: 'Open',
        title: 'Stale title',
      });
      await seedIssues(cacheDir, [cachedIssue]);

      const incomingIssue = createIssue({
        id: '1',
        createdAt: '2026-05-01T00:00:00.000Z',
        status: 'Done',
        title: 'Updated title',
      });
      const fetchIssues = vi.fn().mockResolvedValue([incomingIssue]);
      const issuesClient = createIssuesClient({ fetchIssues });

      const repository = new IssuesRepository(
        issuesClient,
        cacheDir,
        logger,
        timeZoneProvider,
        createSqliteConfig(cacheDir)
      );

      const result = await repository.refreshIssues({ incrementalUpdate: true });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('Done');
      expect(result[0].title).toBe('Updated title');
    });

    it('filters cached issues by label', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-issues-labels-'));
      await seedIssues(cacheDir, [
        createIssue({ id: '1', labels: ['backend'] }),
        createIssue({ id: '2', labels: ['frontend'] }),
      ]);

      const fetchIssues = vi.fn();
      const issuesClient = createIssuesClient({ fetchIssues });

      const repository = new IssuesRepository(
        issuesClient,
        cacheDir,
        logger,
        timeZoneProvider,
        createSqliteConfig(cacheDir)
      );

      const result = await repository.getIssues({ labels: ['BACKEND'] });

      expect(fetchIssues).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });
  });

  describe('getIssues', () => {
    it('delegates to refreshIssues with the given filters', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-issues-get-'));
      const fresh = [createIssue({ id: '1' })];
      const fetchIssues = vi.fn().mockResolvedValue(fresh);
      const issuesClient = createIssuesClient({ fetchIssues });

      const repository = new IssuesRepository(
        issuesClient,
        cacheDir,
        logger,
        timeZoneProvider,
        createSqliteConfig(cacheDir)
      );

      const result = await repository.getIssues({ status: 'Open' });

      expect(fetchIssues).toHaveBeenCalledWith({
        startDate: undefined,
        endDate: undefined,
        status: 'Open',
        labels: undefined,
      });
      expect(result).toEqual(fresh);
    });
  });

  describe('getComments', () => {
    it('fetches and caches comments for a single issue', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-comments-issue-'));
      const fetched = [createComment({ id: 'comment-1' })];
      const fetchComments = vi.fn().mockResolvedValue(fetched);
      const issuesClient = createIssuesClient({ fetchComments });

      const repository = new IssuesRepository(
        issuesClient,
        cacheDir,
        logger,
        timeZoneProvider,
        createSqliteConfig(cacheDir)
      );

      const result = await repository.getComments({ issueKey: 'PROJ-1' });

      expect(fetchComments).toHaveBeenCalledWith({ issueKey: 'PROJ-1' });
      expect(result).toEqual(fetched);
    });

    it('returns cached comments for a single issue without fetching', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-comments-cache-'));
      const cached = [createComment({ id: 'comment-1' })];
      await seedComments(cacheDir, cached);

      const fetchComments = vi.fn();
      const issuesClient = createIssuesClient({ fetchComments });

      const repository = new IssuesRepository(
        issuesClient,
        cacheDir,
        logger,
        timeZoneProvider,
        createSqliteConfig(cacheDir)
      );

      const result = await repository.getComments({ issueKey: 'PROJ-1' });

      expect(fetchComments).not.toHaveBeenCalled();
      expect(result).toEqual(cached);
    });

    it('forceRefresh replaces only the requested issue comments', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-comments-force-'));
      await seedComments(cacheDir, [
        createComment({ id: 'comment-1', issueKey: 'PROJ-1' }),
        createComment({ id: 'comment-2', issueKey: 'PROJ-2' }),
      ]);

      const fetched = [createComment({ id: 'comment-3', issueKey: 'PROJ-1' })];
      const fetchComments = vi.fn().mockResolvedValue(fetched);
      const issuesClient = createIssuesClient({ fetchComments });

      const repository = new IssuesRepository(
        issuesClient,
        cacheDir,
        logger,
        timeZoneProvider,
        createSqliteConfig(cacheDir)
      );

      const result = await repository.getComments({ issueKey: 'PROJ-1', forceRefresh: true });
      const otherIssue = await repository.getComments({ issueKey: 'PROJ-2' });

      expect(result).toEqual(fetched);
      expect(otherIssue.map((comment) => comment.id)).toEqual(['comment-2']);
    });

    it('fetches a comment window when no issue key is given', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-comments-window-'));
      const fetched = [createComment({ id: 'comment-1' })];
      const fetchComments = vi.fn().mockResolvedValue(fetched);
      const issuesClient = createIssuesClient({ fetchComments });

      const repository = new IssuesRepository(
        issuesClient,
        cacheDir,
        logger,
        timeZoneProvider,
        createSqliteConfig(cacheDir)
      );

      const result = await repository.getComments({
        startDate: '2026-05-01',
        endDate: '2026-05-31',
      });

      expect(fetchComments).toHaveBeenCalledWith({
        startDate: '2026-05-01T00:00:00.000Z',
        endDate: '2026-05-31T23:59:59.999Z',
      });
      expect(result).toEqual(fetched);
    });

    it('incremental update merges new comments by id', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-comments-incr-'));
      await seedComments(cacheDir, [
        createComment({
          id: 'comment-1',
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-10T00:00:00.000Z',
        }),
      ]);

      const fetched = [
        createComment({
          id: 'comment-2',
          createdAt: '2026-05-20T00:00:00.000Z',
          updatedAt: '2026-05-20T00:00:00.000Z',
        }),
      ];
      const fetchComments = vi.fn().mockResolvedValue(fetched);
      const issuesClient = createIssuesClient({ fetchComments });

      const repository = new IssuesRepository(
        issuesClient,
        cacheDir,
        logger,
        timeZoneProvider,
        createSqliteConfig(cacheDir)
      );

      const result = await repository.getComments({ incrementalUpdate: true });

      expect(fetchComments).toHaveBeenCalledWith({
        startDate: '2026-05-10T00:00:00.000Z',
        endDate: undefined,
      });
      expect(result.map((comment) => comment.id).sort()).toEqual(['comment-1', 'comment-2']);
    });

    it('filters cached comments by the requested window after merging an empty fetch', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-comments-window-cache-'));
      await seedComments(cacheDir, [
        createComment({ id: 'inside', createdAt: '2026-05-10T00:00:00.000Z' }),
        createComment({ id: 'outside', createdAt: '2026-04-01T00:00:00.000Z' }),
      ]);

      const fetchComments = vi.fn().mockResolvedValue([]);
      const issuesClient = createIssuesClient({ fetchComments });

      const repository = new IssuesRepository(
        issuesClient,
        cacheDir,
        logger,
        timeZoneProvider,
        createSqliteConfig(cacheDir)
      );

      const result = await repository.getComments({
        startDate: '2026-05-01',
        endDate: '2026-05-31',
      });

      expect(fetchComments).toHaveBeenCalledWith({
        startDate: '2026-05-01T00:00:00.000Z',
        endDate: '2026-05-31T23:59:59.999Z',
      });
      expect(result.map((comment) => comment.id)).toEqual(['inside']);
    });
  });
});
