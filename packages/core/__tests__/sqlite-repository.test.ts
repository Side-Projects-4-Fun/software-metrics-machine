import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Logger } from '@smmachine/utils';
import {
  Configuration,
  IRepository,
  JsonFileSystemRepository,
  RepositoryFactory,
  SqliteRepository,
} from '../src/infrastructure';
import {
  WorkflowJobJsonResponse,
  WorkflowJsonResponse,
} from '../src/providers/github/github-response-types';

type TestRecord = {
  id: number;
  name: string;
};

describe('repository implementations', () => {
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
        'json',
        () => new JsonFileSystemRepository<TestRecord>(join(createTempDir(), 'records.json'), logger),
      ],
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
      'github/workflows.json',
      logger
    );
    const runs = [
      {
        id: 'run-1',
        run_number: 10,
        name: 'CI',
        path: '.github/workflows/ci.yml',
        event: 'push',
        status: 'completed',
        conclusion: 'success',
        head_branch: 'main',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:05:00Z',
        run_started_at: '2026-01-01T00:01:00Z',
        run_attempt: 1,
      } as WorkflowJsonResponse,
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
      .get('github/workflows.json') as Record<string, unknown>;
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
      'github/jobs.json',
      logger
    );
    const jobs = [
      {
        id: 100,
        run_id: 'run-1',
        name: 'test',
        status: 'completed',
        conclusion: 'success',
        started_at: '2026-01-01T00:01:00Z',
        completed_at: '2026-01-01T00:04:00Z',
      } as WorkflowJobJsonResponse,
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
      .get('github/jobs.json') as Record<string, unknown>;
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
      '/tmp/smm/github_owner_repo/github/workflows.json',
      logger,
      config
    );

    expect(repository).toBeInstanceOf(SqliteRepository);
  });
});
