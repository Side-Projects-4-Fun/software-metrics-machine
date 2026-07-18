import { Configuration } from '@smmachine/core/infrastructure/configuration';
import { RepositoryFactory } from '@smmachine/core/infrastructure/repository-factory';
import { applySqliteMigrations } from '@smmachine/core/infrastructure/sqlite-migrations';
import * as fs from 'fs/promises';
import { DatabaseSync } from 'node:sqlite';
import type { SmmCommand } from './smm-command';
import type { Screen } from '../screen';

type DatasetCheck = {
  id: string;
  filePath: string;
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
  filePath: string;
  dateFields: string[];
  requiredFields: string[];
  sqliteSource: {
    table: string;
    payloadColumn: string;
    namespace: string;
  };
};

export function createHealthCheckCommand(program: SmmCommand): void {
  const screen = program.getScreen();

  program
    .subcommand('health-check')
    .description('Analyze local cache data quality (missing, stale, invalid, and coverage gaps)')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .option('--provider <name>', 'Filter provider (all|github|jira|sonarqube)', 'all')
    .option(
      '--max-gap-days <days>',
      'Only report potential gaps larger than this number of days',
      '1'
    )
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('HealthCheckCommand');
      try {
        const config = command.getConfiguration();
        const maxGapDays = Number.parseInt(options.maxGapDays, 10);

        if (Number.isNaN(maxGapDays) || maxGapDays < 1) {
          throw new Error('--max-gap-days must be a positive integer');
        }

        const report = await buildHealthReport(config, options.provider, maxGapDays);

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(report, null, 2));
          return;
        }

        printTextReport(report, maxGapDays, screen);
      } catch (error) {
        logger.error('Failed to run health check', error);
        process.exit(1);
      }
    });
}

