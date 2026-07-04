import { IRepository } from '../../../infrastructure';
import { Logger } from '@smmachine/utils';
import {
  WorkflowJobJsonResponse,
  WorkflowJobStepJsonResponse,
  WorkflowJsonResponse,
} from '../../../providers/github/github-response-types';
import { PipelineJob, PipelineRun, PipelineStep } from '../pipeline-types';
import { shouldIncludeTimestampForWeekendsMode, type WeekendsMode } from '../../metric-samples';
import { TimeZoneProvider } from '../../../infrastructure/timezone-provider';
import { CommonRepository, RawFilter } from '../../../aggregates/common-repository';

export type LoadPipelinesOptions = {
  includeJobs?: boolean;
  startDate?: string;
  endDate?: string;
  weekends?: WeekendsMode;
  workflowPath?: string;
  status?: string;
  conclusion?: string;
  targetBranch?: string;
  event?: string;
  jobName?: string;
  jobNames?: string[];
  excludeJobName?: string | string[];
  jobConclusion?: string;
  rawFilters?: string;
  sort_by?: {
    created_at?: 'asc' | 'desc';
  };
};

export interface IPipelinesRepository {
  loadPipelines(options?: LoadPipelinesOptions): Promise<PipelineRun[]>;
}

export abstract class BasePipelinesRepository extends CommonRepository implements IPipelinesRepository {
  protected tz: TimeZoneProvider;

  constructor(
    protected logger: Logger,
    timeZoneProvider: TimeZoneProvider
  ) {
    super();
    this.tz = timeZoneProvider;
  }

  protected abstract loadPipelineRuns(): Promise<PipelineRun[]>;
  abstract loadPipelineJobs(): Promise<PipelineJob[]>;

  async loadPipelines(
    options: LoadPipelinesOptions = { includeJobs: true }
  ): Promise<PipelineRun[]> {
    const pipelineRuns = this.filterRuns(await this.loadPipelineRuns(), options);
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

    const jobs = await this.loadPipelineJobs();
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

  protected mapPipelinesToDomain(run: WorkflowJsonResponse): PipelineRun {
    return {
      ...run,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      number: Number(run.run_number),
      startedAt: run.run_started_at,
      completedAt: run.updated_at,
      runAttempt: Number(run.run_attempt || 1),
      branch: run.head_branch,
      path: run.path,
    };
  }

  protected mapPipelineJobsToDomain = (job: WorkflowJobJsonResponse): PipelineJob => {
    return {
      completedAt: job.completed_at,
      conclusion: job.conclusion,
      durationSeconds: this.calculateDurationInSeconds(job.started_at, job.completed_at),
      id: job.id,
      name: job.name,
      runId: job.run_id,
      startedAt: job.started_at,
      status: job.status,
      steps: job.steps ? job.steps.map(this.mapPipelineJobsStepToDomain) : [],
    };
  };

  protected mapPipelineJobsStepToDomain = (step: WorkflowJobStepJsonResponse): PipelineStep => {
    return {
      name: step.name,
      status: step.status,
      conclusion: step.conclusion,
      number: step.number,
      startedAt: step.started_at,
      completedAt: step.completed_at,
    };
  };

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

  private calculateDurationInSeconds(startedAt: string, completedAt: string): number {
    if (!startedAt || !completedAt) return 0;
    return (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000;
  }
}

export class PipelinesRepository extends BasePipelinesRepository {
  constructor(
    private pipelineRunJsonRepository: IRepository<WorkflowJsonResponse>,
    private pipelineJobsJsonRepository: IRepository<WorkflowJobJsonResponse>,
    logger: Logger,
    timeZoneProvider: TimeZoneProvider
  ) {
    super(logger, timeZoneProvider);
  }

  protected async loadPipelineRuns(): Promise<PipelineRun[]> {
    const runs = await this.pipelineRunJsonRepository.loadAll();
    const pipelineRuns = runs.map(this.mapPipelinesToDomain);

    this.logger.info(`Loaded ${pipelineRuns.length} pipeline runs from JSON repository`);

    return pipelineRuns;
  }

  async loadPipelineJobs(): Promise<PipelineJob[]> {
    const jobs = await this.pipelineJobsJsonRepository.loadAll();
    return jobs.map(this.mapPipelineJobsToDomain);
  }
}
