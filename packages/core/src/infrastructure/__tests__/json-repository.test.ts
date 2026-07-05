import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Logger } from '@smmachine/utils';
import {
  IRepository,
  JsonFileSystemRepository,
} from '..';

type TestRecord = {
  id: number;
  name: string;
};

describe('json repository implementations', () => {
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
