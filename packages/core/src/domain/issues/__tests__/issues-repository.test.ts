import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { IssuesRepository } from '../../../domain/issues/issues-repository-json';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';
import { TimeZoneProvider } from '../../../infrastructure/timezone-provider';
import { Issue } from '../../../domain-types';
import { IJiraIssuesClient } from '../../../providers';
import { Configuration } from '../../../infrastructure/configuration';
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

function createJiraClient(overrides: Partial<IJiraIssuesClient> = {}): IJiraIssuesClient {
  return {
    fetchIssues: vi.fn().mockResolvedValue([]),
    fetchIssueChanges: vi.fn(),
    fetchIssueComments: vi.fn(),
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

describe('IssuesRepository', () => {
  const logger = new MockLoggerBuilder().build();
  const timeZoneProvider = new TimeZoneProvider('UTC');

  describe('refreshIssues', () => {
    it('incremental update with a non-empty cache fetches issues created after the latest cached date and merges them', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-issues-incr-'));
      const cachedIssues = [
        createIssue({ id: '1', createdAt: '2026-05-01T00:00:00.000Z' }),
        createIssue({ id: '2', createdAt: '2026-05-05T00:00:00.000Z' }),
      ];
      await seedIssues(cacheDir, cachedIssues);

      const freshIssue = createIssue({ id: '3', createdAt: '2026-05-20T00:00:00.000Z' });
      const fetchIssues = vi.fn().mockResolvedValue([freshIssue]);
      const jiraClient = createJiraClient({ fetchIssues });

      const repository = new IssuesRepository(
        jiraClient,
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
      });

      expect(result).toHaveLength(3);
      expect(result.map((issue) => issue.id).sort()).toEqual(['1', '2', '3']);
    });

    it('incremental update with an empty cache falls through to a plain fetch', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-issues-incr-empty-'));
      const fresh = [createIssue({ id: '1', createdAt: '2026-04-15T00:00:00.000Z' })];
      const fetchIssues = vi.fn().mockResolvedValue(fresh);
      const jiraClient = createJiraClient({ fetchIssues });

      const repository = new IssuesRepository(
        jiraClient,
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
      });
      expect(result).toEqual(fresh);
    });

    it('manual date range with a non-empty cache fetches for that range and merges with the cache', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-issues-range-'));
      const cachedIssue = createIssue({ id: '1', createdAt: '2026-04-01T00:00:00.000Z' });
      await seedIssues(cacheDir, [cachedIssue]);

      const freshIssue = createIssue({ id: '2', createdAt: '2026-04-15T00:00:00.000Z' });
      const fetchIssues = vi.fn().mockResolvedValue([freshIssue]);
      const jiraClient = createJiraClient({ fetchIssues });

      const repository = new IssuesRepository(
        jiraClient,
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
      const jiraClient = createJiraClient({ fetchIssues });

      const repository = new IssuesRepository(
        jiraClient,
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
      const jiraClient = createJiraClient({ fetchIssues });

      const repository = new IssuesRepository(
        jiraClient,
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

      expect(fetchIssues).toHaveBeenCalledWith(options);
      expect(result).toEqual(fresh);
    });

    it('returns cached issues directly without fetching when no date range or incremental flag is set', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-issues-cache-hit-'));
      const cachedIssues = [createIssue({ id: '1' }), createIssue({ id: '2' })];
      await seedIssues(cacheDir, cachedIssues);

      const fetchIssues = vi.fn();
      const jiraClient = createJiraClient({ fetchIssues });

      const repository = new IssuesRepository(
        jiraClient,
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
      const jiraClient = createJiraClient({ fetchIssues });

      const repository = new IssuesRepository(
        jiraClient,
        cacheDir,
        logger,
        timeZoneProvider,
        createSqliteConfig(cacheDir)
      );

      const result = await repository.refreshIssues({
        incrementalUpdate: true,
        forceRefresh: true,
      });

      // Guard 1 only checks `incrementalUpdate && fromCache.length > 0` — it never
      // inspects forceRefresh. So forceRefresh has no effect here: the incremental
      // merge branch still runs, fetching from the latest cached date and merging.
      expect(fetchIssues).toHaveBeenCalledWith({
        startDate: '2026-05-01T00:00:00.000Z',
        endDate: undefined,
        status: undefined,
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
      const jiraClient = createJiraClient({ fetchIssues });

      const repository = new IssuesRepository(
        jiraClient,
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
  });

  describe('getIssues', () => {
    it('delegates to refreshIssues with the given filters', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-issues-get-'));
      const fresh = [createIssue({ id: '1' })];
      const fetchIssues = vi.fn().mockResolvedValue(fresh);
      const jiraClient = createJiraClient({ fetchIssues });

      const repository = new IssuesRepository(
        jiraClient,
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
      });
      expect(result).toEqual(fresh);
    });
  });

  describe('getIssueChanges', () => {
    it('delegates to the jira client fetchIssueChanges', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-issues-changes-'));
      const changes = [{ id: 'change-1' }];
      const fetchIssueChanges = vi.fn().mockResolvedValue(changes);
      const jiraClient = createJiraClient({ fetchIssueChanges });

      const repository = new IssuesRepository(
        jiraClient,
        cacheDir,
        logger,
        timeZoneProvider,
        createSqliteConfig(cacheDir)
      );

      const result = await repository.getIssueChanges('PROJ-1');

      expect(fetchIssueChanges).toHaveBeenCalledWith('PROJ-1');
      expect(result).toEqual(changes);
    });
  });

  describe('getIssueComments', () => {
    it('delegates to the jira client fetchIssueComments', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-issues-comments-'));
      const comments = [{ id: 'comment-1' }];
      const fetchIssueComments = vi.fn().mockResolvedValue(comments);
      const jiraClient = createJiraClient({ fetchIssueComments });

      const repository = new IssuesRepository(
        jiraClient,
        cacheDir,
        logger,
        timeZoneProvider,
        createSqliteConfig(cacheDir)
      );

      const result = await repository.getIssueComments('PROJ-1');

      expect(fetchIssueComments).toHaveBeenCalledWith('PROJ-1');
      expect(result).toEqual(comments);
    });
  });
});
