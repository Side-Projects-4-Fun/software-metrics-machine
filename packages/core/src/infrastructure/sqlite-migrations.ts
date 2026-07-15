import { DatabaseSync } from 'node:sqlite';

type SqliteMigration = {
  id: string;
  up: (db: DatabaseSync) => void;
};

const MIGRATIONS_TABLE = 'smm_schema_migrations';
const CODEMAAT_TABLES = [
  'codemaat_code_churn',
  'codemaat_age',
  'codemaat_author_churn',
  'codemaat_file_coupling',
  'codemaat_layered_coupling',
  'codemaat_entity_churn',
  'codemaat_entity_effort',
  'codemaat_entity_ownership',
];

const APP_SQLITE_MIGRATIONS: SqliteMigration[] = [
  {
    id: '001_create_core_repository_tables',
    up: (db) => {
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
    },
  },
  {
    id: '002_create_codemaat_tables',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS codemaat_code_churn (
          date TEXT NOT NULL,
          added INTEGER NOT NULL,
          deleted INTEGER NOT NULL,
          commits INTEGER NOT NULL,
          position INTEGER NOT NULL,
          stored_at TEXT NOT NULL,
          fetched_at TEXT,
          PRIMARY KEY (date, position)
        );

        CREATE INDEX IF NOT EXISTS idx_codemaat_code_churn_date
          ON codemaat_code_churn(date);
        CREATE INDEX IF NOT EXISTS idx_codemaat_code_churn_fetched_at
          ON codemaat_code_churn(fetched_at);

        CREATE TABLE IF NOT EXISTS codemaat_age (
          entity TEXT NOT NULL,
          age_months INTEGER NOT NULL,
          position INTEGER NOT NULL,
          stored_at TEXT NOT NULL,
          fetched_at TEXT,
          PRIMARY KEY (entity, position)
        );

        CREATE INDEX IF NOT EXISTS idx_codemaat_age_entity
          ON codemaat_age(entity);
        CREATE INDEX IF NOT EXISTS idx_codemaat_age_fetched_at
          ON codemaat_age(fetched_at);

        CREATE TABLE IF NOT EXISTS codemaat_author_churn (
          author TEXT NOT NULL,
          added INTEGER NOT NULL,
          deleted INTEGER NOT NULL,
          commits INTEGER NOT NULL,
          position INTEGER NOT NULL,
          stored_at TEXT NOT NULL,
          fetched_at TEXT,
          PRIMARY KEY (author, position)
        );

        CREATE INDEX IF NOT EXISTS idx_codemaat_author_churn_author
          ON codemaat_author_churn(author);
        CREATE INDEX IF NOT EXISTS idx_codemaat_author_churn_fetched_at
          ON codemaat_author_churn(fetched_at);

        CREATE TABLE IF NOT EXISTS codemaat_file_coupling (
          entity TEXT NOT NULL,
          coupled TEXT NOT NULL,
          degree INTEGER NOT NULL,
          average_revs INTEGER NOT NULL,
          position INTEGER NOT NULL,
          stored_at TEXT NOT NULL,
          fetched_at TEXT,
          PRIMARY KEY (entity, coupled, position)
        );

        CREATE INDEX IF NOT EXISTS idx_codemaat_file_coupling_entity
          ON codemaat_file_coupling(entity);
        CREATE INDEX IF NOT EXISTS idx_codemaat_file_coupling_coupled
          ON codemaat_file_coupling(coupled);
        CREATE INDEX IF NOT EXISTS idx_codemaat_file_coupling_degree
          ON codemaat_file_coupling(degree);
        CREATE INDEX IF NOT EXISTS idx_codemaat_file_coupling_fetched_at
          ON codemaat_file_coupling(fetched_at);

        CREATE TABLE IF NOT EXISTS codemaat_layered_coupling (
          entity TEXT NOT NULL,
          coupled TEXT NOT NULL,
          degree INTEGER NOT NULL,
          average_revs INTEGER NOT NULL,
          position INTEGER NOT NULL,
          stored_at TEXT NOT NULL,
          fetched_at TEXT,
          PRIMARY KEY (entity, coupled, position)
        );

        CREATE INDEX IF NOT EXISTS idx_codemaat_layered_coupling_entity
          ON codemaat_layered_coupling(entity);
        CREATE INDEX IF NOT EXISTS idx_codemaat_layered_coupling_coupled
          ON codemaat_layered_coupling(coupled);
        CREATE INDEX IF NOT EXISTS idx_codemaat_layered_coupling_degree
          ON codemaat_layered_coupling(degree);
        CREATE INDEX IF NOT EXISTS idx_codemaat_layered_coupling_fetched_at
          ON codemaat_layered_coupling(fetched_at);

        CREATE TABLE IF NOT EXISTS codemaat_entity_churn (
          entity TEXT NOT NULL,
          added INTEGER NOT NULL,
          deleted INTEGER NOT NULL,
          commits INTEGER NOT NULL,
          position INTEGER NOT NULL,
          stored_at TEXT NOT NULL,
          fetched_at TEXT,
          PRIMARY KEY (entity, position)
        );

        CREATE INDEX IF NOT EXISTS idx_codemaat_entity_churn_entity
          ON codemaat_entity_churn(entity);
        CREATE INDEX IF NOT EXISTS idx_codemaat_entity_churn_fetched_at
          ON codemaat_entity_churn(fetched_at);

        CREATE TABLE IF NOT EXISTS codemaat_entity_effort (
          entity TEXT NOT NULL,
          total_revs INTEGER NOT NULL,
          position INTEGER NOT NULL,
          stored_at TEXT NOT NULL,
          fetched_at TEXT,
          PRIMARY KEY (entity, position)
        );

        CREATE INDEX IF NOT EXISTS idx_codemaat_entity_effort_entity
          ON codemaat_entity_effort(entity);
        CREATE INDEX IF NOT EXISTS idx_codemaat_entity_effort_fetched_at
          ON codemaat_entity_effort(fetched_at);

        CREATE TABLE IF NOT EXISTS codemaat_entity_ownership (
          entity TEXT NOT NULL,
          author TEXT NOT NULL,
          added INTEGER NOT NULL,
          deleted INTEGER NOT NULL,
          position INTEGER NOT NULL,
          stored_at TEXT NOT NULL,
          fetched_at TEXT,
          PRIMARY KEY (entity, author, position)
        );

        CREATE INDEX IF NOT EXISTS idx_codemaat_entity_ownership_entity
          ON codemaat_entity_ownership(entity);
        CREATE INDEX IF NOT EXISTS idx_codemaat_entity_ownership_author
          ON codemaat_entity_ownership(author);
        CREATE INDEX IF NOT EXISTS idx_codemaat_entity_ownership_fetched_at
          ON codemaat_entity_ownership(fetched_at);
      `);
    },
  },
  {
    id: '003_backfill_codemaat_fetched_at',
    up: (db) => {
      CODEMAAT_TABLES.forEach((tableName) => {
        if (!tableExists(db, tableName)) {
          return;
        }

        if (!columnExists(db, tableName, 'fetched_at')) {
          db.exec(`ALTER TABLE ${tableName} ADD COLUMN fetched_at TEXT`);
        }

        db.prepare(`UPDATE ${tableName} SET fetched_at = stored_at WHERE fetched_at IS NULL`).run();
      });
    },
  },
];

export function applySqliteMigrations(db: DatabaseSync): void {
  ensureMigrationsTable(db);
  const hasScopeColumn = migrationsTableHasScopeColumn(db);

  APP_SQLITE_MIGRATIONS.forEach((migration) => {
    if (isMigrationApplied(db, migration.id, hasScopeColumn)) {
      return;
    }

    migration.up(db);
    const appliedAt = new Date().toISOString();

    if (hasScopeColumn) {
      db.prepare(
        `INSERT INTO ${MIGRATIONS_TABLE} (scope, migration_id, applied_at)
         VALUES (?, ?, ?)`
      ).run('app', migration.id, appliedAt);
    } else {
      db.prepare(
        `INSERT INTO ${MIGRATIONS_TABLE} (migration_id, applied_at)
         VALUES (?, ?)`
      ).run(migration.id, appliedAt);
    }
  });
}

function ensureMigrationsTable(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      migration_id TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      PRIMARY KEY (migration_id)
    )
  `);
}

function isMigrationApplied(
  db: DatabaseSync,
  migrationId: string,
  hasScopeColumn: boolean
): boolean {
  if (hasScopeColumn) {
    return Boolean(
      db
        .prepare(
          `SELECT 1
           FROM ${MIGRATIONS_TABLE}
           WHERE migration_id = ?
           LIMIT 1`
        )
        .get(migrationId)
    );
  }

  return Boolean(
    db
      .prepare(
        `SELECT 1
         FROM ${MIGRATIONS_TABLE}
         WHERE migration_id = ?
         LIMIT 1`
      )
      .get(migrationId)
  );
}

function migrationsTableHasScopeColumn(db: DatabaseSync): boolean {
  const columns = db.prepare(`PRAGMA table_info(${MIGRATIONS_TABLE})`).all() as Array<{
    name: string;
  }>;
  return columns.some((column) => column.name === 'scope');
}

function tableExists(db: DatabaseSync, tableName: string): boolean {
  return Boolean(
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
      .get(tableName)
  );
}

function columnExists(db: DatabaseSync, tableName: string, columnName: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
}
