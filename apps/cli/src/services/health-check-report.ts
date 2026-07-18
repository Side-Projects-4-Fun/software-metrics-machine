import { Configuration } from '@smmachine/core/infrastructure/configuration';
import { RepositoryFactory } from '@smmachine/core/infrastructure/repository-factory';
import { applySqliteMigrations } from '@smmachine/core/infrastructure/sqlite-migrations';
import * as fs from 'fs/promises';
import { DatabaseSync } from 'node:sqlite';

type DatasetCheck = {
  id: string;
  source: string;
  exists: boolean;
  itemCount: number;
  lastFetchedAt?: string;
  staleDays?: number;
  coverageStart?: string;
  coverageEnd?: string;
  invalidDateCount: number;
  potentialGapDays: number;
  potentialGapRanges: Array<{ start: string; end: string; days: number }>;
  missingRequiredFields: Record<string, number>;
  notes: string[];
};

type HealthReport = {
  generatedAt: string;
  baseDirectory: string;
  summary: {
    totalDatasets: number;
    healthyDatasets: number;
    warningDatasets: number;
    errorDatasets: number;
  };
  datasets: DatasetCheck[];
};

type DatasetDefinition = {
  id: string;
  displayName: string;
  dateFields: string[];
  requiredFields: string[];
  sqliteSource: {
    table: string;
    payloadColumn: string;
    namespace: string;
  };
};

export class HealthCheckReportBuilder {
  async build(
    config: Configuration,
    providerFilter: string,
    maxGapDays: number
  ): Promise<HealthReport> {
    const nowIso = new Date().toISOString();
    const definitions = this.getDatasetDefinitions(config, providerFilter);

    const datasets = await Promise.all(
      definitions.map((def) => this.analyzeDataset(def, config, maxGapDays))
    );

    const summary = datasets.reduce(
      (acc, dataset) => {
        const level = HealthCheckReportBuilder.getDatasetLevel(dataset);
        if (level === 'healthy') acc.healthyDatasets += 1;
        if (level === 'warning') acc.warningDatasets += 1;
        if (level === 'error') acc.errorDatasets += 1;
        return acc;
      },
      {
        totalDatasets: datasets.length,
        healthyDatasets: 0,
        warningDatasets: 0,
        errorDatasets: 0,
      }
    );

    return {
      generatedAt: nowIso,
      baseDirectory: config.getBaseDirectory(),
      summary,
      datasets,
    };
  }

  static getDatasetLevel(dataset: DatasetCheck): 'healthy' | 'warning' | 'error' {
    if (!dataset.exists || dataset.itemCount === 0) {
      return 'error';
    }

    if (dataset.staleDays !== undefined && dataset.staleDays > 7) {
      return 'warning';
    }

    if (dataset.invalidDateCount > 0) {
      return 'warning';
    }

    if (dataset.potentialGapDays > 0) {
      return 'warning';
    }

    if (Object.values(dataset.missingRequiredFields).some((count) => count > 0)) {
      return 'warning';
    }

    if (dataset.notes.length > 0) {
      return 'warning';
    }

    return 'healthy';
  }

