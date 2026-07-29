import { DatabaseSync } from 'node:sqlite';

const BUSY_TIMEOUT_MS = 1000;

export function openSqliteConnection(dbPath: string): DatabaseSync {
  return new DatabaseSync(dbPath, { timeout: BUSY_TIMEOUT_MS });
}
