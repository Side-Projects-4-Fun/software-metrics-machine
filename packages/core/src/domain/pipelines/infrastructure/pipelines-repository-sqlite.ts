import * as fs from 'fs/promises';
import * as path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { Logger } from '@smmachine/utils';
import { Configuration } from '../../../infrastructure/configuration';
import { RepositoryFactory } from '../../../infrastructure/repository-factory';
import { TimeZoneProvider } from '../../../infrastructure/timezone-provider';
import {
  WorkflowJobJsonResponse,
  WorkflowJsonResponse,
} from '../../../providers/github/github-response-types';
import { PipelineJob, PipelineRun } from '../pipeline-types';
import { PipelinesRepository, LoadPipelinesOptions } from '../repositories/pipeline-repository';
import {
  ParseRawFiltersRepository,
  RawFilter,
} from '../../../infrastructure/parse-raw-filters-repository';
import { PipelineMapToDomainRepository } from '../../../providers/github/pipeline-map-to-domain-repository';
import { shouldIncludeTimestampForWeekendsMode } from '../../metric-samples';

type PayloadRow = {
  payload: string;
};

type SqlValue = string | number;

type PayloadQuery = {
  sql: string;
  params: SqlValue[];
};

type JobLoadOptions = {
  selectedJobNames?: string[];
  excludedJobNames?: string[];
  targetJobConclusion?: string;
};

export class PipelinesSqliteRepository extends ParseRawFiltersRepository implements PipelinesRepository {
  private readonly sqliteDbPath: string;
  private readonly workflowRunsNamespace: string;
  private readonly workflowJobsNamespace: string;
  private mapToDomain = new PipelineMapToDomainRepository();

  constructor(
    configuration: Configuration,
    private logger: Logger,
    private tz: TimeZoneProvider
  ) {
    super();
    this.sqliteDbPath = RepositoryFactory.getSqliteDatabasePath(configuration);
    this.workflowRunsNamespace = RepositoryFactory.getPipelineRunsSqliteNamespace(configuration);
    this.workflowJobsNamespace = RepositoryFactory.getPipelineJobsSqliteNamespace(configuration);
  }
  async loadPipelines(
    options: LoadPipelinesOptions = { includeJobs: true }
  ): Promise<PipelineRun[]> {
    const rows = await this.loadPayloadRows('workflow_runs', this.workflowRunsNamespace, options);
    const pipelineRunsFromDomain = rows
      .map((row) => this.deserialize<WorkflowJsonResponse>(row.payload))
      .map(this.mapToDomain.mapPipelinesToDomain);

    this.logger.info(`Loaded ${pipelineRunsFromDomain.length} pipeline runs from SQLite repository`);

    const pipelineRuns = this.filterRuns(pipelineRunsFromDomain, options);
    const selectedJobNames = this.normalizeJobNames(options.jobNames, options.jobName);
    const excludedJobNames = this.normalizeJobNames(undefined, options.excludeJobName);
    const targetJobConclusion = options.jobConclusion?.trim().toLowerCase();
    const rawFilters = this.parseRawFilters(options.rawFilters);
    const needsJobs =
      options.includeJobs !== false ||
      selectedJobNames.length > 0 ||
      Boolean(targetJobConclusion) ||
      rawFilters.length > 0;

    if (!needsJobs) {
      return this.applyRawFilters(pipelineRuns, rawFilters);
    }

    const jobs = await this.loadPipelineJobs({
      selectedJobNames,
      excludedJobNames,
      targetJobConclusion,
    }, options);
    if (jobs.length === 0 || pipelineRuns.length === 0) {
      if (selectedJobNames.length > 0 || targetJobConclusion) {
        return [];
      }
      const filteredRuns = this.applyRawFilters(pipelineRuns, rawFilters);
      return options.includeJobs === false ? filteredRuns.map(this.withoutJobs) : filteredRuns;
    }

    const runsById = new Map<string, PipelineRun>();
    for (const run of pipelineRuns) {
      runsById.set(String(run.id), run);
    }

    for (const job of jobs) {
      const run = runsById.get(String(job.runId));
      if (!run) {
        continue;
      }

      if (!run.jobs) {
        run.jobs = [];
      }

      run.jobs.push(job);
    }

    const jobFilteredRuns = this.filterRunsByJobs(
      pipelineRuns,
      selectedJobNames,
      excludedJobNames,
      targetJobConclusion
    );

    const namedFilteredRuns =
      selectedJobNames.length === 0 && excludedJobNames.length === 0 && !targetJobConclusion
        ? jobFilteredRuns
        : jobFilteredRuns.map((run) => ({
            ...run,
            jobs: this.filterJobs(
              run.jobs || [],
              selectedJobNames,
              excludedJobNames,
              targetJobConclusion
            ),
          }));

    const rawFilteredRuns = this.applyRawFilters(namedFilteredRuns, rawFilters);
    return options.includeJobs === false ? rawFilteredRuns.map(this.withoutJobs) : rawFilteredRuns;
  }

