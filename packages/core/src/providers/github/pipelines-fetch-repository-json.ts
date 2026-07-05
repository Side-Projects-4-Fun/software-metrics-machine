import { Logger } from '@smmachine/utils';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Configuration, IRepository } from '../../infrastructure';
import { TimeZoneProvider } from '../../infrastructure/timezone-provider';
import { type IGithubWorkflowClient } from '../index';
import { WorkflowJsonResponse } from './github-response-types';
import { PipelineFiltersRepository } from '../../domain/pipelines/repositories/pipeline-filters-repository';
import { buildCreatedFilter } from './github-date-utils';

interface WorkflowsProgress {
  page: number;
}

function isDateOnly(value?: string): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export class PipelinesFetchRepository {
  private tz: TimeZoneProvider;

  constructor(
    private configuration: Configuration,
    private githubWorkflowClient: IGithubWorkflowClient,
    private pipelineRunJsonRepository: IRepository<WorkflowJsonResponse>,
    private pipelineFiltersRepository: PipelineFiltersRepository | undefined,
    private logger: Logger
  ) {
    this.tz = new TimeZoneProvider(configuration.timezone);
  }

  async fetchPipelines(options?: {
    startDate?: string;
    endDate?: string;
    rawFilters?: string;
    forceRefresh?: boolean;
    byDay?: boolean;
    incrementalUpdate?: boolean;
  }): Promise<WorkflowJsonResponse[]> {
    const fromCache = await this.pipelineRunJsonRepository.loadAll();

    if (options?.incrementalUpdate && fromCache.length > 0) {
      const latestDate = this.findLatestDate(fromCache.map((r) => r.created_at));
      this.logger.info(`Incremental update: fetching pipelines created after ${latestDate}...`);
      let freshRuns: WorkflowJsonResponse[];

      if (options?.byDay && isDateOnly(latestDate) && isDateOnly(options?.endDate)) {
        freshRuns = await this.fetchWorkflowsByDay(latestDate, options.endDate, options.rawFilters);
      } else {
        freshRuns = await this.fetchWorkflowsWithResume({
          created: this.buildCreatedFilter(latestDate, options?.endDate),
          rawFilters: options?.rawFilters,
        });
      }

      const merged = this.mergeById(fromCache, freshRuns);
      await this.pipelineRunJsonRepository.saveAll(merged);
      await this.refreshDashboardFilterOptions();
      return merged;
    }

    // Manual date range with merge
    if (
      (options?.startDate || options?.endDate) &&
      !options?.forceRefresh &&
      fromCache.length > 0
    ) {
      this.logger.info(
        `Fetching pipelines for range [${options?.startDate || 'any'}..${options?.endDate || 'any'}] and merging with cache...`
      );
      let workflows: WorkflowJsonResponse[];
      if (options?.byDay && isDateOnly(options?.startDate) && isDateOnly(options?.endDate)) {
        workflows = await this.fetchWorkflowsByDay(
          options.startDate,
          options.endDate,
          options.rawFilters
        );
      } else {
        workflows = await this.fetchWorkflowsWithResume({
          created: this.buildCreatedFilter(options?.startDate, options?.endDate),
          rawFilters: options?.rawFilters,
        });
      }
      const merged = this.mergeById(fromCache, workflows);
      await this.pipelineRunJsonRepository.saveAll(merged);
      await this.refreshDashboardFilterOptions();
      return merged;
    }

    if (fromCache.length > 0 && !options?.forceRefresh) {
      this.logger.info(`Using cached pipelines: ${fromCache.length} records`);
      return fromCache;
    }

    this.logger.info(
      `Fetching workflows from GitHub ${options?.startDate} - ${options?.endDate}...`
    );
    let workflows: WorkflowJsonResponse[];

    if (options?.byDay && isDateOnly(options?.startDate) && isDateOnly(options?.endDate)) {
      workflows = await this.fetchWorkflowsByDay(
        options.startDate,
        options.endDate,
        options.rawFilters
      );
    } else {
      workflows = await this.fetchWorkflowsWithResume({
        created: this.buildCreatedFilter(options?.startDate, options?.endDate),
        rawFilters: options?.rawFilters,
      });
    }
    // Persist fetched workflows/jobs so metrics commands can run from local data.
    await this.pipelineRunJsonRepository.saveAll(workflows);
    await this.refreshDashboardFilterOptions();

    return workflows;
  }

  private async refreshDashboardFilterOptions(): Promise<void> {
    await this.pipelineFiltersRepository?.refreshOptions();
  }

  private async fetchWorkflowsByDay(
    startDate: string,
    endDate: string,
    rawFilters?: string
  ): Promise<WorkflowJsonResponse[]> {
    const allRuns: WorkflowJsonResponse[] = [];

    // For fetch, convert timezone-aware dates to UTC boundaries for the GitHub API.
    // getStartOfDayBoundary("2025-03-15") in Europe/Madrid → 2025-03-14T23:00:00Z
    // getEndOfDayBoundary("2025-03-15") in Europe/Madrid   → 2025-03-15T22:59:59.999Z
    const totalDays = this.countDays(startDate, endDate);
    for (let i = 0; i < totalDays; i++) {
      const dayDate = this.addDays(startDate, i);
      const dayStart = this.tz.getStartOfDayBoundary(dayDate);
      const dayEnd = this.tz.getEndOfDayBoundary(dayDate);

      const dayStartStr = dayStart.toISOString();
      const dayEndStr = dayEnd.toISOString();

      this.logger.info(
        `Fetching workflows for day ${dayDate} (UTC: ${dayStartStr}..${dayEndStr})...`
      );

      const dayRuns = await this.fetchWorkflowsWithResume({
        created: `${dayStartStr}..${dayEndStr}`,
        rawFilters,
      });

      allRuns.push(...dayRuns);
    }

    return allRuns;
  }

  /**
   * Count the number of days between two date strings (inclusive).
   */
  private countDays(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  }

  /**
   * Add N days to a date string and return "YYYY-MM-DD".
   */
  private addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
  }

  private async fetchWorkflowsWithResume(options?: {
    created?: string;
    startDate?: string;
    endDate?: string;
    rawFilters?: string;
  }): Promise<WorkflowJsonResponse[]> {
    const progressPath = this.fileInCache('workflows_progress.json');
    const incompletedPath = this.fileInCache('workflows_incompleted.json');

    const progress = await this.readJson<WorkflowsProgress | null>(progressPath, null);
    const runs: WorkflowJsonResponse[] = await this.readJson<WorkflowJsonResponse[]>(
      incompletedPath,
      []
    );

    let page = progress?.page || 1;
    const perPage = 100;
    let stopPagination = false;

    while (!stopPagination) {
      try {
        this.logger.info(`Fetching workflows total of ${perPage} in page ${page} from GitHub...`);
        const response = await this.githubWorkflowClient.fetchWorkflowRunsPage(page, perPage, {
          created: options?.created,
          rawFilters: options?.rawFilters,
        });
        const fetchedRuns = response.runs || [];

        if (fetchedRuns.length === 0) {
          break;
        }

        for (const run of fetchedRuns) {
          runs.push(run);
        }

        await this.writeJson(incompletedPath, runs);

        if (stopPagination || !response.hasNext) {
          break;
        }

        page += 1;
        await this.writeJson(progressPath, { page });
      } catch (error) {
        if (this.isUnprocessableEntityError(error)) {
          this.logger.info(
            `GitHub returned 422 while fetching workflows page ${page}; treating as pagination end.`
          );
          await this.writeJson(incompletedPath, runs);
          await this.writeJson(progressPath, { page });
          break;
        }

        await this.writeJson(incompletedPath, runs);
        await this.writeJson(progressPath, { page });
        throw error;
      }
    }

    await this.deleteFile(progressPath);
    await this.deleteFile(incompletedPath);
    return runs;
  }

  private findLatestDate(dates: (string | undefined | null)[]): string {
    const valid = dates.filter((d): d is string => !!d).map((d) => new Date(d).getTime());
    if (valid.length === 0) return new Date(0).toISOString();
    return new Date(Math.max(...valid)).toISOString();
  }

  private mergeById(
    existing: WorkflowJsonResponse[],
    incoming: WorkflowJsonResponse[]
  ): WorkflowJsonResponse[] {
    const map = new Map<string, WorkflowJsonResponse>();
    for (const run of existing) map.set(run.id, run);
    for (const run of incoming) map.set(run.id, run);
    return Array.from(map.values());
  }

  private buildCreatedFilter(startDate?: string, endDate?: string): string | undefined {
    return buildCreatedFilter(startDate, endDate, this.tz);
  }

  private fileInCache(fileName: string): string {
    return path.join(this.configuration.getPathFromGitProvider(), fileName);
  }

  private async readJson<T>(filePath: string, fallback: T): Promise<T> {
    try {
      const contents = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(contents) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return fallback;
      }
      throw error;
    }
  }

  private async writeJson(filePath: string, value: unknown): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
  }

  private async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private isUnprocessableEntityError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const maybeError = error as {
      status?: number;
      response?: {
        status?: number;
      };
    };

    return maybeError.status === 422 || maybeError.response?.status === 422;
  }
}
