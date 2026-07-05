import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Logger } from '@smmachine/utils';
import {
  Configuration,
  IRepository,
  RepositoryFactory,
  SqliteRepository,
} from '..';
import { Commit } from '../../domain-types';
import {
  CommitBuilder,
  PullRequestCommentJsonResponseBuilder,
  PullRequestJsonResponseBuilder,
} from '../../test/builders';
import { PipelineGitHubJobBuilder, PipelineGitHubRunBuilder } from '../../test';
import {
  PullRequestCommentJsonResponse,
  PullRequestJsonResponse,
  WorkflowJobJsonResponse,
  WorkflowJsonResponse,
} from '../../providers/github/github-response-types';

type TestRecord = {
  id: number;
  name: string;
};

describe('sqlite repository implementations', () => {
  let tempDir: string | undefined;
  const logger = new Logger('RepositoryTest', 'CRITICAL');

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  function createTempDir(): string {
    tempDir = mkdtempSync(join(tmpdir(), 'smm-repository-'));
    return tempDir;
  }

  function repositoryCases(): Array<[string, () => IRepository<TestRecord>]> {
    return [
      [
        'sqlite',
        () =>
          new SqliteRepository<TestRecord>(join(createTempDir(), 'smm.sqlite'), 'records.json', logger),
      ],
    ];
  }

  describe.each(repositoryCases())('%s repository', (_, createRepository) => {
    it('returns an empty array when no records exist', async () => {
      const repository = createRepository();

      await expect(repository.loadAll()).resolves.toEqual([]);
      await expect(repository.exists()).resolves.toBe(false);
    });

    it('saves and loads all records preserving order', async () => {
      const repository = createRepository();
      const records = [
        { id: 2, name: 'second' },
        { id: 1, name: 'first' },
      ];

      await repository.saveAll(records);

      await expect(repository.exists()).resolves.toBe(true);
      await expect(repository.loadAll()).resolves.toEqual(records);
    });

    it('overwrites records on saveAll', async () => {
      const repository = createRepository();

      await repository.saveAll([{ id: 1, name: 'before' }]);
      await repository.saveAll([{ id: 2, name: 'after' }]);

      await expect(repository.loadAll()).resolves.toEqual([{ id: 2, name: 'after' }]);
    });

    it('saves and loads a singleton record', async () => {
      const repository = createRepository();

      await repository.save({ id: 1, name: 'single' });

      await expect(repository.load()).resolves.toEqual({ id: 1, name: 'single' });
    });

    it('deletes records', async () => {
      const repository = createRepository();

      await repository.saveAll([{ id: 1, name: 'stored' }]);
      await repository.delete();

      await expect(repository.exists()).resolves.toBe(false);
      await expect(repository.loadAll()).resolves.toEqual([]);
    });
  });

  it('initializes an empty SQLite database file', async () => {
    const dbPath = join(createTempDir(), 'project', 'smm.sqlite');
    const repository = new SqliteRepository<TestRecord>(dbPath, 'records.json', logger);

    await repository.initialize();

    expect(existsSync(dbPath)).toBe(true);
    await expect(repository.exists()).resolves.toBe(false);
  });

  describe('SQLite pipeline tables', () => {
    let tempDir: string | undefined;
    const logger = new Logger('SqlitePipelineTest', 'CRITICAL');

    afterEach(() => {
      if (tempDir) {
        rmSync(tempDir, { recursive: true, force: true });
        tempDir = undefined;
      }
    });

    function createDatabasePath(): string {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-sqlite-pipelines-'));
      return join(tempDir, 'smm.sqlite');
    }

    it('stores workflow runs in the normalized workflow_runs table', async () => {
      const dbPath = createDatabasePath();
      const repository = new SqliteRepository<WorkflowJsonResponse>(
        dbPath,
        'github/pipeline-runs',
        logger
      );
      const runs = [
        new PipelineGitHubRunBuilder()
          .id('run-1')
          .number('10')
          .name('CI')
          .path('.github/workflows/ci.yml')
          .event('push')
          .status('completed')
          .conclusion('success')
          .branch('main')
          .createdAt('2026-01-01T00:00:00Z')
          .updatedAt('2026-01-01T00:05:00Z')
          .startedAt('2026-01-01T00:01:00Z')
          .build(),
      ];

      await repository.saveAll(runs);

      expect(await repository.loadAll()).toEqual(runs);

      const db = new DatabaseSync(dbPath);
      const row = db
        .prepare(
          `SELECT id, path, status, conclusion, head_branch, created_at
           FROM workflow_runs
           WHERE namespace = ?`
        )
        .get('github/pipeline-runs') as Record<string, unknown>;
      db.close();

      expect(row).toMatchObject({
        id: 'run-1',
        path: '.github/workflows/ci.yml',
        status: 'completed',
        conclusion: 'success',
        head_branch: 'main',
        created_at: '2026-01-01T00:00:00Z',
      });
    });

    it('stores workflow jobs in the normalized workflow_jobs table', async () => {
      const dbPath = createDatabasePath();
      const repository = new SqliteRepository<WorkflowJobJsonResponse>(
        dbPath,
        'github/pipeline-jobs',
        logger
      );
      const jobs = [
        new PipelineGitHubJobBuilder()
          .id('100')
          .runId('run-1')
          .name('test')
          .status('completed')
          .conclusion('success')
          .startedAt('2026-01-01T00:01:00Z')
          .completedAt('2026-01-01T00:04:00Z')
          .build(),
      ];

      await repository.saveAll(jobs);

      expect(await repository.loadAll()).toEqual(jobs);

      const db = new DatabaseSync(dbPath);
      const row = db
        .prepare(
          `SELECT id, run_id, name, status, conclusion, completed_at
           FROM workflow_jobs
           WHERE namespace = ?`
        )
        .get('github/pipeline-jobs') as Record<string, unknown>;
      db.close();

      expect(row).toMatchObject({
        id: '100',
        run_id: 'run-1',
        name: 'test',
        status: 'completed',
        conclusion: 'success',
        completed_at: '2026-01-01T00:04:00Z',
      });
    });
  });

  describe('SQLite commit table', () => {
    let tempDir: string | undefined;
    const logger = new Logger('SqliteCommitTest', 'CRITICAL');

    afterEach(() => {
      if (tempDir) {
        rmSync(tempDir, { recursive: true, force: true });
        tempDir = undefined;
      }
    });

    function createDatabasePath(): string {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-sqlite-commits-'));
      return join(tempDir, 'smm.sqlite');
    }

    it('stores commits in the normalized commits table', async () => {
      const dbPath = createDatabasePath();
      const repository = new SqliteRepository<Commit>(dbPath, 'git/commits.json', logger);
      const commits = [
        new CommitBuilder()
          .withHash('abc123')
          .withAuthor('Ada Lovelace')
          .withEmail('ada@example.com')
          .withMessage('Add SQLite support')
          .withSubject('Add SQLite support')
          .withTimestamp('2026-01-01T00:00:00Z')
          .withCoAuthors(['Grace Hopper'])
          .withFiles([
            {
              path: 'src/index.ts',
              additions: 10,
              deletions: 2,
              status: 'modified',
            },
          ])
          .build(),
      ] satisfies Commit[];

      await repository.saveAll(commits);

      expect(await repository.loadAll()).toEqual(commits);

      const db = new DatabaseSync(dbPath);
      const row = db
        .prepare(
          `SELECT hash, author, email, subject, timestamp, co_authors_json, files_json
           FROM commits
           WHERE namespace = ?`
        )
        .get('git/commits.json') as Record<string, unknown>;
      db.close();

      expect(row).toMatchObject({
        hash: 'abc123',
        author: 'Ada Lovelace',
        email: 'ada@example.com',
        subject: 'Add SQLite support',
        timestamp: '2026-01-01T00:00:00Z',
        co_authors_json: JSON.stringify(['Grace Hopper']),
        files_json: JSON.stringify(commits[0].files),
      });
    });
  });

  describe('SQLite pull request tables', () => {
    let tempDir: string | undefined;
    const logger = new Logger('SqlitePullRequestTest', 'CRITICAL');

    afterEach(() => {
      if (tempDir) {
        rmSync(tempDir, { recursive: true, force: true });
        tempDir = undefined;
      }
    });

    function createDatabasePath(): string {
      tempDir = mkdtempSync(join(tmpdir(), 'smm-sqlite-prs-'));
      return join(tempDir, 'smm.sqlite');
    }

    it('stores pull requests in the normalized pull_requests table', async () => {
      const dbPath = createDatabasePath();
      const repository = new SqliteRepository<PullRequestJsonResponse>(
        dbPath,
        'github/prs.json',
        logger
      );
      const prs = [
        new PullRequestJsonResponseBuilder()
          .withId('pr-1')
          .withNumber('42')
          .withState('closed')
          .withTitle('Add sqlite')
          .withCreatedAt('2026-01-01T00:00:00Z')
          .withUpdatedAt('2026-01-02T00:00:00Z')
          .withClosedAt('2026-01-03T00:00:00Z')
          .withMergedAt('2026-01-03T00:00:00Z')
          .withUrl('https://github.example/pull/42')
          .withLabels([])
          .withAuthor('octocat', 1)
          .build(),
      ];

      await repository.saveAll(prs);

      expect(await repository.loadAll()).toEqual(prs);

      const db = new DatabaseSync(dbPath);
      const row = db
        .prepare(
          `SELECT id, number, state, title, author_login, author_id, created_at, merged_at
           FROM pull_requests
           WHERE namespace = ?`
        )
        .get('github/prs.json') as Record<string, unknown>;
      db.close();

      expect(row).toMatchObject({
        id: 'pr-1',
        number: 42,
        state: 'closed',
        title: 'Add sqlite',
        author_login: 'octocat',
        author_id: '1',
        created_at: '2026-01-01T00:00:00Z',
        merged_at: '2026-01-03T00:00:00Z',
      });
    });

    it('stores pull request comments in the normalized pull_request_comments table', async () => {
      const dbPath = createDatabasePath();
      const repository = new SqliteRepository<PullRequestCommentJsonResponse>(
        dbPath,
        'github/pr-comments.json',
        logger
      );
      const comments = [
        new PullRequestCommentJsonResponseBuilder()
          .withId(100)
          .withPullRequestUrl('https://api.github.example/repos/owner/repo/pulls/42')
          .withPath('src/index.ts')
          .withBody('Looks good')
          .withCreatedAt('2026-01-01T00:10:00Z')
          .withUpdatedAt('2026-01-01T00:11:00Z')
          .withHtmlUrl('https://github.example/pull/42#discussion_r100')
          .withAuthor('reviewer', 2)
          .build(),
      ];

      await repository.saveAll(comments);

      expect(await repository.loadAll()).toEqual(comments);

      const db = new DatabaseSync(dbPath);
      const row = db
        .prepare(
          `SELECT id, pull_request_number, pull_request_url, author_login, author_id, path, created_at
           FROM pull_request_comments
           WHERE namespace = ?`
        )
        .get('github/pr-comments.json') as Record<string, unknown>;
      db.close();

      expect(row).toMatchObject({
        id: '100',
        pull_request_number: 42,
        pull_request_url: 'https://api.github.example/repos/owner/repo/pulls/42',
        author_login: 'reviewer',
        author_id: '2',
        path: 'src/index.ts',
        created_at: '2026-01-01T00:10:00Z',
      });
    });
  });

  describe('RepositoryFactory', () => {
    const logger = new Logger('RepositoryFactoryTest', 'CRITICAL');

    it('creates SQLite repositories when storageType is sqlite', () => {
      const config = new Configuration({
        storeData: '/tmp/smm',
        gitProvider: 'github',
        githubRepository: 'owner/repo',
        internal: { storageType: 'sqlite' },
      });

      const repository = RepositoryFactory.create<TestRecord>(
        '/tmp/smm/github_owner_repo/github/pipeline-runs',
        logger,
        config
      );

      expect(repository).toBeInstanceOf(SqliteRepository);
    });

    it('stores SQLite databases inside each project base directory', () => {
      const firstProject = new Configuration({
        storeData: '/tmp/smm',
        gitProvider: 'github',
        githubRepository: 'owner/repo-a',
        internal: { storageType: 'sqlite' },
      });
      const secondProject = new Configuration({
        storeData: '/tmp/smm',
        gitProvider: 'github',
        githubRepository: 'owner/repo-b',
        internal: { storageType: 'sqlite' },
      });

      expect(RepositoryFactory.getSqliteDatabasePath(firstProject)).toBe(
        '/tmp/smm/github_owner_repo-a/smm.sqlite'
      );
      expect(RepositoryFactory.getSqliteDatabasePath(secondProject)).toBe(
        '/tmp/smm/github_owner_repo-b/smm.sqlite'
      );
    });

    it('keeps SQLite namespaces relative to the project base directory', () => {
      const config = new Configuration({
        storeData: '/tmp/smm',
        gitProvider: 'github',
        githubRepository: 'owner/repo',
        internal: { storageType: 'sqlite' },
      });

      expect(
        RepositoryFactory.getSqliteNamespace(
          '/tmp/smm/github_owner_repo/github/prs.json',
          config
        )
      ).toBe('github/prs.json');
    });

    it('uses one semantic SQLite namespace for pipeline tables', () => {
      const config = new Configuration({
        storeData: '/tmp/smm',
        gitProvider: 'github',
        githubRepository: 'owner/repo',
        internal: { storageType: 'sqlite' },
      });

      expect(RepositoryFactory.getPipelineRunsSqliteNamespace(config)).toBe('github/pipeline-runs');
      expect(RepositoryFactory.getPipelineJobsSqliteNamespace(config)).toBe('github/pipeline-jobs');
    });

    it('uses the default Git provider in project paths when gitProvider is unset', () => {
      const config = new Configuration({
        storeData: '/tmp/smm',
        githubRepository: 'owner/repo',
        internal: { storageType: 'sqlite' },
      });

      expect(config.getPathFromGitProvider()).toBe('/tmp/smm/github_owner_repo/github');
      expect(RepositoryFactory.getSqliteDatabasePath(config)).toBe(
        '/tmp/smm/github_owner_repo/smm.sqlite'
      );
    });
  });
});