  async loadPipelineJobs(
    jobOptions: JobLoadOptions = {},
    runOptions?: LoadPipelinesOptions
  ): Promise<PipelineJob[]> {
    const rows = await this.loadWorkflowJobRows(jobOptions, runOptions);
    return rows
      .map((row) => this.deserialize<WorkflowJobJsonResponse>(row.payload))
      .map(this.mapToDomain.mapPipelineJobsToDomain);
  }

  private async loadWorkflowJobRows(
    jobOptions: JobLoadOptions,
    runOptions?: LoadPipelinesOptions
  ): Promise<PayloadRow[]> {
    await fs.mkdir(path.dirname(this.sqliteDbPath), { recursive: true });
    const db = new DatabaseSync(this.sqliteDbPath);
    try {
      if (!this.tableExists(db, 'workflow_jobs') || !this.tableExists(db, 'workflow_runs')) {
        return [];
      }

      const whereClauses = ['j.namespace = ?', 'r.id IS NOT NULL'];
      const params: SqlValue[] = [this.workflowJobsNamespace];

      if (runOptions) {
        this.addWorkflowRunFilters(whereClauses, params, runOptions, 'r');
      }

      this.addWorkflowJobFilters(whereClauses, params, jobOptions, 'j');

      return db
        .prepare(
          `SELECT j.payload
           FROM workflow_jobs j
           LEFT JOIN workflow_runs r
             ON j.run_id = r.id
            AND r.namespace = ?
           WHERE ${whereClauses.join(' AND ')}
           ORDER BY j.position ASC, j.id ASC`
        )
        .all(this.workflowRunsNamespace, ...params) as PayloadRow[];
    } finally {
      db.close();
    }
  }

  private async loadPayloadRows(
    tableName: 'workflow_runs' | 'workflow_jobs',
    namespace: string,
    options?: LoadPipelinesOptions,
    jobOptions?: JobLoadOptions
  ): Promise<PayloadRow[]> {
    await fs.mkdir(path.dirname(this.sqliteDbPath), { recursive: true });
    const db = new DatabaseSync(this.sqliteDbPath);
    try {
      if (!this.tableExists(db, tableName)) {
        return [];
      }

      const query = this.buildPayloadQuery(tableName, namespace, options, jobOptions);
      return db.prepare(query.sql).all(...query.params) as PayloadRow[];
    } finally {
      db.close();
    }
  }

  private buildPayloadQuery(
    tableName: 'workflow_runs' | 'workflow_jobs',
    namespace: string,
    options?: LoadPipelinesOptions,
    jobOptions?: JobLoadOptions
  ): PayloadQuery {
    const whereClauses = ['namespace = ?'];
    const params: SqlValue[] = [namespace];

    if (tableName === 'workflow_runs' && options) {
      this.addWorkflowRunFilters(whereClauses, params, options);
    } else if (tableName === 'workflow_jobs' && jobOptions) {
      this.addWorkflowJobFilters(whereClauses, params, jobOptions);
    }

    return {
      sql: `SELECT payload
            FROM ${tableName}
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY ${this.getPayloadRowsOrderBy(tableName, options)}`,
      params,
    };
  }

