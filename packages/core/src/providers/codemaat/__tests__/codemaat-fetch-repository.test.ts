import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Configuration } from '../../../infrastructure';
import { CodemaatFetchRepository } from '../codemaat-fetch-repository';
import { CodemaatFetchSqliteRepository } from '../codemaat-fetch-repository-sqlite';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';

describe('CodemaatFetchRepository', () => {
  const logger = new MockLoggerBuilder().build();

  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws when startDate is missing', () => {
    const configuration = new Configuration({ gitRepositoryLocation: '/some/path' });
    const repository = new CodemaatFetchRepository(configuration, logger);

    expect(() => repository.fetch({ startDate: '' })).toThrow(
      'startDate is required for CodeMaat fetch.'
    );
  });

  it('throws when no repository path is configured', () => {
    const configuration = new Configuration({ gitRepositoryLocation: '' });
    const repository = new CodemaatFetchRepository(configuration, logger);

    expect(() => repository.fetch({ startDate: '2026-01-01' })).toThrow(
      'Git repository path is not configured.'
    );
  });

  it('throws when the configured scriptPath does not exist', () => {
    const configuration = new Configuration({ gitRepositoryLocation: '/some/path' });
    const repository = new CodemaatFetchRepository(configuration, logger);
    const missingScriptPath = path.join(os.tmpdir(), 'smm-codemaat-missing-script.sh');

    expect(() =>
      repository.fetch({
        startDate: '2026-01-01',
        outputDirectory: fs.mkdtempSync(path.join(os.tmpdir(), 'smm-codemaat-out-')),
        scriptPath: missingScriptPath,
      })
    ).toThrow(`Configured scriptPath does not exist: ${missingScriptPath}`);
  });

  it('throws when no scriptPath is given and the default fetch-codemaat.sh cannot be located', () => {
    const configuration = new Configuration({ gitRepositoryLocation: '/some/path' });
    const repository = new CodemaatFetchRepository(configuration, logger);
    const expectedDefaultScriptPath = path.resolve(
      __dirname,
      '../../../../src/providers/apps/cli/fetch-codemaat.sh'
    );

    expect(() =>
      repository.fetch({
        startDate: '2026-01-01',
        outputDirectory: fs.mkdtempSync(path.join(os.tmpdir(), 'smm-codemaat-out-')),
      })
    ).toThrow(`Could not locate fetch-codemaat.sh at expected path: ${expectedDefaultScriptPath}`);
  });

  it('fetches successfully using a real script with default grouping depth, creating the output directory and returning its stdout', () => {
    const configuration = new Configuration({ gitRepositoryLocation: '/some/path' });
    const repository = new CodemaatFetchRepository(configuration, logger);

    const scriptDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'smm-codemaat-script-'));
    const scriptPath = path.join(scriptDirectory, 'fetch-codemaat.sh');
    fs.writeFileSync(scriptPath, 'echo "ran: $1 $2 $3 $4 $5 $6 $7"');

    const outputBaseDirectory = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'smm-codemaat-out-')),
      'nested'
    );

    const result = repository.fetch({
      repositoryPath: '/explicit/repo/path',
      outputDirectory: outputBaseDirectory,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      subfolder: 'sub',
      force: true,
      scriptPath,
    });

    const outputDirectory = path.join(outputBaseDirectory, '2026-01-01_to_2026-01-31');

    expect(fs.existsSync(outputDirectory)).toBe(true);
    expect(result).toEqual({
      repository: '/explicit/repo/path',
      outputDirectory,
      stdout: `ran: /explicit/repo/path ${outputDirectory} 2026-01-01 2026-01-31 sub true \n`,
    });
  });

  it('passes groupDepth override to the fetch script', () => {
    const configuration = new Configuration({ gitRepositoryLocation: '/some/path' });
    const repository = new CodemaatFetchRepository(configuration, logger);

    const scriptDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'smm-codemaat-script-'));
    const scriptPath = path.join(scriptDirectory, 'fetch-codemaat.sh');
    fs.writeFileSync(scriptPath, 'echo "depth: $7"');

    const outputBaseDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'smm-codemaat-out-'));

    const result = repository.fetch({
      repositoryPath: '/explicit/repo/path',
      outputDirectory: outputBaseDirectory,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      subfolder: '',
      force: false,
      groupDepth: 4,
      scriptPath,
    });

    expect(result.stdout).toBe('depth: 4\n');
  });

  it('stores fetchedAt using the analysis run timestamp and creates a new snapshot on later runs', async () => {
    const storeData = fs.mkdtempSync(path.join(os.tmpdir(), 'smm-codemaat-sqlite-store-'));
    const configuration = new Configuration({
      storeData,
      gitProvider: 'github',
      githubRepository: 'owner/repo',
      gitRepositoryLocation: '/tmp/repo',
      internal: { storageType: 'sqlite' },
    });

    const repository = new CodemaatFetchSqliteRepository(configuration, logger);
    const codemaatDir = configuration.getCodeMaatPath();
    fs.mkdirSync(codemaatDir, { recursive: true });

    fs.writeFileSync(
      path.join(codemaatDir, 'abs-churn.csv'),
      ['date,added,deleted,commits', '2026-01-01,10,1,1'].join('\n')
    );

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T10:00:00.000Z'));
    await repository.persistFetchedMetrics();

    fs.writeFileSync(
      path.join(codemaatDir, 'abs-churn.csv'),
      ['date,added,deleted,commits', '2026-01-01,99,9,2'].join('\n')
    );

    vi.setSystemTime(new Date('2026-07-14T11:30:00.000Z'));
    await repository.persistFetchedMetrics();

    const dbPath = path.join(configuration.getBaseDirectory(), 'smm.sqlite');
    const db = new DatabaseSync(dbPath);
    try {
      const snapshots = db
        .prepare(
          `SELECT added, deleted, commits, fetched_at
           FROM codemaat_code_churn
           ORDER BY position ASC`
        )
        .all() as Array<{ added: number; deleted: number; commits: number; fetched_at: string }>;

      expect(snapshots).toEqual([
        {
          added: 10,
          deleted: 1,
          commits: 1,
          fetched_at: '2026-07-14T10:00:00.000Z',
        },
        {
          added: 99,
          deleted: 9,
          commits: 2,
          fetched_at: '2026-07-14T11:30:00.000Z',
        },
      ]);
    } finally {
      db.close();
      fs.rmSync(storeData, { recursive: true, force: true });
    }
  });

  it('uses one fetchedAt value across all tables for a single run', async () => {
    const storeData = fs.mkdtempSync(path.join(os.tmpdir(), 'smm-codemaat-sqlite-run-'));
    const configuration = new Configuration({
      storeData,
      gitProvider: 'github',
      githubRepository: 'owner/repo',
      gitRepositoryLocation: '/tmp/repo',
      internal: { storageType: 'sqlite' },
    });

    const repository = new CodemaatFetchSqliteRepository(configuration, logger);
    const codemaatDir = configuration.getCodeMaatPath();
    fs.mkdirSync(codemaatDir, { recursive: true });

    fs.writeFileSync(
      path.join(codemaatDir, 'abs-churn.csv'),
      ['date,added,deleted,commits', '2026-01-01,10,1,1'].join('\n')
    );
    fs.writeFileSync(
      path.join(codemaatDir, 'coupling.csv'),
      ['entity,coupled,degree,average-revs', 'src/a.ts,src/b.ts,40,3'].join('\n')
    );
    fs.writeFileSync(
      path.join(codemaatDir, 'entity-churn.csv'),
      ['entity,added,deleted,commits', 'src/a.ts,10,1,1'].join('\n')
    );
    fs.writeFileSync(
      path.join(codemaatDir, 'entity-effort.csv'),
      ['entity,total-revs', 'src/a.ts,2'].join('\n')
    );
    fs.writeFileSync(
      path.join(codemaatDir, 'entity-ownership.csv'),
      ['entity,author,added,deleted', 'src/a.ts,Ada,10,1'].join('\n')
    );

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T12:00:00.000Z'));
    await repository.persistFetchedMetrics();

    const dbPath = path.join(configuration.getBaseDirectory(), 'smm.sqlite');
    const db = new DatabaseSync(dbPath);
    try {
      const churnFetchedAt = db
        .prepare('SELECT fetched_at FROM codemaat_code_churn LIMIT 1')
        .get() as { fetched_at: string };
      const couplingFetchedAt = db
        .prepare('SELECT fetched_at FROM codemaat_file_coupling LIMIT 1')
        .get() as { fetched_at: string };
      const entityChurnFetchedAt = db
        .prepare('SELECT fetched_at FROM codemaat_entity_churn LIMIT 1')
        .get() as { fetched_at: string };
      const entityEffortFetchedAt = db
        .prepare('SELECT fetched_at FROM codemaat_entity_effort LIMIT 1')
        .get() as { fetched_at: string };
      const ownershipFetchedAt = db
        .prepare('SELECT fetched_at FROM codemaat_entity_ownership LIMIT 1')
        .get() as { fetched_at: string };

      expect(churnFetchedAt.fetched_at).toBe('2026-07-14T12:00:00.000Z');
      expect(couplingFetchedAt.fetched_at).toBe('2026-07-14T12:00:00.000Z');
      expect(entityChurnFetchedAt.fetched_at).toBe('2026-07-14T12:00:00.000Z');
      expect(entityEffortFetchedAt.fetched_at).toBe('2026-07-14T12:00:00.000Z');
      expect(ownershipFetchedAt.fetched_at).toBe('2026-07-14T12:00:00.000Z');
    } finally {
      db.close();
      fs.rmSync(storeData, { recursive: true, force: true });
    }
  });
});
