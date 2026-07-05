import { Logger } from '@smmachine/utils';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Configuration, IRepository } from '../../infrastructure';
import { TimeZoneProvider } from '../../infrastructure/timezone-provider';
import { WorkflowJobJsonResponse, WorkflowJsonResponse } from './github-response-types';
import { IGithubWorkflowJobClient } from './workflow-types';
import { PipelineFiltersRepository } from '../../domain/pipelines/repositories/pipeline-filters-repository';

interface JobsProgress {
  processedRunIds: string[];
  partial?: {
    runId: string;
    page: number;
  } | null;
}

function isDateOnly(value?: string): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export class PipelinesJobFetchRepository {
  private tz: TimeZoneProvider;

  constructor(
    private configuration: Configuration,
    private githubWorkflowClient: IGithubWorkflowJobClient,
    private pipelineRunJsonRepository: IRepository<WorkflowJsonResponse>,
    private pipelineJobsJsonRepository: IRepository<WorkflowJobJsonResponse>,
    private pipelineFiltersRepository: PipelineFiltersRepository | undefined,
    private logger: Logger
  ) {
    this.tz = new TimeZoneProvider(configuration.timezone);
  }

  async fetchJobs(filters: {
    forceRefresh?: boolean;
    startDate?: string;
    endDate?: string;
    rawFilters?: string;
    byDay?: boolean;
    incrementalUpdate?: boolean;
  }): Promise<WorkflowJobJsonResponse[]> {
    const cachedJobs = await this.pipelineJobsJsonRepository.loadAll();

    if (filters?.incrementalUpdate && cachedJobs.length > 0) {
      const latestDate = this.findLatestDate(cachedJobs.map((j) => j.completed_at));
      this.logger.info(`Incremental update: fetching jobs for runs after ${latestDate}...`);
      const cachedRuns = await this.pipelineRunJsonRepository.loadAll();
      const startDate = this.toDateBoundary(latestDate, 'start');
      let freshJobs: WorkflowJobJsonResponse[];

      if (filters?.byDay && isDateOnly(latestDate) && isDateOnly(filters?.endDate)) {
        freshJobs = await this.fetchJobsByDay(
          cachedRuns,
          latestDate,
          filters.endDate,
          filters.rawFilters
        );
      } else {
        const newRuns = this.filterRunsByDateRange(cachedRuns, startDate, undefined);
        freshJobs = await this.fetchJobsWithResume(newRuns, filters.rawFilters);
      }

      const merged = this.mergeJobsById(cachedJobs, freshJobs);
      await this.pipelineJobsJsonRepository.saveAll(merged);
      await this.refreshDashboardFilterOptions();
      return merged;
    }

    // Manual date range with merge
    if (
      (filters?.startDate || filters?.endDate) &&
      !filters?.forceRefresh &&
      cachedJobs.length > 0
    ) {
      this.logger.info(
        `Fetching jobs for range [${filters?.startDate || 'any'}..${filters?.endDate || 'any'}] and merging with cache...`
      );
      const cachedRuns = await this.pipelineRunJsonRepository.loadAll();
      let freshJobs: WorkflowJobJsonResponse[];

      if (filters?.byDay && isDateOnly(filters?.startDate) && isDateOnly(filters?.endDate)) {
        freshJobs = await this.fetchJobsByDay(
          cachedRuns,
          filters.startDate,
          filters.endDate,
          filters.rawFilters
        );
      } else {
        const startDate = this.toDateBoundary(filters.startDate, 'start');
        const endDate = this.toDateBoundary(filters.endDate, 'end');
        const filteredRuns = this.filterRunsByDateRange(cachedRuns, startDate, endDate);
        freshJobs = await this.fetchJobsWithResume(filteredRuns, filters.rawFilters);
      }

      const merged = this.mergeJobsById(cachedJobs, freshJobs);
      await this.pipelineJobsJsonRepository.saveAll(merged);
      await this.refreshDashboardFilterOptions();
      return merged;
    }

    if (cachedJobs.length > 0 && !filters?.forceRefresh) {
      this.logger.info(`Using cached jobs: ${cachedJobs.length} records`);
      return cachedJobs;
    }

    const cachedRuns = await this.pipelineRunJsonRepository.loadAll();

    if (filters?.byDay && isDateOnly(filters?.startDate) && isDateOnly(filters?.endDate)) {
      return this.fetchJobsByDay(
        cachedRuns,
        filters.startDate,
        filters.endDate,
        filters.rawFilters
      );
    } else {
      const startDate = this.toDateBoundary(filters.startDate, 'start');
      const endDate = this.toDateBoundary(filters.endDate, 'end');

      const filteredRuns = this.filterRunsByDateRange(cachedRuns, startDate, endDate);
      this.logger.info(`Fetching jobs for ${filteredRuns.length} workflow runs...`);
      return this.fetchJobsWithResume(filteredRuns, filters.rawFilters);
    }
  }

  private async fetchJobsByDay(
    cachedRuns: WorkflowJsonResponse[],
    startDate: string,
    endDate: string,
    rawFilters?: string
  ): Promise<WorkflowJobJsonResponse[]> {
    const allJobs: WorkflowJobJsonResponse[] = [];

    // For fetch, convert timezone-aware dates to UTC boundaries for the GitHub API.
    const totalDays = this.countDays(startDate, endDate);
    for (let i = 0; i < totalDays; i++) {
      const dayDate = this.addDays(startDate, i);
      const dayStart = this.tz.getStartOfDayBoundary(dayDate);
      const dayEnd = this.tz.getEndOfDayBoundary(dayDate);

      this.logger.info(
        `Fetching jobs for day ${dayDate} (UTC: ${dayStart.toISOString()}...${dayEnd.toISOString()})...`
      );

      const runsForDay = cachedRuns.filter((run) => {
        const createdAt = run.created_at;
        if (!createdAt || createdAt.trim().length === 0) {
          return false;
        }

        const runDate = new Date(createdAt);
        if (Number.isNaN(runDate.getTime())) {
          return false;
        }

        return runDate >= dayStart && runDate <= dayEnd;
      });

      if (runsForDay.length > 0) {
        const dayJobs = await this.fetchJobsWithResume(runsForDay, rawFilters);
        allJobs.push(...dayJobs);
      }
    }

    return allJobs;
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

  private findLatestDate(dates: (string | undefined | null)[]): string {
    const valid = dates.filter((d): d is string => !!d).map((d) => new Date(d).getTime());
    if (valid.length === 0) return new Date(0).toISOString();
    return new Date(Math.max(...valid)).toISOString();
  }

  private mergeJobsById(
    existing: WorkflowJobJsonResponse[],
    incoming: WorkflowJobJsonResponse[]
  ): WorkflowJobJsonResponse[] {
    const map = new Map<string, WorkflowJobJsonResponse>();
    for (const job of existing) map.set(job.id, job);
    for (const job of incoming) map.set(job.id, job);
    return Array.from(map.values());
  }

  private filterRunsByDateRange(
    runs: WorkflowJsonResponse[],
    startDate: Date | undefined,
    endDate: Date | undefined
  ): WorkflowJsonResponse[] {
    return runs.filter((run) => {
      const createdAt = run.created_at;
      if (!createdAt || createdAt.trim().length === 0) {
        return false;
      }

      const runDate = new Date(createdAt);
      if (Number.isNaN(runDate.getTime())) {
        return false;
      }

      if (!startDate && !endDate) {
        return true;
      }

      if (startDate && runDate < startDate) {
        return false;
      }

      if (endDate && runDate > endDate) {
        return false;
      }

      return true;
    });
  }

  async fetchJobsWithResume(
    workflows: WorkflowJsonResponse[],
    rawFilters?: string
  ): Promise<WorkflowJobJsonResponse[]> {
    const progressPath = this.fileInCache('jobs_progress.json');
    const incompletedPath = this.fileInCache('jobs_incompleted.json');

    const progress = await this.readJson<JobsProgress>(progressPath, {
      processedRunIds: [],
      partial: null,
    });

    const processedRunIds = new Set(progress.processedRunIds || []);
    const allJobs: WorkflowJobJsonResponse[] = await this.readJson<WorkflowJobJsonResponse[]>(
      incompletedPath,
      []
    );
    const perPage = 100;

    for (const run of workflows) {
      const runId = String(run.id);
      if (!runId || processedRunIds.has(runId)) {
        continue;
      }

      let page =
        progress.partial?.runId === runId && progress.partial?.page ? progress.partial.page : 1;

      while (true) {
        try {
          this.logger.info(`Fetching jobs for workflow run ${runId} in page ${page}...`);
          const response = await this.githubWorkflowClient.fetchJobsPage(runId, page, perPage, {
            rawFilters,
          });
          allJobs.push(...response.jobs);
          await this.writeJson(incompletedPath, allJobs);

          if (response.hasNext) {
            page += 1;
            await this.writeJson(progressPath, {
              processedRunIds: Array.from(processedRunIds),
              partial: { runId, page },
            });
            continue;
          }

          processedRunIds.add(runId);
          await this.writeJson(progressPath, {
            processedRunIds: Array.from(processedRunIds),
            partial: null,
          });
          break;
        } catch (error) {
          const statusCode = this.getHttpStatusCode(error);

          if (statusCode === 404 || statusCode === 502) {
            this.logger.error(
              `Skipping workflow run ${runId} at page ${page}: jobs endpoint returned ${statusCode}. This run will be marked as processed to avoid blocking the pipeline, but its jobs will not be included.`
            );

            processedRunIds.add(runId);
            await this.writeJson(incompletedPath, allJobs);
            await this.writeJson(progressPath, {
              processedRunIds: Array.from(processedRunIds),
              partial: null,
            });
            break;
          }

          await this.writeJson(incompletedPath, allJobs);
          await this.writeJson(progressPath, {
            processedRunIds: Array.from(processedRunIds),
            partial: { runId, page },
          });
          throw error;
        }
      }
    }

    const existingJobs = await this.pipelineJobsJsonRepository.loadAll();
    const mergedJobsByKey = new Map<string, WorkflowJobJsonResponse>();

    for (const job of existingJobs) {
      mergedJobsByKey.set(`${String(job.run_id)}:${String(job.id)}`, job);
    }

    for (const job of allJobs) {
      mergedJobsByKey.set(`${String(job.run_id)}:${String(job.id)}`, job);
    }

    await this.pipelineJobsJsonRepository.saveAll(Array.from(mergedJobsByKey.values()));
    await this.refreshDashboardFilterOptions();

    await this.deleteFile(progressPath);
    await this.deleteFile(incompletedPath);
    return allJobs;
  }

  private async refreshDashboardFilterOptions(): Promise<void> {
    await this.pipelineFiltersRepository?.refreshOptions();
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

  private getHttpStatusCode(error: unknown): number | undefined {
    const err = error as { status?: number; response?: { status?: number } } | undefined;
    return err?.status ?? err?.response?.status;
  }

  private toDateBoundary(
    dateValue?: string,
    boundary: 'start' | 'end' = 'start'
  ): Date | undefined {
    if (!dateValue) {
      return undefined;
    }

    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateValue);
    if (isDateOnly) {
      const d =
        boundary === 'start'
          ? this.tz.getStartOfDayBoundary(dateValue)
          : this.tz.getEndOfDayBoundary(dateValue);
      return d;
    }

    const parsed = new Date(dateValue);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
}