  private addWorkflowJobFilters(
    whereClauses: string[],
    params: SqlValue[],
    jobOptions: JobLoadOptions,
    tableAlias?: 'j'
  ): void {
    const nameColumn = this.column(tableAlias, 'name');
    const conclusionColumn = this.column(tableAlias, 'conclusion');

    this.addInFilter(whereClauses, params, `LOWER(${nameColumn})`, jobOptions.selectedJobNames || []);

    const excludedJobNames = jobOptions.excludedJobNames || [];
    if (excludedJobNames.length > 0) {
      whereClauses.push(
        `LOWER(${nameColumn}) NOT IN (${excludedJobNames.map(() => '?').join(', ')})`
      );
      params.push(...excludedJobNames);
    }

    if (jobOptions.targetJobConclusion) {
      whereClauses.push(`LOWER(${conclusionColumn}) = ?`);
      params.push(jobOptions.targetJobConclusion);
    }
  }

  private addWorkflowRunFilters(
    whereClauses: string[],
    params: SqlValue[],
    options: LoadPipelinesOptions,
    tableAlias?: 'r'
  ): void {
    const selectedStatuses = this.parseCsvList(options.status).map((item) => item.toLowerCase());
    const selectedConclusions = this.parseCsvList(options.conclusion).map((item) =>
      item.toLowerCase()
    );
    const selectedBranches = this.parseCsvList(options.targetBranch);
    const selectedEvents = this.parseCsvList(options.event);
    const start = options.startDate ? this.toDateBoundaryTimestamp(options.startDate, 'start') : 0;
    const end = options.endDate ? this.toDateBoundaryTimestamp(options.endDate, 'end') : 0;
    const metricDateExpression = this.getRunMetricDateSqlExpression(tableAlias);

    if (start) {
      whereClauses.push(`${metricDateExpression} >= ?`);
      params.push(new Date(start).toISOString());
    }

    if (end) {
      whereClauses.push(`${metricDateExpression} <= ?`);
      params.push(new Date(end).toISOString());
    }

    if (options.workflowPath) {
      whereClauses.push(`${this.column(tableAlias, 'path')} = ?`);
      params.push(options.workflowPath);
    }

    this.addInFilter(whereClauses, params, `LOWER(${this.column(tableAlias, 'status')})`, selectedStatuses);
    this.addInFilter(
      whereClauses,
      params,
      `LOWER(${this.column(tableAlias, 'conclusion')})`,
      selectedConclusions
    );
    this.addInFilter(whereClauses, params, this.column(tableAlias, 'head_branch'), selectedBranches);
    this.addInFilter(whereClauses, params, this.column(tableAlias, 'event'), selectedEvents);
  }

  private addInFilter(
    whereClauses: string[],
    params: SqlValue[],
    columnExpression: string,
    values: string[]
  ): void {
    if (values.length === 0) {
      return;
    }

    whereClauses.push(`${columnExpression} IN (${values.map(() => '?').join(', ')})`);
    params.push(...values);
  }

  private getPayloadRowsOrderBy(
    tableName: 'workflow_runs' | 'workflow_jobs',
    options?: LoadPipelinesOptions
  ): string {
    if (tableName === 'workflow_runs' && options?.sort_by?.created_at) {
      const direction = options.sort_by.created_at.toUpperCase();
      return `${this.getRunMetricDateSqlExpression()} ${direction}, position ASC, id ASC`;
    }

    return 'position ASC, id ASC';
  }

  private getRunMetricDateSqlExpression(tableAlias?: 'r'): string {
    const updatedAt = this.column(tableAlias, 'updated_at');
    const createdAt = this.column(tableAlias, 'created_at');
    return `COALESCE(NULLIF(${updatedAt}, ''), ${createdAt})`;
  }