  private getDatasetDefinitions(
    config: Configuration,
    providerFilter: string
  ): DatasetDefinition[] {
    const gitDir = config.getPathFromGitProvider();
    const jiraDir = config.getJiraPath();
    const sonarDir = config.getSonarqubePath();
    const gitProviderId = (config.gitProvider || 'github').toLowerCase();
    const sqliteNamespace = (filePath: string): string =>
      RepositoryFactory.getSqliteNamespace(filePath, config);

    const allDefinitions: DatasetDefinition[] = [
      {
        id: `${gitProviderId}.prs`,
        displayName: `${gitProviderId.toUpperCase()} Pull Requests (table: pull_requests)`,
        dateFields: ['updated_at', 'created_at'],
        requiredFields: ['id', 'created_at', 'updated_at', 'state'],
        sqliteSource: {
          table: 'pull_requests',
          payloadColumn: 'payload',
          namespace: sqliteNamespace(`${gitDir}/prs.json`),
        },
      },
      {
        id: `${gitProviderId}.pr-comments`,
        displayName: `${gitProviderId.toUpperCase()} Pull Request Comments (table: pull_request_comments)`,
        dateFields: ['updated_at', 'created_at'],
        requiredFields: ['id', 'pull_request_url', 'created_at', 'updated_at'],
        sqliteSource: {
          table: 'pull_request_comments',
          payloadColumn: 'payload',
          namespace: sqliteNamespace(`${gitDir}/pr-comments.json`),
        },
      },
      {
        id: `${gitProviderId}.workflows`,
        displayName: `${gitProviderId.toUpperCase()} Workflow Runs (table: workflow_runs)`,
        dateFields: ['updated_at', 'created_at', 'run_started_at'],
        requiredFields: ['id', 'created_at', 'updated_at', 'status'],
        sqliteSource: {
          table: 'workflow_runs',
          payloadColumn: 'payload',
          namespace: RepositoryFactory.getPipelineRunsSqliteNamespace(config),
        },
      },
      {
        id: `${gitProviderId}.jobs`,
        displayName: `${gitProviderId.toUpperCase()} Workflow Jobs (table: workflow_jobs)`,
        dateFields: ['completed_at', 'started_at', 'created_at'],
        requiredFields: ['id', 'run_id', 'created_at', 'status'],
        sqliteSource: {
          table: 'workflow_jobs',
          payloadColumn: 'payload',
          namespace: RepositoryFactory.getPipelineJobsSqliteNamespace(config),
        },
      },
      {
        id: 'jira.issues',
        displayName: 'JIRA Issues (table: repository_records)',
        dateFields: ['createdAt'],
        requiredFields: ['id', 'createdAt', 'status'],
        sqliteSource: {
          table: 'repository_records',
          payloadColumn: 'payload',
          namespace: sqliteNamespace(`${jiraDir}/issues.json`),
        },
      },
      {
        id: 'sonarqube.historical-measures',
        displayName: 'SonarQube Historical Measures (table: sonarqube_historical_measures)',
        dateFields: ['timestamp'],
        requiredFields: ['metric', 'timestamp'],
        sqliteSource: {
          table: 'sonarqube_historical_measures',
          payloadColumn: 'payload',
          namespace: sqliteNamespace(`${sonarDir}/historical-measures.json`),
        },
      },
      {
        id: 'sonarqube.measures',
        displayName: 'SonarQube Measures (table: sonarqube_measures)',
        dateFields: [],
        requiredFields: [],
        sqliteSource: {
          table: 'sonarqube_measures',
          payloadColumn: 'payload',
          namespace: sqliteNamespace(`${sonarDir}/measures.json`),
        },
      },
    ];

    if (!providerFilter || providerFilter === 'all') {
      return allDefinitions;
    }

    const normalized = providerFilter.toLowerCase();
    const accepted = ['all', gitProviderId, 'jira', 'sonarqube'];
    if (!accepted.includes(normalized)) {
      throw new Error(
        `Invalid --provider value: ${providerFilter}. Expected one of: ${accepted.join(', ')}`
      );
    }

    return allDefinitions.filter((def) => def.id.startsWith(`${normalized}.`));
  }

  private async analyzeDataset(
    def: DatasetDefinition,
    config: Configuration,
    maxGapDays: number
  ): Promise<DatasetCheck> {
    return this.analyzeSqliteDataset(def, config, maxGapDays);
  }

  private async analyzeSqliteDataset(
    def: DatasetDefinition,
    config: Configuration,
    maxGapDays: number
  ): Promise<DatasetCheck> {
    const sqliteDbPath = RepositoryFactory.getSqliteDatabasePath(config);
    const tableName = def.sqliteSource.table;
    const base: DatasetCheck = {
      id: def.id,
      source: `SQLite table: ${tableName}`,
      exists: false,
      itemCount: 0,
      invalidDateCount: 0,
      potentialGapDays: 0,
      potentialGapRanges: [],
      missingRequiredFields: {},
      notes: [],
    };

    let stat;
    try {
      stat = await fs.stat(sqliteDbPath);
      base.exists = true;
      base.lastFetchedAt = stat.mtime.toISOString();
      base.staleDays = this.calculateStaleDays(stat.mtime);
    } catch {
      base.notes.push('SQLite database not found. Dataset has not been fetched yet.');
      return base;
    }

    const records = this.loadSqlitePayloadRows(
      sqliteDbPath,
      def.sqliteSource.table,
      def.sqliteSource.payloadColumn,
      def.sqliteSource.namespace
    );

    base.itemCount = records.length;
    if (records.length === 0) {
      base.notes.push('Dataset not found in SQLite cache.');
      return base;
    }

    if (def.id === 'sonarqube.measures') {
      return base;
    }

    for (const field of def.requiredFields) {
      base.missingRequiredFields[field] = this.countMissing(records, field);
    }

    const dateValues = this.collectDateValues(records, def.dateFields);
    base.invalidDateCount = dateValues.invalidCount;

    if (dateValues.validIsoDates.length > 0) {
      const sorted = dateValues.validIsoDates.sort((a, b) => a.localeCompare(b));
      base.coverageStart = sorted[0];
      base.coverageEnd = sorted[sorted.length - 1];

      const gaps = this.computePotentialGaps(sorted, maxGapDays);
      base.potentialGapRanges = gaps;
      base.potentialGapDays = gaps.reduce((sum, gap) => sum + gap.days, 0);
    } else if (def.dateFields.length > 0) {
      base.notes.push('No valid date values found in expected date fields.');
    }

    return base;
  }