async function buildHealthReport(
  config: Configuration,
  providerFilter: string,
  maxGapDays: number
): Promise<HealthReport> {
  const nowIso = new Date().toISOString();
  const definitions = getDatasetDefinitions(config, providerFilter);

  const datasets = await Promise.all(
    definitions.map((def) => analyzeDataset(def, config, maxGapDays))
  );

  const summary = datasets.reduce(
    (acc, dataset) => {
      const level = getDatasetLevel(dataset);
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

function getDatasetDefinitions(config: Configuration, providerFilter: string): DatasetDefinition[] {
  const gitDir = config.getPathFromGitProvider();
  const jiraDir = config.getJiraPath();
  const sonarDir = config.getSonarqubePath();
  const gitProviderId = (config.gitProvider || 'github').toLowerCase();
  const sqliteNamespace = (filePath: string): string =>
    RepositoryFactory.getSqliteNamespace(filePath, config);

  const allDefinitions: DatasetDefinition[] = [
    {
      id: `${gitProviderId}.prs`,
      filePath: `${gitDir}/prs.json`,
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
      filePath: `${gitDir}/pr-comments.json`,
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
      filePath: `${gitDir}/workflows.json`,
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
      filePath: `${gitDir}/jobs.json`,
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
      filePath: `${jiraDir}/issues.json`,
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
      filePath: `${sonarDir}/historical-measures.json`,
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
      filePath: `${sonarDir}/measures.json`,
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

async function analyzeDataset(
  def: DatasetDefinition,
  config: Configuration,
  maxGapDays: number
): Promise<DatasetCheck> {
  const storageType = config.internal?.storageType ?? 'sqlite';
  if (storageType === 'sqlite') {
    return analyzeSqliteDataset(def, config, maxGapDays);
  }

  return analyzeJsonDataset(def, maxGapDays);
}

async function analyzeJsonDataset(
  def: DatasetDefinition,
  maxGapDays: number
): Promise<DatasetCheck> {
  const base: DatasetCheck = {
    id: def.id,
    filePath: def.filePath,
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
    stat = await fs.stat(def.filePath);
    base.exists = true;
    base.lastFetchedAt = stat.mtime.toISOString();
    base.staleDays = calculateStaleDays(stat.mtime);
  } catch {
    base.notes.push('Cache file not found. Dataset has not been fetched yet.');
    return base;
  }

  let parsed: unknown;
  try {
    const contents = await fs.readFile(def.filePath, 'utf-8');
    parsed = JSON.parse(contents);
  } catch {
    base.notes.push('Cache file is not valid JSON.');
    return base;
  }

  if (def.id === 'sonarqube.measures') {
    const asObj = parsed as Record<string, unknown>;
    const measures = Array.isArray(asObj?.measures) ? asObj.measures : [];
    base.itemCount = measures.length;
    if (base.itemCount === 0) {
      base.notes.push('No measures found in cache payload.');
    }
    return base;
  }

  if (!Array.isArray(parsed)) {
    base.notes.push('Expected an array payload but found a different JSON structure.');
    return base;
  }

  const records = parsed as Array<Record<string, unknown>>;
  base.itemCount = records.length;

  if (records.length === 0) {
    base.notes.push('Dataset exists but is empty.');
    return base;
  }

  for (const field of def.requiredFields) {
    base.missingRequiredFields[field] = countMissing(records, field);
  }

  const dateValues = collectDateValues(records, def.dateFields);
  base.invalidDateCount = dateValues.invalidCount;

  if (dateValues.validIsoDates.length > 0) {
    const sorted = dateValues.validIsoDates.sort((a, b) => a.localeCompare(b));
    base.coverageStart = sorted[0];
    base.coverageEnd = sorted[sorted.length - 1];

    const gaps = computePotentialGaps(sorted, maxGapDays);
    base.potentialGapRanges = gaps;
    base.potentialGapDays = gaps.reduce((sum, gap) => sum + gap.days, 0);
  } else if (def.dateFields.length > 0) {
    base.notes.push('No valid date values found in expected date fields.');
  }

  return base;
}

async function analyzeSqliteDataset(
  def: DatasetDefinition,
  config: Configuration,
  maxGapDays: number
): Promise<DatasetCheck> {
  const sqliteDbPath = RepositoryFactory.getSqliteDatabasePath(config);
  const base: DatasetCheck = {
    id: def.id,
    filePath: def.filePath,
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
    base.staleDays = calculateStaleDays(stat.mtime);
  } catch {
    base.notes.push('SQLite database not found. Dataset has not been fetched yet.');
    return base;
  }

  const records = loadSqlitePayloadRows(
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
    base.missingRequiredFields[field] = countMissing(records, field);
  }

  const dateValues = collectDateValues(records, def.dateFields);
  base.invalidDateCount = dateValues.invalidCount;

  if (dateValues.validIsoDates.length > 0) {
    const sorted = dateValues.validIsoDates.sort((a, b) => a.localeCompare(b));
    base.coverageStart = sorted[0];
    base.coverageEnd = sorted[sorted.length - 1];

    const gaps = computePotentialGaps(sorted, maxGapDays);
    base.potentialGapRanges = gaps;
    base.potentialGapDays = gaps.reduce((sum, gap) => sum + gap.days, 0);
  } else if (def.dateFields.length > 0) {
    base.notes.push('No valid date values found in expected date fields.');
  }

  return base;
}

function loadSqlitePayloadRows(
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

function countMissing(records: Array<Record<string, unknown>>, field: string): number {
  return records.reduce((count, item) => {
    const value = item[field];
    if (value === null || value === undefined) return count + 1;
    if (typeof value === 'string' && value.trim().length === 0) return count + 1;
    return count;
  }, 0);
}

function collectDateValues(
  records: Array<Record<string, unknown>>,
  fields: string[]
): {
  validIsoDates: string[];
  invalidCount: number;
} {
  const unique = new Set<string>();
  let invalidCount = 0;

  for (const record of records) {
    const raw = firstNonEmptyDateValue(record, fields);
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

function firstNonEmptyDateValue(record: Record<string, unknown>, fields: string[]): string | null {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function computePotentialGaps(
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

function calculateStaleDays(modifiedAt: Date): number {
  const ms = Date.now() - modifiedAt.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function getDatasetLevel(dataset: DatasetCheck): 'healthy' | 'warning' | 'error' {
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

function printTextReport(report: HealthReport, maxGapDays: number, screen: Screen): void {
  screen.printLine('🩺 Data Health Check');
  screen.printLine(`Generated at: ${report.generatedAt}`);
  screen.printLine(`Base directory: ${report.baseDirectory}`);
  screen.printLine('');

  screen.printLine('Summary');
  screen.printLine(`  Total datasets: ${report.summary.totalDatasets}`);
  screen.printLine(`  Healthy: ${report.summary.healthyDatasets}`);
  screen.printLine(`  Warnings: ${report.summary.warningDatasets}`);
  screen.printLine(`  Errors: ${report.summary.errorDatasets}`);
  screen.printLine('');

  for (const dataset of report.datasets) {
    const level = getDatasetLevel(dataset);
    const icon = level === 'healthy' ? '✅' : level === 'warning' ? '⚠️' : '❌';

    screen.printLine(`${icon} ${dataset.id}`);
    screen.printLine(`  File: ${dataset.filePath}`);
    screen.printLine(`  Exists: ${dataset.exists ? 'yes' : 'no'}`);
    screen.printLine(`  Items: ${dataset.itemCount}`);

    if (dataset.lastFetchedAt) {
      screen.printLine(
        `  Last fetched: ${dataset.lastFetchedAt} (${dataset.staleDays} day(s) ago)`
      );
    }

    if (dataset.coverageStart && dataset.coverageEnd) {
      screen.printLine(`  Coverage: ${dataset.coverageStart} .. ${dataset.coverageEnd}`);
    }

    if (dataset.invalidDateCount > 0) {
      screen.printLine(`  Invalid date records: ${dataset.invalidDateCount}`);
    }

    const missingEntries = Object.entries(dataset.missingRequiredFields).filter(
      ([, count]) => count > 0
    );
    if (missingEntries.length > 0) {
      screen.printLine('  Missing required fields:');
      for (const [field, count] of missingEntries) {
        screen.printLine(`    - ${field}: ${count}`);
      }
    }

    if (dataset.potentialGapRanges.length > 0) {
      screen.printLine(`  Potential gaps (> ${maxGapDays - 1} day(s) between records):`);
      for (const gap of dataset.potentialGapRanges.slice(0, 5)) {
        screen.printLine(`    - ${gap.start} .. ${gap.end} (${gap.days} day(s))`);
      }
      if (dataset.potentialGapRanges.length > 5) {
        screen.printLine(`    - ... ${dataset.potentialGapRanges.length - 5} more`);
      }
    }

    if (dataset.notes.length > 0) {
      screen.printLine('  Notes:');
      for (const note of dataset.notes) {
        screen.printLine(`    - ${note}`);
      }
    }

    screen.printLine('');
  }
}