  private column(tableAlias: 'j' | 'r' | undefined, columnName: string): string {
    if (!tableAlias) {
      return columnName;
    }

    return `${tableAlias}.${columnName}`;
  }

  private tableExists(db: DatabaseSync, tableName: string): boolean {
    return Boolean(
      db
        .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
        .get(tableName)
    );
  }

  private deserialize<T>(payload: string): T {
    return JSON.parse(payload) as T;
  }

  private normalizeJobNames(jobNames?: string[], jobName?: string | string[]): string[] {
    const rawJobNames = Array.isArray(jobName)
      ? jobName.flatMap((name) => this.parseCsvList(name))
      : this.parseCsvList(jobName);

    return [...(jobNames || []), ...rawJobNames]
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean);
  }

  private parseCsvList(value?: string): string[] {
    if (!value) {
      return [];
    }

    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private filterRuns(runs: PipelineRun[], options: LoadPipelinesOptions): PipelineRun[] {
    const selectedStatuses = this.parseCsvList(options.status).map((item) => item.toLowerCase());
    const selectedConclusions = this.parseCsvList(options.conclusion).map((item) =>
      item.toLowerCase()
    );
    const selectedBranches = this.parseCsvList(options.targetBranch);
    const selectedEvents = this.parseCsvList(options.event);
    const start = options.startDate ? this.toDateBoundaryTimestamp(options.startDate, 'start') : 0;
    const end = options.endDate ? this.toDateBoundaryTimestamp(options.endDate, 'end') : 0;

    const filteredRuns = runs.filter((run) => {
      if (start || end) {
        const runTimestamp = this.toTimestamp(this.getRunMetricDate(run));
        if (start && runTimestamp < start) return false;
        if (end && runTimestamp > end) return false;
      }
      if (
        !shouldIncludeTimestampForWeekendsMode(
          this.getRunMetricDate(run),
          options.weekends,
          (dateString) => this.isWeekday(dateString)
        )
      ) {
        return false;
      }
      if (options.workflowPath && run.path !== options.workflowPath) {
        return false;
      }
      if (
        selectedStatuses.length > 0 &&
        !selectedStatuses.includes((run.status || '').toLowerCase())
      ) {
        return false;
      }
      if (
        selectedConclusions.length > 0 &&
        !selectedConclusions.includes((run.conclusion || '').toLowerCase())
      ) {
        return false;
      }
      if (selectedBranches.length > 0 && !selectedBranches.includes(run.branch || '')) {
        return false;
      }
      if (selectedEvents.length > 0 && !selectedEvents.includes(run.event || '')) {
        return false;
      }

      return true;
    });

    if (options.sort_by?.created_at) {
      return this.sortRunsByMetricDate(filteredRuns, options.sort_by.created_at);
    }

    return filteredRuns;
  }

  private isWeekday(dateString?: string): boolean {
    if (!dateString) {
      return true;
    }

    const dateKey = this.tz.getDateKey(dateString);
    const [year, month, day] = dateKey.split('-').map(Number);
    const timezoneDay = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
    return timezoneDay >= 1 && timezoneDay <= 5;
  }

  private filterRunsByJobs(
    runs: PipelineRun[],
    selectedJobNames: string[],
    excludedJobNames: string[],
    targetJobConclusion?: string
  ): PipelineRun[] {
    if (selectedJobNames.length === 0 && excludedJobNames.length === 0 && !targetJobConclusion) {
      return runs;
    }

    return runs.filter(
      (run) =>
        this.filterJobs(run.jobs || [], selectedJobNames, excludedJobNames, targetJobConclusion)
          .length > 0
    );
  }

  private filterJobs(
    jobs: PipelineJob[],
    selectedJobNames: string[],
    excludedJobNames: string[],
    targetJobConclusion?: string
  ): PipelineJob[] {
    return jobs
      .filter(
        (job) =>
          selectedJobNames.length === 0 || selectedJobNames.includes((job.name || '').toLowerCase())
      )
      .filter((job) => !excludedJobNames.includes((job.name || '').toLowerCase()))
      .filter((job) => {
        if (!targetJobConclusion) {
          return true;
        }

        return (job.conclusion || '').toLowerCase() === targetJobConclusion;
      });
  }

  private applyRawFilters(runs: PipelineRun[], rawFilters: RawFilter[]): PipelineRun[] {
    if (rawFilters.length === 0) {
      return runs;
    }

    return runs.flatMap((run) => {
      const runWithoutJobs = { ...run };
      delete runWithoutJobs.jobs;

      const jobs = run.jobs || [];
      const matchesAtAnyLayer = rawFilters.every(
        (filter) =>
          this.matchesRawFilters(runWithoutJobs, [filter]) ||
          jobs.some((job) => this.matchesRawFilters(job, [filter]))
      );
      const jobRelevantFilters = rawFilters.filter((filter) =>
        jobs.some((job) => this.collectRawFilterValues(job, filter.key).length > 0)
      );
      const filteredJobs =
        jobRelevantFilters.length > 0
          ? jobs.filter((job) => this.matchesRawFilters(job, jobRelevantFilters))
          : jobs;

      if (!matchesAtAnyLayer) {
        return [];
      }

      if (!run.jobs) {
        return [run];
      }

      return [{ ...run, jobs: filteredJobs }];
    });
  }

  private withoutJobs(run: PipelineRun): PipelineRun {
    const runWithoutJobs = { ...run };
    delete runWithoutJobs.jobs;
    return runWithoutJobs;
  }

  private getRunMetricDate(run: PipelineRun): string | undefined {
    return run.completedAt || run.createdAt;
  }

  private toTimestamp(value?: string): number {
    if (!value) {
      return 0;
    }

    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toDateBoundaryTimestamp(value: string, boundary: 'start' | 'end'): number {
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (isDateOnly) {
      const d =
        boundary === 'end'
          ? this.tz.getEndOfDayBoundary(value)
          : this.tz.getStartOfDayBoundary(value);
      return d.getTime();
    }

    const isoWeekMatch = value.match(/^(\d{4})-W(\d{2})$/);
    if (isoWeekMatch) {
      const year = Number(isoWeekMatch[1]);
      const week = Number(isoWeekMatch[2]);
      const weekBoundary = this.getIsoWeekBoundaryDate(year, week, boundary);
      if (weekBoundary) {
        return weekBoundary.getTime();
      }
    }

    return this.toTimestamp(value);
  }

  private getIsoWeekBoundaryDate(
    year: number,
    week: number,
    boundary: 'start' | 'end'
  ): Date | undefined {
    const weekStart = this.getIsoWeekStartDate(year, week);
    if (!weekStart) {
      return undefined;
    }

    const boundaryDate = new Date(weekStart);
    if (boundary === 'end') {
      boundaryDate.setUTCDate(boundaryDate.getUTCDate() + 6);
      return this.tz.getEndOfDayBoundary(boundaryDate.toISOString().slice(0, 10));
    }

    return this.tz.getStartOfDayBoundary(boundaryDate.toISOString().slice(0, 10));
  }

  private getIsoWeekStartDate(year: number, week: number): Date | undefined {
    if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1 || week > 53) {
      return undefined;
    }

    const january4th = new Date(Date.UTC(year, 0, 4, 12, 0, 0));
    const january4thDayOfWeek = january4th.getUTCDay() || 7;
    const week1Monday = new Date(january4th);
    week1Monday.setUTCDate(january4th.getUTCDate() - (january4thDayOfWeek - 1));

    const targetMonday = new Date(week1Monday);
    targetMonday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);

    return targetMonday;
  }

  private sortRunsByMetricDate(runs: PipelineRun[], direction: 'asc' | 'desc'): PipelineRun[] {
    const sortDirection = direction === 'asc' ? 1 : -1;
    return [...runs].sort(
      (a, b) =>
        (this.toTimestamp(this.getRunMetricDate(a)) - this.toTimestamp(this.getRunMetricDate(b))) *
        sortDirection
    );
  }
}
