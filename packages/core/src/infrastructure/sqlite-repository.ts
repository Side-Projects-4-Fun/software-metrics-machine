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

  async initialize(): Promise<void> {
    await this.ensureDirectoryExists();
    const db = this.openDatabase();
    try {
      this.ensureSchema(db);
    } finally {
      db.close();
    }
  }

  async save(item: T): Promise<void> {
    await this.ensureDirectoryExists();
    const db = this.openDatabase();
    try {
      this.ensureSchema(db);
      if (this.isAnySonarqubeNamespace()) {
        this.saveSonarqubeEntries(db, item, this.getSonarqubeTableName());
      } else {
        db.prepare(
          `INSERT OR REPLACE INTO repository_records
            (namespace, record_key, payload, position, updated_at)
           VALUES (?, ?, ?, ?, ?)`
        ).run(this.namespace, '__singleton__', this.serialize(item), 0, new Date().toISOString());
      }
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
        } else if (this.isCommitsNamespace()) {
          this.saveCommits(db, items);
        } else if (this.isPullRequestsNamespace()) {
          this.savePullRequests(db, items);
        } else if (this.isPullRequestCommentsNamespace()) {
          this.savePullRequestComments(db, items);
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
      if (this.isAnySonarqubeNamespace()) {
        return this.loadSonarqubeEntries(db, this.getSonarqubeTableName());
      }
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
      } else if (this.isCommitsNamespace()) {
        db.prepare('DELETE FROM commits WHERE namespace = ?').run(this.namespace);
        db.prepare('DELETE FROM repository_records WHERE namespace = ?').run(this.namespace);
      } else if (this.isPullRequestsNamespace()) {
        db.prepare('DELETE FROM pull_requests WHERE namespace = ?').run(this.namespace);
      } else if (this.isPullRequestCommentsNamespace()) {
        db.prepare('DELETE FROM pull_request_comments WHERE namespace = ?').run(this.namespace);
      } else if (this.isAnySonarqubeNamespace()) {
        db.prepare(`DELETE FROM ${this.getSonarqubeTableName()} WHERE namespace = ?`).run(
          this.namespace
        );
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
      if (!row && this.isCommitsNamespace()) {
        return Boolean(
          db
            .prepare('SELECT 1 FROM repository_records WHERE namespace = ? LIMIT 1')
            .get(this.namespace)
        );
      }
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
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_metric_date
        ON workflow_runs(namespace, COALESCE(NULLIF(updated_at, ''), created_at));
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

      CREATE TABLE IF NOT EXISTS commits (
        namespace TEXT NOT NULL,
        hash TEXT NOT NULL,
        author TEXT,
        email TEXT,
        msg TEXT,
        subject TEXT,
        timestamp TEXT,
        co_authors_json TEXT,
        files_json TEXT,
        payload TEXT NOT NULL,
        position INTEGER NOT NULL,
        stored_at TEXT NOT NULL,
        PRIMARY KEY (namespace, hash)
      );

      CREATE INDEX IF NOT EXISTS idx_commits_namespace_position
        ON commits(namespace, position);
      CREATE INDEX IF NOT EXISTS idx_commits_author
        ON commits(namespace, author);
      CREATE INDEX IF NOT EXISTS idx_commits_email
        ON commits(namespace, email);
      CREATE INDEX IF NOT EXISTS idx_commits_timestamp
        ON commits(namespace, timestamp);

      CREATE TABLE IF NOT EXISTS pull_requests (
        namespace TEXT NOT NULL,
        id TEXT NOT NULL,
        number INTEGER,
        state TEXT,
        title TEXT,
        author_login TEXT,
        author_id TEXT,
        created_at TEXT,
        updated_at TEXT,
        closed_at TEXT,
        merged_at TEXT,
        html_url TEXT,
        payload TEXT NOT NULL,
        position INTEGER NOT NULL,
        stored_at TEXT NOT NULL,
        PRIMARY KEY (namespace, id)
      );

      CREATE INDEX IF NOT EXISTS idx_pull_requests_namespace_position
        ON pull_requests(namespace, position);
      CREATE INDEX IF NOT EXISTS idx_pull_requests_number
        ON pull_requests(namespace, number);
      CREATE INDEX IF NOT EXISTS idx_pull_requests_state
        ON pull_requests(namespace, state);
      CREATE INDEX IF NOT EXISTS idx_pull_requests_author_login
        ON pull_requests(namespace, author_login);
      CREATE INDEX IF NOT EXISTS idx_pull_requests_created_at
        ON pull_requests(namespace, created_at);
      CREATE INDEX IF NOT EXISTS idx_pull_requests_updated_at
        ON pull_requests(namespace, updated_at);
      CREATE INDEX IF NOT EXISTS idx_pull_requests_merged_at
        ON pull_requests(namespace, merged_at);

      CREATE TABLE IF NOT EXISTS pull_request_comments (
        namespace TEXT NOT NULL,
        id TEXT NOT NULL,
        pull_request_number INTEGER,
        pull_request_url TEXT,
        author_login TEXT,
        author_id TEXT,
        path TEXT,
        created_at TEXT,
        updated_at TEXT,
        html_url TEXT,
        payload TEXT NOT NULL,
        position INTEGER NOT NULL,
        stored_at TEXT NOT NULL,
        PRIMARY KEY (namespace, id)
      );

      CREATE INDEX IF NOT EXISTS idx_pull_request_comments_namespace_position
        ON pull_request_comments(namespace, position);
      CREATE INDEX IF NOT EXISTS idx_pull_request_comments_pr_number
        ON pull_request_comments(namespace, pull_request_number);
      CREATE INDEX IF NOT EXISTS idx_pull_request_comments_author_login
        ON pull_request_comments(namespace, author_login);
      CREATE INDEX IF NOT EXISTS idx_pull_request_comments_created_at
        ON pull_request_comments(namespace, created_at);
      CREATE INDEX IF NOT EXISTS idx_pull_request_comments_updated_at
        ON pull_request_comments(namespace, updated_at);

      CREATE TABLE IF NOT EXISTS sonarqube_measures (
        namespace TEXT NOT NULL,
        entry_index INTEGER NOT NULL,
        fetched_at TEXT NOT NULL,
        payload TEXT NOT NULL,
        stored_at TEXT NOT NULL,
        PRIMARY KEY (namespace, entry_index)
      );

      CREATE INDEX IF NOT EXISTS idx_sonarqube_measures_fetched_at
        ON sonarqube_measures(namespace, fetched_at);

      CREATE TABLE IF NOT EXISTS sonarqube_component_tree (
        namespace TEXT NOT NULL,
        entry_index INTEGER NOT NULL,
        fetched_at TEXT NOT NULL,
        payload TEXT NOT NULL,
        stored_at TEXT NOT NULL,
        PRIMARY KEY (namespace, entry_index)
      );

      CREATE INDEX IF NOT EXISTS idx_sonarqube_component_tree_fetched_at
        ON sonarqube_component_tree(namespace, fetched_at);

      CREATE TABLE IF NOT EXISTS sonarqube_historical_measures (
        namespace TEXT NOT NULL,
        entry_index INTEGER NOT NULL,
        fetched_at TEXT NOT NULL,
        payload TEXT NOT NULL,
        stored_at TEXT NOT NULL,
        PRIMARY KEY (namespace, entry_index)
      );

      CREATE INDEX IF NOT EXISTS idx_sonarqube_historical_measures_fetched_at
        ON sonarqube_historical_measures(namespace, fetched_at);
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
      insert.run(
        this.namespace,
        this.getRecordKey(item, index),
        this.serialize(item),
        index,
        updatedAt
      );
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

  private saveCommits(db: DatabaseSync, items: T[]): void {
    db.prepare('DELETE FROM commits WHERE namespace = ?').run(this.namespace);
    db.prepare('DELETE FROM repository_records WHERE namespace = ?').run(this.namespace);
    const insert = db.prepare(
      `INSERT INTO commits
        (
          namespace, hash, author, email, msg, subject, timestamp,
          co_authors_json, files_json, payload, position, stored_at
        )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const storedAt = new Date().toISOString();

    items.forEach((item, index) => {
      const commit = this.asRecord(item);
      insert.run(
        this.namespace,
        this.toRequiredString(commit.hash, String(index)),
        this.toNullableString(commit.author),
        this.toNullableString(commit.email),
        this.toNullableString(commit.msg),
        this.toNullableString(commit.subject),
        this.toNullableTimestamp(commit.timestamp),
        this.toNullableJsonString(commit.coAuthors),
        this.toNullableJsonString(commit.files),
        this.serialize(item),
        index,
        storedAt
      );
    });
  }

  private savePullRequests(db: DatabaseSync, items: T[]): void {
    db.prepare('DELETE FROM pull_requests WHERE namespace = ?').run(this.namespace);
    const insert = db.prepare(
      `INSERT INTO pull_requests
        (
          namespace, id, number, state, title, author_login, author_id,
          created_at, updated_at, closed_at, merged_at, html_url,
          payload, position, stored_at
        )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const storedAt = new Date().toISOString();

    items.forEach((item, index) => {
      const pr = this.asRecord(item);
      const user = this.asNestedRecord(pr.user);
      insert.run(
        this.namespace,
        this.getRequiredRecordId(pr, index),
        this.toNullableNumber(pr.number),
        this.toNullableString(pr.state),
        this.toNullableString(pr.title),
        this.toNullableString(user.login),
        this.toNullableString(user.id),
        this.toNullableString(pr.created_at),
        this.toNullableString(pr.updated_at),
        this.toNullableString(pr.closed_at),
        this.toNullableString(pr.merged_at),
        this.toNullableString(pr.html_url),
        this.serialize(item),
        index,
        storedAt
      );
    });
  }

  private savePullRequestComments(db: DatabaseSync, items: T[]): void {
    db.prepare('DELETE FROM pull_request_comments WHERE namespace = ?').run(this.namespace);
    const insert = db.prepare(
      `INSERT INTO pull_request_comments
        (
          namespace, id, pull_request_number, pull_request_url, author_login,
          author_id, path, created_at, updated_at, html_url,
          payload, position, stored_at
        )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const storedAt = new Date().toISOString();

    items.forEach((item, index) => {
      const comment = this.asRecord(item);
      const user = this.asNestedRecord(comment.user);
      insert.run(
        this.namespace,
        this.getRequiredRecordId(comment, index),
        this.extractPullRequestNumber(comment.pull_request_url),
        this.toNullableString(comment.pull_request_url),
        this.toNullableString(user.login),
        this.toNullableString(user.id),
        this.toNullableString(comment.path),
        this.toNullableString(comment.created_at),
        this.toNullableString(comment.updated_at),
        this.toNullableString(comment.html_url),
        this.serialize(item),
        index,
        storedAt
      );
    });
  }

  private saveSonarqubeEntries(db: DatabaseSync, item: T, tableName: string): void {
    db.prepare(`DELETE FROM ${tableName} WHERE namespace = ?`).run(this.namespace);
    const store = this.asRecord(item);
    const entries = store.entries as Array<Record<string, unknown>> | undefined;
    if (!entries || entries.length === 0) {
      return;
    }

    const insert = db.prepare(
      `INSERT INTO ${tableName}
        (namespace, entry_index, fetched_at, payload, stored_at)
       VALUES (?, ?, ?, ?, ?)`
    );
    const storedAt = new Date().toISOString();

    entries.forEach((entry, index) => {
      insert.run(
        this.namespace,
        index,
        this.toNullableString(entry.fetchedAt) ?? '',
        this.serialize(entry as unknown as T),
        storedAt
      );
    });
  }

  private loadSonarqubeEntries(db: DatabaseSync, tableName: string): T | null {
    const rows = db
      .prepare(
        `SELECT payload
         FROM ${tableName}
         WHERE namespace = ?
         ORDER BY entry_index ASC`
      )
      .all(this.namespace) as { payload: string }[];

    if (rows.length === 0) {
      return null;
    }

    const entries = rows.map((row) => this.deserialize(row.payload));
    return { entries } as unknown as T;
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

    if (this.isCommitsNamespace()) {
      const rows = db
        .prepare(
          `SELECT payload
           FROM commits
           WHERE namespace = ?
           ORDER BY position ASC, hash ASC`
        )
        .all(this.namespace) as PayloadRow[];

      if (rows.length > 0) {
        return rows;
      }
    }

    if (this.isPullRequestsNamespace()) {
      return db
        .prepare(
          `SELECT payload
           FROM pull_requests
           WHERE namespace = ?
           ORDER BY position ASC, id ASC`
        )
        .all(this.namespace) as PayloadRow[];
    }

    if (this.isPullRequestCommentsNamespace()) {
      return db
        .prepare(
          `SELECT payload
           FROM pull_request_comments
           WHERE namespace = ?
           ORDER BY position ASC, id ASC`
        )
        .all(this.namespace) as PayloadRow[];
    }

    if (this.isAnySonarqubeNamespace()) {
      const tableName = this.getSonarqubeTableName();
      return db
        .prepare(
          `SELECT payload
           FROM ${tableName}
           WHERE namespace = ?
           ORDER BY entry_index ASC`
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
    if (this.isCommitsNamespace()) {
      return 'commits';
    }
    if (this.isPullRequestsNamespace()) {
      return 'pull_requests';
    }
    if (this.isPullRequestCommentsNamespace()) {
      return 'pull_request_comments';
    }
    if (this.isAnySonarqubeNamespace()) {
      return this.getSonarqubeTableName();
    }
    return 'repository_records';
  }

  private isWorkflowRunsNamespace(): boolean {
    return path.basename(this.namespace) === 'pipeline-runs';
  }

  private isWorkflowJobsNamespace(): boolean {
    return path.basename(this.namespace) === 'pipeline-jobs';
  }

  private isCommitsNamespace(): boolean {
    return path.basename(this.namespace) === 'commits.json';
  }

  private isPullRequestsNamespace(): boolean {
    return path.basename(this.namespace) === 'prs.json';
  }

  private isPullRequestCommentsNamespace(): boolean {
    return path.basename(this.namespace) === 'pr-comments.json';
  }

  private isSonarqubeMeasuresNamespace(): boolean {
    return path.basename(this.namespace) === 'measures.json';
  }

  private isSonarqubeComponentTreeNamespace(): boolean {
    return path.basename(this.namespace) === 'component-tree.json';
  }

  private isSonarqubeHistoricalMeasuresNamespace(): boolean {
    return path.basename(this.namespace) === 'historical-measures.json';
  }

  private isAnySonarqubeNamespace(): boolean {
    return (
      this.isSonarqubeMeasuresNamespace() ||
      this.isSonarqubeComponentTreeNamespace() ||
      this.isSonarqubeHistoricalMeasuresNamespace()
    );
  }

  private getSonarqubeTableName(): string {
    if (this.isSonarqubeMeasuresNamespace()) return 'sonarqube_measures';
    if (this.isSonarqubeComponentTreeNamespace()) return 'sonarqube_component_tree';
    return 'sonarqube_historical_measures';
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

  private asNestedRecord(item: unknown): RecordLike {
    return item && typeof item === 'object' ? (item as RecordLike) : {};
  }

  private extractPullRequestNumber(value: unknown): number | null {
    const text = this.toNullableString(value);
    if (!text) {
      return null;
    }

    const match = text.match(/\/pulls\/(\d+)(?:$|[/?#])/);
    return match ? this.toNullableNumber(match[1]) : null;
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

  private toNullableTimestamp(value: unknown): string | null {
    if (value instanceof Date) {
      return value.toISOString();
    }

    return this.toNullableString(value);
  }

  private toNullableJsonString(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    return JSON.stringify(value);
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
