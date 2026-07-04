import * as fs from 'fs/promises';
import * as path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { Logger } from '@smmachine/utils';
import { Configuration } from '../infrastructure/configuration';
import { RepositoryFactory } from '../infrastructure/repository-factory';
import { TimeZoneProvider } from '../infrastructure/timezone-provider';
import {
  WorkflowJobJsonResponse,
  WorkflowJsonResponse,
} from '../providers/github/github-response-types';
import { PipelineJob, PipelineRun } from '../domain';
import { BasePipelinesRepository } from './pipelines-repository-json';

type PayloadRow = {
  payload: string;
};

export class PipelinesSqliteRepository extends BasePipelinesRepository {
  private readonly sqliteDbPath: string;
  private readonly workflowRunsNamespace: string;
  private readonly workflowJobsNamespace: string;

  constructor(
    configuration: Configuration,
    logger: Logger,
    timeZoneProvider: TimeZoneProvider
  ) {
    super(logger, timeZoneProvider);
    this.sqliteDbPath = RepositoryFactory.getSqliteDatabasePath(configuration);
    this.workflowRunsNamespace = RepositoryFactory.getPipelineRunsSqliteNamespace(configuration);
    this.workflowJobsNamespace = RepositoryFactory.getPipelineJobsSqliteNamespace(configuration);
  }

  protected async loadPipelineRuns(): Promise<PipelineRun[]> {
    const rows = await this.loadPayloadRows('workflow_runs', this.workflowRunsNamespace);
    const pipelineRuns = rows
      .map((row) => this.deserialize<WorkflowJsonResponse>(row.payload))
      .map(this.mapPipelinesToDomain);

    this.logger.info(`Loaded ${pipelineRuns.length} pipeline runs from SQLite repository`);

    return pipelineRuns;
  }

  async loadPipelineJobs(): Promise<PipelineJob[]> {
    const rows = await this.loadPayloadRows('workflow_jobs', this.workflowJobsNamespace);
    return rows
      .map((row) => this.deserialize<WorkflowJobJsonResponse>(row.payload))
      .map(this.mapPipelineJobsToDomain);
  }

  private async loadPayloadRows(
    tableName: 'workflow_runs' | 'workflow_jobs',
    namespace: string
  ): Promise<PayloadRow[]> {
    await fs.mkdir(path.dirname(this.sqliteDbPath), { recursive: true });
    const db = new DatabaseSync(this.sqliteDbPath);
    try {
      if (!this.tableExists(db, tableName)) {
        return [];
      }

      return db
        .prepare(
          `SELECT payload
           FROM ${tableName}
           WHERE namespace = ?
           ORDER BY position ASC, id ASC`
        )
        .all(namespace) as PayloadRow[];
    } finally {
      db.close();
    }
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
}