  private loadSqlitePayloadRows(
    sqliteDbPath: string,
    tableName: string,
    payloadColumn: string,
    namespace: string
  ): Array<Record<string, unknown>> {
    const db = new DatabaseSync(sqliteDbPath);
    try {
      applySqliteMigrations(db);
      const hasTable = Boolean(
        db
          .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
          .get(tableName)
      );

      if (!hasTable) {
        return [];
      }

      const rows = db
        .prepare(`SELECT ${payloadColumn} FROM ${tableName} WHERE namespace = ? ORDER BY rowid ASC`)
        .all(namespace) as Array<{ [key: string]: unknown }>;

      const records: Array<Record<string, unknown>> = [];
      for (const row of rows) {
        const payload = row[payloadColumn];
        if (typeof payload !== 'string' || payload.trim().length === 0) {
          continue;
        }

        try {
          const parsed = JSON.parse(payload) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            records.push(parsed as Record<string, unknown>);
          }
        } catch {
          continue;
        }
      }

      return records;
    } finally {
      db.close();
    }
  }

  private countMissing(records: Array<Record<string, unknown>>, field: string): number {
    return records.reduce((count, item) => {
      const value = item[field];
      if (value === null || value === undefined) return count + 1;
      if (typeof value === 'string' && value.trim().length === 0) return count + 1;
      return count;
    }, 0);
  }

  private collectDateValues(
    records: Array<Record<string, unknown>>,
    fields: string[]
  ): {
    validIsoDates: string[];
    invalidCount: number;
  } {
    const unique = new Set<string>();
    let invalidCount = 0;

    for (const record of records) {
      const raw = this.firstNonEmptyDateValue(record, fields);
      if (!raw) continue;

      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) {
        invalidCount += 1;
        continue;
      }

      unique.add(parsed.toISOString().slice(0, 10));
    }

    return {
      validIsoDates: Array.from(unique),
      invalidCount,
    };
  }

  private firstNonEmptyDateValue(record: Record<string, unknown>, fields: string[]): string | null {
    for (const field of fields) {
      const value = record[field];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }
    return null;
  }

  private computePotentialGaps(
    sortedIsoDays: string[],
    minGapDays: number
  ): Array<{ start: string; end: string; days: number }> {
    if (sortedIsoDays.length < 2) {
      return [];
    }

    const gaps: Array<{ start: string; end: string; days: number }> = [];

    for (let i = 1; i < sortedIsoDays.length; i++) {
      const prev = new Date(`${sortedIsoDays[i - 1]}T00:00:00.000Z`);
      const curr = new Date(`${sortedIsoDays[i]}T00:00:00.000Z`);
      const diffDays = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)) - 1;

      if (diffDays >= minGapDays) {
        const gapStart = new Date(prev.getTime() + 1000 * 60 * 60 * 24).toISOString().slice(0, 10);
        const gapEnd = new Date(curr.getTime() - 1000 * 60 * 60 * 24).toISOString().slice(0, 10);
        gaps.push({
          start: gapStart,
          end: gapEnd,
          days: diffDays,
        });
      }
    }

    return gaps;
  }

  private calculateStaleDays(modifiedAt: Date): number {
    const ms = Date.now() - modifiedAt.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }
}

export type { DatasetCheck, HealthReport, DatasetDefinition };
