import { shouldIncludeTimestampForWeekendsMode } from '../../domain/metric-samples';
import type {
  IReadPullRequestsRepository,
  PipelineJob,
  PipelineRun,
  PRDetails,
  PRFilters,
} from '../../index';
import type { IRepository } from '../../index';
import {
  PipelinesRepository,
  LoadPipelinesOptions,
} from 'src/domain/pipelines/repositories/pipeline-repository';

/**
 * Builder for creating an in-memory IReadPullRequestsRepository.
 * Returns a real implementation — no vi.fn() mocks.
 *
 * Usage:
 *   const repo = new ReadPullRequestsRepositoryBuilder()
 *     .withPullRequests([prDetails1, prDetails2])
 *     .build();
 *
 *   const service = new PRsService(repo);
 *
 * If the test needs to spy on method calls, wrap with vi.fn() in the test:
 *   const repo = new ReadPullRequestsRepositoryBuilder()
 *     .withPullRequests([prDetails1, prDetails2])
 *     .build();
 *   vi.spyOn(repo, 'loadPrsWithFilters');
 */
export class ReadPullRequestsRepositoryBuilder {
  private prs: PRDetails[] = [];

  withPullRequests(prs: PRDetails[]): this {
    this.prs = prs;
    return this;
  }

  build(): IReadPullRequestsRepository {
    return {
      loadPrsWithFilters: async (filters?: PRFilters) => {
        return this.prs.filter((pr) =>
          shouldIncludeTimestampForWeekendsMode(
            pr.mergedAt || pr.closedAt || pr.createdAt,
            filters?.cleaning?.weekends,
            (dateString) => this.isWeekday(dateString)
          )
        );
      },
    };
  }

  private isWeekday(dateString?: string): boolean {
    if (!dateString) {
      return true;
    }

    const day = new Date(dateString).getUTCDay();
    return day >= 1 && day <= 5;
  }
}

/**
 * Builder for creating an in-memory PipelinesRepository.
 * Returns a real implementation — no vi.fn() mocks.
 *
 * Usage:
 *   const repo = new PipelinesRepositoryBuilder()
 *     .withPipelineRuns([run1, run2])
 *     .build();
 *
 *   const service = new PipelinesService(repo);
 */
export class PipelinesRepositoryBuilder {
  private runs: PipelineRun[] = [];

  withPipelineRuns(runs: PipelineRun[]): this {
    this.runs = runs;
    return this;
  }

  build(): PipelinesRepository {
    return {
      loadPipelines: async (options?: LoadPipelinesOptions) => this.loadPipelines(options),
      loadPipelineJobs: function (): Promise<PipelineJob[]> {
        throw new Error('Function not implemented.');
      },
    };
  }

  private loadPipelines(options: LoadPipelinesOptions = { includeJobs: true }): PipelineRun[] {
    const selectedJobNames = this.parseCsvList(options.jobName)
      .concat(options.jobNames || [])
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean);
    const selectedBranches = this.parseCsvList(options.targetBranch);
    const selectedStatuses = this.parseCsvList(options.status).map((status) =>
      status.toLowerCase()
    );
    const selectedConclusions = this.parseCsvList(options.conclusion).map((conclusion) =>
      conclusion.toLowerCase()
    );
    const selectedEvents = this.parseCsvList(options.event);
    const targetJobConclusion = options.jobConclusion?.trim().toLowerCase();
    const start = options.startDate ? this.toDateBoundaryTimestamp(options.startDate, 'start') : 0;
    const end = options.endDate ? this.toDateBoundaryTimestamp(options.endDate, 'end') : 0;

