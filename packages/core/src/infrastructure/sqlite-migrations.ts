import type { DatabaseSync } from 'node:sqlite';

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
    up: (db: DatabaseSync): void => {
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

        CREATE TABLE IF NOT EXISTS pipeline_runs (
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

        CREATE INDEX IF NOT EXISTS idx_pipeline_runs_namespace_position
          ON pipeline_runs(namespace, position);
        CREATE INDEX IF NOT EXISTS idx_pipeline_runs_created_at
          ON pipeline_runs(namespace, created_at);
        CREATE INDEX IF NOT EXISTS idx_pipeline_runs_metric_date
          ON pipeline_runs(namespace, COALESCE(NULLIF(updated_at, ''), created_at));
        CREATE INDEX IF NOT EXISTS idx_pipeline_runs_path
          ON pipeline_runs(namespace, path);
        CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status
          ON pipeline_runs(namespace, status);
        CREATE INDEX IF NOT EXISTS idx_pipeline_runs_conclusion
          ON pipeline_runs(namespace, conclusion);
        CREATE INDEX IF NOT EXISTS idx_pipeline_runs_head_branch
          ON pipeline_runs(namespace, head_branch);

        CREATE TABLE IF NOT EXISTS pipeline_jobs (
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

        CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_namespace_position
          ON pipeline_jobs(namespace, position);
        CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_run_id
          ON pipeline_jobs(namespace, run_id);
        CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_name
          ON pipeline_jobs(namespace, name);
        CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_conclusion
          ON pipeline_jobs(namespace, conclusion);
        CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_completed_at
          ON pipeline_jobs(namespace, completed_at);

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

        CREATE TABLE IF NOT EXISTS change_requests (
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

        CREATE INDEX IF NOT EXISTS idx_change_requests_namespace_position
          ON change_requests(namespace, position);
        CREATE INDEX IF NOT EXISTS idx_change_requests_number
          ON change_requests(namespace, number);
        CREATE INDEX IF NOT EXISTS idx_change_requests_state
          ON change_requests(namespace, state);
        CREATE INDEX IF NOT EXISTS idx_change_requests_author_login
          ON change_requests(namespace, author_login);
        CREATE INDEX IF NOT EXISTS idx_change_requests_created_at
          ON change_requests(namespace, created_at);
        CREATE INDEX IF NOT EXISTS idx_change_requests_updated_at
          ON change_requests(namespace, updated_at);
        CREATE INDEX IF NOT EXISTS idx_change_requests_merged_at
          ON change_requests(namespace, merged_at);

        CREATE TABLE IF NOT EXISTS change_request_comments (
          namespace TEXT NOT NULL,
          id TEXT NOT NULL,
          change_request_number INTEGER,
          change_request_url TEXT,
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

        CREATE INDEX IF NOT EXISTS idx_change_request_comments_namespace_position
          ON change_request_comments(namespace, position);
        CREATE INDEX IF NOT EXISTS idx_change_request_comments_change_request_number
          ON change_request_comments(namespace, change_request_number);
        CREATE INDEX IF NOT EXISTS idx_change_request_comments_author_login
          ON change_request_comments(namespace, author_login);
        CREATE INDEX IF NOT EXISTS idx_change_request_comments_created_at
          ON change_request_comments(namespace, created_at);
        CREATE INDEX IF NOT EXISTS idx_change_request_comments_updated_at
          ON change_request_comments(namespace, updated_at);

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
    up: (db: DatabaseSync): void => {
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

        CREATE TABLE IF NOT EXISTS codemaat_age (
          entity TEXT NOT NULL,
          age_months INTEGER NOT NULL,
          position INTEGER NOT NULL,
          stored_at TEXT NOT NULL,
          fetched_at TEXT,
          PRIMARY KEY (entity, position)
        );

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

        CREATE TABLE IF NOT EXISTS codemaat_entity_effort (
          entity TEXT NOT NULL,
          total_revs INTEGER NOT NULL,
          position INTEGER NOT NULL,
          stored_at TEXT NOT NULL,
          fetched_at TEXT,
          PRIMARY KEY (entity, position)
        );

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
      `);

      // Add fetched_at column to any pre-existing legacy tables that lack it,
      // before creating indexes on that column.
      CODEMAAT_TABLES.forEach((tableName) => {
        if (!tableExists(db, tableName)) {
          return;
        }

        if (!columnExists(db, tableName, 'fetched_at')) {
          db.exec(`ALTER TABLE ${tableName} ADD COLUMN fetched_at TEXT`);
        }
      });

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_codemaat_code_churn_date
          ON codemaat_code_churn(date);
        CREATE INDEX IF NOT EXISTS idx_codemaat_code_churn_fetched_at
          ON codemaat_code_churn(fetched_at);

        CREATE INDEX IF NOT EXISTS idx_codemaat_age_entity
          ON codemaat_age(entity);
        CREATE INDEX IF NOT EXISTS idx_codemaat_age_fetched_at
          ON codemaat_age(fetched_at);

        CREATE INDEX IF NOT EXISTS idx_codemaat_author_churn_author
          ON codemaat_author_churn(author);
        CREATE INDEX IF NOT EXISTS idx_codemaat_author_churn_fetched_at
          ON codemaat_author_churn(fetched_at);

        CREATE INDEX IF NOT EXISTS idx_codemaat_file_coupling_entity
          ON codemaat_file_coupling(entity);
        CREATE INDEX IF NOT EXISTS idx_codemaat_file_coupling_coupled
          ON codemaat_file_coupling(coupled);
        CREATE INDEX IF NOT EXISTS idx_codemaat_file_coupling_degree
          ON codemaat_file_coupling(degree);
        CREATE INDEX IF NOT EXISTS idx_codemaat_file_coupling_fetched_at
          ON codemaat_file_coupling(fetched_at);

        CREATE INDEX IF NOT EXISTS idx_codemaat_layered_coupling_entity
          ON codemaat_layered_coupling(entity);
        CREATE INDEX IF NOT EXISTS idx_codemaat_layered_coupling_coupled
          ON codemaat_layered_coupling(coupled);
        CREATE INDEX IF NOT EXISTS idx_codemaat_layered_coupling_degree
          ON codemaat_layered_coupling(degree);
        CREATE INDEX IF NOT EXISTS idx_codemaat_layered_coupling_fetched_at
          ON codemaat_layered_coupling(fetched_at);

        CREATE INDEX IF NOT EXISTS idx_codemaat_entity_churn_entity
          ON codemaat_entity_churn(entity);
        CREATE INDEX IF NOT EXISTS idx_codemaat_entity_churn_fetched_at
          ON codemaat_entity_churn(fetched_at);

        CREATE INDEX IF NOT EXISTS idx_codemaat_entity_effort_entity
          ON codemaat_entity_effort(entity);
        CREATE INDEX IF NOT EXISTS idx_codemaat_entity_effort_fetched_at
          ON codemaat_entity_effort(fetched_at);

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
    up: (db: DatabaseSync): void => {
      CODEMAAT_TABLES.forEach((tableName) => {
        if (!tableExists(db, tableName)) {
          return;
        }

        db.prepare(`UPDATE ${tableName} SET fetched_at = stored_at WHERE fetched_at IS NULL`).run();
      });
    },
  },
  {
    id: '004_rename_provider_specific_tables',
    up: (db: DatabaseSync): void => {
      // Rename GitHub-centric pipeline tables to provider-neutral names.
      // SQLite does not support renaming indexes, so old indexes are dropped
      // and the new indexes (created by migration 001 with IF NOT EXISTS) take over.
      renameTableIfExists(db, 'workflow_runs', 'pipeline_runs', [
        'idx_workflow_runs_namespace_position',
        'idx_workflow_runs_created_at',
        'idx_workflow_runs_metric_date',
        'idx_workflow_runs_path',
        'idx_workflow_runs_status',
        'idx_workflow_runs_conclusion',
        'idx_workflow_runs_head_branch',
      ]);
      renameTableIfExists(db, 'workflow_jobs', 'pipeline_jobs', [
        'idx_workflow_jobs_namespace_position',
        'idx_workflow_jobs_run_id',
        'idx_workflow_jobs_name',
        'idx_workflow_jobs_conclusion',
        'idx_workflow_jobs_completed_at',
      ]);

      // Rename GitHub-centric pull request tables to provider-neutral names.
      renameTableIfExists(db, 'pull_requests', 'change_requests', [
        'idx_pull_requests_namespace_position',
        'idx_pull_requests_number',
        'idx_pull_requests_state',
        'idx_pull_requests_author_login',
        'idx_pull_requests_created_at',
        'idx_pull_requests_updated_at',
        'idx_pull_requests_merged_at',
      ]);
      renameTableIfExists(db, 'pull_request_comments', 'change_request_comments', [
        'idx_pull_request_comments_namespace_position',
        'idx_pull_request_comments_pr_number',
        'idx_pull_request_comments_author_login',
        'idx_pull_request_comments_created_at',
        'idx_pull_request_comments_updated_at',
      ]);
    },
  },
  {
    id: '005_rename_change_request_comment_columns',
    up: (db: DatabaseSync): void => {
      // Rename the last GitHub-centric column names in the change_request_comments
      // table to provider-neutral names. SQLite (>=3.25) supports ALTER TABLE RENAME
      // COLUMN, so we rename in place and recreate the affected index.
      if (
        tableExists(db, 'change_request_comments') &&
        columnExists(db, 'change_request_comments', 'pull_request_number')
      ) {
        db.exec(
          'ALTER TABLE change_request_comments RENAME COLUMN pull_request_number TO change_request_number'
        );
      }

      if (
        tableExists(db, 'change_request_comments') &&
        columnExists(db, 'change_request_comments', 'pull_request_url')
      ) {
        db.exec(
          'ALTER TABLE change_request_comments RENAME COLUMN pull_request_url TO change_request_url'
        );
      }

      // Recreate the index with the new column name. The old index
      // (idx_change_request_comments_pr_number) referenced pull_request_number and
      // is automatically updated by SQLite to track the renamed column, but its name
      // is misleading, so drop it and create the correctly-named index.
      db.exec('DROP INDEX IF EXISTS idx_change_request_comments_pr_number');
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_change_request_comments_change_request_number
          ON change_request_comments(namespace, change_request_number)
      `);
    },
  },
];

export function applySqliteMigrations(db: DatabaseSync): void {
  db.exec('PRAGMA journal_mode=WAL;');
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

function renameTableIfExists(
  db: DatabaseSync,
  oldName: string,
  newName: string,
  oldIndexes: string[]
): void {
  // If the old table doesn't exist (fresh database where migration 001 already
  // created the new-named table), there is nothing to migrate.
  if (!tableExists(db, oldName)) {
    return;
  }

  // Drop old indexes — SQLite ALTER TABLE RENAME preserves indexes but keeps their
  // original names, which would be misleading. We recreate the indexes with new names below.
  for (const indexName of oldIndexes) {
    db.exec(`DROP INDEX IF EXISTS ${indexName}`);
  }

  // If the new table somehow already exists (e.g. partially migrated), drop the old
  // table and keep the new one. The new indexes are created by migration 001.
  if (tableExists(db, newName)) {
    db.exec(`DROP TABLE ${oldName}`);
    return;
  }

  db.exec(`ALTER TABLE ${oldName} RENAME TO ${newName}`);

  // Recreate indexes with the new names. On fresh databases migration 001 already
  // created these (IF NOT EXISTS), so this is a no-op. On migrated databases the
  // old indexes were dropped above and migration 001 won't re-run, so we recreate them here.
  createIndexesForRenamedTable(db, newName);
}

function createIndexesForRenamedTable(db: DatabaseSync, tableName: string): void {
  if (tableName === 'pipeline_runs') {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_pipeline_runs_namespace_position
        ON pipeline_runs(namespace, position);
      CREATE INDEX IF NOT EXISTS idx_pipeline_runs_created_at
        ON pipeline_runs(namespace, created_at);
      CREATE INDEX IF NOT EXISTS idx_pipeline_runs_metric_date
        ON pipeline_runs(namespace, COALESCE(NULLIF(updated_at, ''), created_at));
      CREATE INDEX IF NOT EXISTS idx_pipeline_runs_path
        ON pipeline_runs(namespace, path);
      CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status
        ON pipeline_runs(namespace, status);
      CREATE INDEX IF NOT EXISTS idx_pipeline_runs_conclusion
        ON pipeline_runs(namespace, conclusion);
      CREATE INDEX IF NOT EXISTS idx_pipeline_runs_head_branch
        ON pipeline_runs(namespace, head_branch);
    `);
    return;
  }

  if (tableName === 'pipeline_jobs') {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_namespace_position
        ON pipeline_jobs(namespace, position);
      CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_run_id
        ON pipeline_jobs(namespace, run_id);
      CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_name
        ON pipeline_jobs(namespace, name);
      CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_conclusion
        ON pipeline_jobs(namespace, conclusion);
      CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_completed_at
        ON pipeline_jobs(namespace, completed_at);
    `);
    return;
  }

  if (tableName === 'change_requests') {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_change_requests_namespace_position
        ON change_requests(namespace, position);
      CREATE INDEX IF NOT EXISTS idx_change_requests_number
        ON change_requests(namespace, number);
      CREATE INDEX IF NOT EXISTS idx_change_requests_state
        ON change_requests(namespace, state);
      CREATE INDEX IF NOT EXISTS idx_change_requests_author_login
        ON change_requests(namespace, author_login);
      CREATE INDEX IF NOT EXISTS idx_change_requests_created_at
        ON change_requests(namespace, created_at);
      CREATE INDEX IF NOT EXISTS idx_change_requests_updated_at
        ON change_requests(namespace, updated_at);
      CREATE INDEX IF NOT EXISTS idx_change_requests_merged_at
        ON change_requests(namespace, merged_at);
    `);
    return;
  }

  if (tableName === 'change_request_comments') {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_change_request_comments_namespace_position
        ON change_request_comments(namespace, position);
      CREATE INDEX IF NOT EXISTS idx_change_request_comments_change_request_number
        ON change_request_comments(namespace, change_request_number);
      CREATE INDEX IF NOT EXISTS idx_change_request_comments_author_login
        ON change_request_comments(namespace, author_login);
      CREATE INDEX IF NOT EXISTS idx_change_request_comments_created_at
        ON change_request_comments(namespace, created_at);
      CREATE INDEX IF NOT EXISTS idx_change_request_comments_updated_at
        ON change_request_comments(namespace, updated_at);
    `);
  }
}
