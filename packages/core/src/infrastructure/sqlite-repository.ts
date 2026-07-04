import * as fs from 'fs/promises';
import * as path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { Logger } from '@smmachine/utils';
import { IRepository } from './repository';

type PayloadRow = {
  payload: string;
};

type RecordLike = Record<string, unknown>;

/**
 * SQLite-backed implementation of IRepository.
 *
 * Pipeline runs and jobs are persisted into normalized tables with the original
 * provider payload retained for compatibility with the existing domain mappers.
 * Other repository namespaces use a small generic payload table.
 */
export class SqliteRepository<T> implements IRepository<T> {
  constructor(
    private readonly dbPath: string,
    private readonly namespace: string,
    private readonly logger: Logger
  ) {}

  serialize(item: T): string {
    return JSON.stringify(item);
  }

  deserialize(data: string): T {
    return JSON.parse(data) as T;
  }

  async save(item: T): Promise<void> {
    await this.ensureDirectoryExists();
    const db = this.openDatabase();
    try {
      this.ensureSchema(db);
      db.prepare(
        `INSERT OR REPLACE INTO repository_records
          (namespace, record_key, payload, position, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(this.namespace, '__singleton__', this.serialize(item), 0, new Date().toISOString());
    } finally {
      db.close();
    }
  }

  async saveAll(items: T[]): Promise<void> {
    await this.ensureDirectoryExists();
    const db = this.openDatabase();
    try {
      this.ensureSchema(db);
      db.exec('BEGIN IMMEDIATE TRANSACTION');
      try {
        if (this.isWorkflowRunsNamespace()) {
          this.saveWorkflowRuns(db, items);
        } else if (this.isWorkflowJobsNamespace()) {
          this.saveWorkflowJobs(db, items);
        } else {
          this.saveGenericRecords(db, items);
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    } finally {
      db.close();
    }
  }

  async load(): Promise<T | null> {
    await this.ensureDirectoryExists();
    const db = this.openDatabase();
    try {
      this.ensureSchema(db);
      const row = db
        .prepare(
          `SELECT payload
           FROM repository_records
           WHERE namespace = ?
           ORDER BY CASE WHEN record_key = '__singleton__' THEN 0 ELSE 1 END, position ASC
           LIMIT 1`
        )
        .get(this.namespace) as PayloadRow | undefined;

      return row ? this.deserialize(row.payload) : null;
    } finally {
      db.close();
    }
  }

  async loadAll(): Promise<T[]> {
    await this.ensureDirectoryExists();
    const db = this.openDatabase();
    try {
      this.ensureSchema(db);
      this.logger.debug(`Loading all items from SQLite namespace ${this.namespace}`);

      const rows = this.loadRows(db);
      return rows.map((row) => this.deserialize(row.payload));
    } finally {
      db.close();
    }
  }

  async delete(): Promise<void> {
    await this.ensureDirectoryExists();
    const db = this.openDatabase();
    try {
      this.ensureSchema(db);
      if (this.isWorkflowRunsNamespace()) {
        db.prepare('DELETE FROM workflow_runs WHERE namespace = ?').run(this.namespace);
      } else if (this.isWorkflowJobsNamespace()) {
        db.prepare('DELETE FROM workflow_jobs WHERE namespace = ?').run(this.namespace);
      } else {
        db.prepare('DELETE FROM repository_records WHERE namespace = ?').run(this.namespace);
      }
    } finally {
      db.close();
    }
  }

  async exists(): Promise<boolean> {
    await this.ensureDirectoryExists();
    const db = this.openDatabase();
    try {
      this.ensureSchema(db);
      const tableName = this.getTableName();
      const row = db
        .prepare(`SELECT 1 FROM ${tableName} WHERE namespace = ? LIMIT 1`)
        .get(this.namespace);
      return Boolean(row);
    } finally {
      db.close();
    }
  }

  private openDatabase(): DatabaseSync {
    return new DatabaseSync(this.dbPath);
  }

  private ensureSchema(db: DatabaseSync): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS repository_records (
        namespace TEXT NOT NULL,
        record_key TEXT NOT NULL,
        payload TEXT NOT NULL,
        position INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (namespace, record_key)
      );

      CREATE INDEX IF NOT EXISTS idx_repository_records_namespace_position
        ON repository_records(namespace, position);

      CREATE TABLE IF NOT EXISTS workflow_runs (
        namespace TEXT NOT NULL,
        id TEXT NOT NULL,
        run_number INTEGER,
        name TEXT,
        path TEXT,
        event TEXT,
        status TEXT,
        conclusion TEXT,
        head_branch TEXT,
        created_at TEXT,
        updated_at TEXT,
        run_started_at TEXT,
        run_attempt INTEGER,
        payload TEXT NOT NULL,
        position INTEGER NOT NULL,
        stored_at TEXT NOT NULL,
        PRIMARY KEY (namespace, id)
      );

      CREATE INDEX IF NOT EXISTS idx_workflow_runs_namespace_position
        ON workflow_runs(namespace, position);
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_created_at
        ON workflow_runs(namespace, created_at);
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_path
        ON workflow_runs(namespace, path);
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_status
        ON workflow_runs(namespace, status);
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_conclusion
        ON workflow_runs(namespace, conclusion);
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_head_branch
        ON workflow_runs(namespace, head_branch);

      CREATE TABLE IF NOT EXISTS workflow_jobs (
        namespace TEXT NOT NULL,
        id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        name TEXT,
        status TEXT,
        conclusion TEXT,
        started_at TEXT,
        completed_at TEXT,
        payload TEXT NOT NULL,
        position INTEGER NOT NULL,
        stored_at TEXT NOT NULL,
        PRIMARY KEY (namespace, id)
      );

      CREATE INDEX IF NOT EXISTS idx_workflow_jobs_namespace_position
        ON workflow_jobs(namespace, position);
      CREATE INDEX IF NOT EXISTS idx_workflow_jobs_run_id
        ON workflow_jobs(namespace, run_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_jobs_name
        ON workflow_jobs(namespace, name);
      CREATE INDEX IF NOT EXISTS idx_workflow_jobs_conclusion
        ON workflow_jobs(namespace, conclusion);
      CREATE INDEX IF NOT EXISTS idx_workflow_jobs_completed_at
        ON workflow_jobs(namespace, completed_at);
    `);
  }

  private saveGenericRecords(db: DatabaseSync, items: T[]): void {
    db.prepare('DELETE FROM repository_records WHERE namespace = ?').run(this.namespace);
    const insert = db.prepare(
      `INSERT INTO repository_records
        (namespace, record_key, payload, position, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    );
    const updatedAt = new Date().toISOString();

    items.forEach((item, index) => {
      insert.run(this.namespace, this.getRecordKey(item, index), this.serialize(item), index, updatedAt);
    });
  }

  private saveWorkflowRuns(db: DatabaseSync, items: T[]): void {
    db.prepare('DELETE FROM workflow_runs WHERE namespace = ?').run(this.namespace);
    const insert = db.prepare(
      `INSERT INTO workflow_runs
        (
          namespace, id, run_number, name, path, event, status, conclusion,
          head_branch, created_at, updated_at, run_started_at, run_attempt,
          payload, position, stored_at
        )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const storedAt = new Date().toISOString();

    items.forEach((item, index) => {
      const run = this.asRecord(item);
      insert.run(
        this.namespace,
        this.getRequiredRecordId(run, index),
        this.toNullableNumber(run.run_number),
        this.toNullableString(run.name),
        this.toNullableString(run.path),
        this.toNullableString(run.event),
        this.toNullableString(run.status),
        this.toNullableString(run.conclusion),
        this.toNullableString(run.head_branch),
        this.toNullableString(run.created_at),
        this.toNullableString(run.updated_at),
        this.toNullableString(run.run_started_at),
        this.toNullableNumber(run.run_attempt),
        this.serialize(item),
        index,
        storedAt
      );
    });
  }

  private saveWorkflowJobs(db: DatabaseSync, items: T[]): void {
    db.prepare('DELETE FROM workflow_jobs WHERE namespace = ?').run(this.namespace);
    const insert = db.prepare(
      `INSERT INTO workflow_jobs
        (
          namespace, id, run_id, name, status, conclusion, started_at,
          completed_at, payload, position, stored_at
        )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const storedAt = new Date().toISOString();

    items.forEach((item, index) => {
      const job = this.asRecord(item);
      insert.run(
        this.namespace,
        this.getRequiredRecordId(job, index),
        this.toRequiredString(job.run_id, ''),
        this.toNullableString(job.name),
        this.toNullableString(job.status),
        this.toNullableString(job.conclusion),
        this.toNullableString(job.started_at),
        this.toNullableString(job.completed_at),
        this.serialize(item),
        index,
        storedAt
      );
    });
  }

  private loadRows(db: DatabaseSync): PayloadRow[] {
    if (this.isWorkflowRunsNamespace()) {
      return db
        .prepare(
          `SELECT payload
           FROM workflow_runs
           WHERE namespace = ?
           ORDER BY position ASC, id ASC`
        )
        .all(this.namespace) as PayloadRow[];
    }

    if (this.isWorkflowJobsNamespace()) {
      return db
        .prepare(
          `SELECT payload
           FROM workflow_jobs
           WHERE namespace = ?
           ORDER BY position ASC, id ASC`
        )
        .all(this.namespace) as PayloadRow[];
    }

    return db
      .prepare(
        `SELECT payload
         FROM repository_records
         WHERE namespace = ?
         ORDER BY position ASC, record_key ASC`
      )
      .all(this.namespace) as PayloadRow[];
  }

  private getTableName(): string {
    if (this.isWorkflowRunsNamespace()) {
      return 'workflow_runs';
    }
    if (this.isWorkflowJobsNamespace()) {
      return 'workflow_jobs';
    }
    return 'repository_records';
  }

  private isWorkflowRunsNamespace(): boolean {
    return path.basename(this.namespace) === 'workflows.json';
  }

  private isWorkflowJobsNamespace(): boolean {
    return path.basename(this.namespace) === 'jobs.json';
  }

  private getRecordKey(item: T, index: number): string {
    return this.getRequiredRecordId(this.asRecord(item), index);
  }

  private getRequiredRecordId(record: RecordLike, fallback: number): string {
    return this.toRequiredString(record.id, String(fallback));
  }

  private asRecord(item: T): RecordLike {
    return item && typeof item === 'object' ? (item as RecordLike) : {};
  }

  private toNullableString(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    return String(value);
  }

  private toRequiredString(value: unknown, fallback: string): string {
    const normalized = this.toNullableString(value);
    return normalized && normalized.length > 0 ? normalized : fallback;
  }

  private toNullableNumber(value: unknown): number | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }
}