    let runs = this.runs.filter((run) => {
      if (start || end) {
        const runTimestamp = this.toTimestamp(run.completedAt || run.createdAt);
        if (start && runTimestamp < start) return false;
        if (end && runTimestamp > end) return false;
      }
      if (
        !shouldIncludeTimestampForWeekendsMode(
          run.completedAt || run.createdAt,
          options.weekends,
          (dateString) => this.isWeekday(dateString)
        )
      ) {
        return false;
      }
      if (options.workflowPath && run.path !== options.workflowPath) return false;
      if (selectedBranches.length > 0 && !selectedBranches.includes(run.branch || '')) return false;
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
      if (
        selectedEvents.length > 0 &&
        !selectedEvents.includes((run as { event?: string }).event || '')
      ) {
        return false;
      }

      return true;
    });

    if (selectedJobNames.length > 0 || targetJobConclusion) {
      runs = runs
        .map((run) => ({
          ...run,
          jobs: (run.jobs || [])
            .filter(
              (job) =>
                selectedJobNames.length === 0 ||
                selectedJobNames.includes((job.name || '').toLowerCase())
            )
            .filter((job) => {
              if (!targetJobConclusion) return true;
              return (job.conclusion || '').toLowerCase() === targetJobConclusion;
            }),
        }))
        .filter((run) => (run.jobs || []).length > 0);
    } else {
      runs = runs.map((run) => ({ ...run, jobs: run.jobs ? [...run.jobs] : undefined }));
    }

    if (options.includeJobs === false) {
      return runs.map(({ jobs: _jobs, ...run }) => run);
    }

    return runs;
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

  private toTimestamp(value?: string): number {
    if (!value) {
      return 0;
    }

    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toDateBoundaryTimestamp(value: string, boundary: 'start' | 'end'): number {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return boundary === 'end'
        ? new Date(`${value}T23:59:59.999Z`).getTime()
        : new Date(`${value}T00:00:00.000Z`).getTime();
    }

    const isoWeekMatch = value.match(/^(\d{4})-W(\d{2})$/);
    if (isoWeekMatch) {
      const year = Number(isoWeekMatch[1]);
      const week = Number(isoWeekMatch[2]);
      const weekBoundary = this.getIsoWeekBoundaryTimestamp(year, week, boundary);
      if (weekBoundary !== undefined) {
        return weekBoundary;
      }
    }

    return this.toTimestamp(value);
  }

  private getIsoWeekBoundaryTimestamp(
    year: number,
    week: number,
    boundary: 'start' | 'end'
  ): number | undefined {
    const weekStart = this.getIsoWeekStartDate(year, week);
    if (!weekStart) {
      return undefined;
    }

    const boundaryDate = new Date(weekStart);
    if (boundary === 'end') {
      boundaryDate.setUTCDate(boundaryDate.getUTCDate() + 6);
      boundaryDate.setUTCHours(23, 59, 59, 999);
    } else {
      boundaryDate.setUTCHours(0, 0, 0, 0);
    }

    return boundaryDate.getTime();
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

  private isWeekday(dateString?: string): boolean {
    if (!dateString) {
      return true;
    }

    const day = new Date(dateString).getUTCDay();
    return day >= 1 && day <= 5;
  }
}

/**
 * Builder for creating an in-memory IRepository<T>.
 * Returns a real implementation — no vi.fn() mocks.
 *
 * Usage:
 *   const repo = new RepositoryBuilder<Commit>()
 *     .withLoadAll([commit1, commit2])
 *     .build();
 *
 *   const service = new PairingIndexService(repo);
 */
export class RepositoryBuilder<T> {
  private items: T[] = [];
  private singleItem: T | null = null;
  private existsResult: boolean = false;

  withLoadAll(items: T[]): this {
    this.items = items;
    return this;
  }

  withLoad(item: T | null): this {
    this.singleItem = item;
    return this;
  }

  withExists(exists: boolean): this {
    this.existsResult = exists;
    return this;
  }

  build(): IRepository<T> {
    return {
      save: async (_item: T) => {},
      saveAll: async (_items: T[]) => {},
      load: async () => this.singleItem,
      loadAll: async () => [...this.items],
      delete: async () => {},
      exists: async () => this.existsResult,
    };
  }
}
