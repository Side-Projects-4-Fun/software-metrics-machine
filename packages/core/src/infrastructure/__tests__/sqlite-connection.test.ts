import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applySqliteMigrations, openSqliteConnection } from '..';

describe('sqlite connection utility', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  function createTempDir(): string {
    tempDir = mkdtempSync(join(tmpdir(), 'smm-connection-'));
    return tempDir;
  }

  it('creates a connection that can execute queries', () => {
    const dbPath = join(createTempDir(), 'smm.sqlite');
    const db = openSqliteConnection(dbPath);

    try {
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
      db.prepare('INSERT INTO test (id, name) VALUES (?, ?)').run(1, 'hello');
      const row = db.prepare('SELECT name FROM test WHERE id = ?').get(1) as {
        name: string;
      };

      expect(row.name).toBe('hello');
    } finally {
      db.close();
    }
  });
});

describe('WAL mode via migrations', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  function createTempDir(): string {
    tempDir = mkdtempSync(join(tmpdir(), 'smm-wal-'));
    return tempDir;
  }

  it('enables WAL journal mode when migrations are applied', () => {
    const dbPath = join(createTempDir(), 'smm.sqlite');
    const db = openSqliteConnection(dbPath);

    try {
      applySqliteMigrations(db);

      const row = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
      expect(row.journal_mode).toBe('wal');
    } finally {
      db.close();
    }
  });

  it('retains WAL mode on subsequent connections to the same database', () => {
    const dbPath = join(createTempDir(), 'smm.sqlite');

    const firstDb = openSqliteConnection(dbPath);
    try {
      applySqliteMigrations(firstDb);
    } finally {
      firstDb.close();
    }

    const secondDb = openSqliteConnection(dbPath);
    try {
      const row = secondDb.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
      expect(row.journal_mode).toBe('wal');
    } finally {
      secondDb.close();
    }
  });
});
