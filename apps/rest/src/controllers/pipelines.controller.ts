import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  averageMetricSamples,
  cleanMetricSamples,
  parseMetricCleaningOptions,
  PipelinesRepository,
  PipelinesService,
  PipelineFiltersRepository,
  type MetricSample,
} from '@smmachine/core';
import type { DeploymentFrequencyRow } from '../dtos/response.dto';
import type {
  PipelineSummaryResponse,
  PipelineByStatusResponse,
  PipelineJobsByStatusResponse,
  PipelineJobsSummaryResponse,
  PipelineRunsDurationResponse,
  PipelineJobsDurationByWorkflowResponse,
  PipelineRunsByResponse,
  PipelineJobsRerunsResponse,
  PipelineStepsAverageTimeResponse,
  PipelineStepsAverageTimeByDayResponse,
  PipelineJobsAverageTimeResponse,
  PipelineJobsAverageTimeByDayResponse,
  PipelineWorkflowsResponse,
  PipelineStatusesResponse,
  PipelineConclusionsResponse,
  PipelineBranchesResponse,
  PipelineEventsResponse,
  PipelineJobsResponse,
  PipelineFilterOptionsResponse,
} from '../dtos/response.dto';

type PipelineDurationsMetrics = {
  durations: number[];
  workflowName?: string;
};

interface PipelineFiltersQuery {
  start_date?: string;
  end_date?: string;
  workflow_path?: string;
  status?: string;
  conclusion?: string;
  branch?: string;
  job_name?: string;
  job_conclusion?: string;
  event?: string;
  weekends?: string;
  outlier_mode?: string;
}

interface RunLike {
  path?: string;
  createdAt?: string;
  completedAt?: string;
  startedAt?: string;
  status?: string;
  conclusion?: string;
  branch?: string;
  event?: string;
  jobs?: Array<{
    name?: string;
    workflow_name?: string;
    status?: string;
    conclusion?: string;
    startedAt?: string;
    completedAt?: string;
  }>;
}

type LoadRunsOptions = {
  sort_by?: {
    created_at?: 'asc' | 'desc';
  };
};

type PipelineOutlierItem = {
  runId: string;
  workflowName?: string;
  jobName?: string;
};

/**
 * Pipeline Metrics REST Controller
 * Provides endpoints for CI/CD pipeline metrics and analysis
 */
@ApiTags('Pipeline Metrics')
@Controller()
export class PipelinesController {
  constructor(
    @Inject('PipelinesRepository')
    private readonly pipelinesRepo: PipelinesRepository,
    private readonly pipelinesService: PipelinesService,
    @Inject('PipelineFiltersRepository')
    private readonly pipelineFiltersRepository: PipelineFiltersRepository
  ) {}

  @Get('/pipelines/summary')
  async pipelineSummary(@Query() query: PipelineFiltersQuery): Promise<PipelineSummaryResponse> {
    const runs = await this.loadRunsWithFilters(
      { ...query, includeJobs: false },
      { sort_by: { created_at: 'asc' } }
    );

    return {
      total_runs: runs.length,
      first_run: runs.length > 0 ? runs[0] : null,
      last_run: runs.length > 0 ? runs[runs.length - 1] : null,
      in_progress: runs.filter((run) => (run.status || '').toLowerCase() === 'in_progress').length,
      queued: runs.filter((run) => (run.status || '').toLowerCase() === 'queued').length,
    };
  }

  @Get('/pipelines/by-status')
  async byStatus(@Query() query: PipelineFiltersQuery): Promise<PipelineByStatusResponse> {
    const runs = await this.loadRunsWithFilters({ ...query, includeJobs: false });

    const grouped = new Map<string, number>();
    for (const run of runs) {
      const key = run.status || 'unknown';
      grouped.set(key, (grouped.get(key) || 0) + 1);
    }

    return Array.from(grouped.entries())
      .map(([state, count]) => ({ status: state, count }))
      .sort((a, b) => b.count - a.count);
  }

  @Get('/pipelines/jobs-by-status')
  async jobsByStatus(@Query() query: PipelineFiltersQuery): Promise<PipelineJobsByStatusResponse> {
    const runs = await this.loadRunsWithFilters({ ...query, includeJobs: true });

    const grouped = new Map<string, number>();

    for (const run of runs) {
      const jobs = run.jobs || [];
      for (const job of jobs) {
        const key = job.conclusion || job.status || 'unknown';
        grouped.set(key, (grouped.get(key) || 0) + 1);
      }
    }

    return Array.from(grouped.entries())
      .map(([state, count]) => ({ Status: state, Count: count }))
      .sort((a, b) => b.Count - a.Count);
  }

  @Get('/pipelines/jobs-summary')
  async jobsSummary(@Query() query: PipelineFiltersQuery): Promise<PipelineJobsSummaryResponse> {
    const metrics = await this.pipelinesService.getJobMetrics(this.toServiceFilters(query));

    return {
      result: metrics.map((item) => ({
        workflow_name: item.workflowName,
        job_name: item.jobName,
        total_runs: item.totalRuns,
        avg_duration_minutes: item.averageDurationMinutes,
        success_count: item.successCount,
        failure_count: item.failureCount,
        success_rate: item.successRate,
        failure_rate: item.failureRate,
        rerun_count: item.rerunCount,
        outliers: item.outliers,
      })),
    };
  }

  @Get('/pipelines/jobs-reruns-by-day')
  async jobsRerunsByDay(@Query() query: PipelineFiltersQuery): Promise<PipelineJobsRerunsResponse> {
    const metrics = await this.pipelinesService.getJobRerunsByDay(this.toServiceFilters(query));

    return { result: metrics };
  }

  @Get('/pipelines/runs-duration')
  async runsDuration(
    @Query('aggregation') aggregation?: string,
    @Query() query?: PipelineFiltersQuery
  ): Promise<PipelineRunsDurationResponse> {
    const runs = await this.loadRunsWithFilters({ ...(query || {}), includeJobs: true });

    const grouped = new Map<string, Array<MetricSample<PipelineOutlierItem>>>();

    for (const run of runs) {
      const duration = this.pipelinesService.getRunDurationMinutes(run);
      if (duration === null) {
        continue;
      }
      const workflow = run.path || 'unknown';
      const existing = grouped.get(workflow) || [];
      existing.push({
        value: duration,
        timestamp: this.pipelinesService.getRunMetricDate(run) || run.createdAt || '',
        item: { runId: String((run as { id?: string }).id || ''), workflowName: workflow },
      });
      grouped.set(workflow, existing);
    }

    const normalizedAggregation = (aggregation || '').toLowerCase();
    const cleaning = parseMetricCleaningOptions({
      weekends: query?.weekends,
      outlierMode: query?.outlier_mode,
    });

    return Array.from(grouped.entries())
      .map(([workflow, samples]) => {
        const cleaned = cleanMetricSamples(samples, cleaning);
        const durations = cleaned.samples.map((sample) => sample.value);
        const n = cleaned.samples.length;
        const avgDuration = averageMetricSamples(cleaned.samples);
        const minDuration = n > 0 ? Math.min(...durations) : 0;
        const maxDuration = n > 0 ? Math.max(...durations) : 0;
        const outliers =
          cleaning.outlierMode === 'flag' || cleaning.outlierMode === 'exclude'
            ? cleaned.outliers
            : undefined;

        if (
          normalizedAggregation === 'avg' ||
          normalizedAggregation === 'min' ||
          normalizedAggregation === 'max'
        ) {
          return {
            workflow,
            aggregation: normalizedAggregation,
            duration:
              normalizedAggregation === 'avg'
                ? avgDuration
                : normalizedAggregation === 'min'
                  ? minDuration
                  : maxDuration,
            total_runs: n,
            outliers,
          };
        }

        return {
          workflow,
          avg_duration: avgDuration,
          min_duration: minDuration,
          max_duration: maxDuration,
          total_runs: n,
          outliers,
        };
      })
      .sort((a, b) => b.total_runs - a.total_runs);
  }

  @Get('/pipelines/jobs-duration-by-workflow')
  async jobsDurationByWorkflow(
    @Query() query: PipelineFiltersQuery
  ): Promise<PipelineJobsDurationByWorkflowResponse> {
    const runs = await this.loadRunsWithFilters({ ...query, includeJobs: true });

    // Map: workflow -> job name -> list of durations
    const grouped = new Map<string, Map<string, number[]>>();

    for (const run of runs) {
      const workflow = run.path || 'unknown';
      const jobs = run.jobs || [];
      for (const job of jobs) {
        const name = (job.name || '').trim();
        if (!name) continue;
        const duration = this.pipelinesService.getDurationMinutes(job.startedAt, job.completedAt);
        if (duration === null) continue;
        if (!grouped.has(workflow)) grouped.set(workflow, new Map());
        const jobMap = grouped.get(workflow)!;
        const existing = jobMap.get(name) || [];
        existing.push(duration);
        jobMap.set(name, existing);
      }
    }

    // Return one row per workflow with each job's avg duration as a key
    return Array.from(grouped.entries())
      .map(([workflow, jobMap]) => {
        const jobs: Record<string, number> = {};
        for (const [name, durations] of jobMap.entries()) {
          jobs[name] = durations.reduce((a, b) => a + b, 0) / durations.length;
        }
        return { workflow, jobs };
      })
      .sort((a, b) => a.workflow.localeCompare(b.workflow));
  }

  @Get('/pipelines/deployment-frequency')
  async deploymentFrequency(
    @Query() query: PipelineFiltersQuery
  ): Promise<DeploymentFrequencyRow[]> {
    return this.pipelinesService.getDeploymentFrequencyWithAllIntervals(
      this.toServiceFilters(query)
    );
  }

  @Get('/pipelines/runs-by')
  async runsBy(
    @Query('aggregate_by') aggregateBy?: string,
    @Query() query?: PipelineFiltersQuery
  ): Promise<PipelineRunsByResponse> {
    const runs = await this.loadRunsWithFilters({ ...(query || {}), includeJobs: false });

    const mode = (aggregateBy || 'week').toLowerCase();
    const grouped = new Map<string, number>();

    for (const run of runs) {
      const keyDate = this.pipelinesService.getRunMetricDate(run);
      if (!keyDate) {
        continue;
      }
      const period = this.pipelinesService.getPeriodKey(
        keyDate,
        mode === 'day' || mode === 'month' ? mode : 'week'
      );
      const workflow = run.path || 'unknown';
      const key = `${period}||${workflow}`;
      grouped.set(key, (grouped.get(key) || 0) + 1);
    }

    return Array.from(grouped.entries())
      .map(([key, count]) => {
        const [period, workflow] = key.split('||');
        return { period, workflow, runs: count };
      })
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  @Get('/pipelines/jobs-steps-average-time')
  async jobsStepsAverageTime(
    @Query() query?: PipelineFiltersQuery
  ): Promise<PipelineStepsAverageTimeResponse> {
    const result = await this.pipelinesService.getJobStepsAverageTime(
      this.toServiceFilters(query || {})
    );
    return { result };
  }

  @Get('/pipelines/jobs-steps-average-time-by-day')
  async jobsStepsAverageTimeByDay(
    @Query() query?: PipelineFiltersQuery
  ): Promise<PipelineStepsAverageTimeByDayResponse> {
    const result = await this.pipelinesService.getJobStepsAverageTimeByDay(
      this.toServiceFilters(query || {})
    );
    return { result };
  }

  @Get('/pipelines/jobs-average-time')
  async jobsAverageTime(
    @Query('exclude_jobs') excludeJobs?: string,
    @Query('top') top?: string,
    @Query() query?: PipelineFiltersQuery
  ): Promise<PipelineJobsAverageTimeResponse> {
    const runs = await this.loadRunsWithFilters({
      ...(query || {}),
      exclude_job_name: excludeJobs,
      includeJobs: true,
    });

    const grouped = new Map<
      string,
      PipelineDurationsMetrics & { samples: Array<MetricSample<PipelineOutlierItem>> }
    >();

    for (const run of runs) {
      const jobs = run.jobs || [];
      for (const job of jobs) {
        const name = (job.name || '').trim();
        if (!name) {
          continue;
        }
        const duration = this.pipelinesService.getDurationMinutes(job.startedAt, job.completedAt);
        if (duration === null) {
          continue;
        }

        const existing = grouped.get(name) || {
          durations: [],
          samples: [],
          workflowName: job.workflow_name,
        };
        existing.durations.push(duration);
        existing.samples.push({
          value: duration,
          timestamp:
            job.completedAt || job.startedAt || this.pipelinesService.getRunMetricDate(run) || '',
          item: {
            runId: String((run as { id?: string }).id || ''),
            workflowName: run.path,
            jobName: name,
          },
        });
        grouped.set(name, existing);
      }
    }

    const maxRows = top ? Number(top) : 20;
    const cleaning = parseMetricCleaningOptions({
      weekends: query?.weekends,
      outlierMode: query?.outlier_mode,
    });
    const result = Array.from(grouped.entries())
      .map(([jobNameValue, data]) => {
        const cleaned = cleanMetricSamples(data.samples, cleaning);
        return {
          job_name: jobNameValue,
          workflow_name: data.workflowName,
          avg_time: averageMetricSamples(cleaned.samples),
          count: cleaned.samples.length,
          outliers:
            cleaning.outlierMode === 'flag' || cleaning.outlierMode === 'exclude'
              ? cleaned.outliers
              : undefined,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, Number.isFinite(maxRows) ? maxRows : 20);

    return { result };
  }

  @Get('/pipelines/jobs-average-time-by-day')
  async jobsAverageTimeByDay(
    @Query('exclude_jobs') excludeJobs?: string,
    @Query() query?: PipelineFiltersQuery
  ): Promise<PipelineJobsAverageTimeByDayResponse> {
    const runs = await this.loadRunsWithFilters({
      ...(query || {}),
      exclude_job_name: excludeJobs,
      includeJobs: true,
    });

    const grouped = new Map<string, Array<MetricSample<PipelineOutlierItem>>>();

    for (const run of runs) {
      const jobs = run.jobs || [];
      const runDate = this.pipelinesService.getRunMetricDate(run);
      if (!runDate) {
        continue;
      }
      const day = this.pipelinesService.getPeriodKey(runDate, 'day');

      for (const job of jobs) {
        const name = (job.name || '').trim();
        if (!name) {
          continue;
        }
        const duration = this.pipelinesService.getDurationMinutes(job.startedAt, job.completedAt);
        if (duration === null) {
          continue;
        }

        if (!grouped.has(day)) {
          grouped.set(day, []);
        }
        grouped.get(day)!.push({
          value: duration,
          timestamp: job.completedAt || job.startedAt || runDate,
          item: {
            runId: String((run as { id?: string }).id || ''),
            workflowName: run.path,
            jobName: name,
          },
        });
      }
    }

    const cleaning = parseMetricCleaningOptions({
      weekends: query?.weekends,
      outlierMode: query?.outlier_mode,
    });
    const result = Array.from(grouped.entries())
      .map(([day, samples]) => {
        const cleaned = cleanMetricSamples(samples, cleaning);
        return {
          day,
          avg_time: averageMetricSamples(cleaned.samples),
          count: cleaned.samples.length,
          outliers:
            cleaning.outlierMode === 'flag' || cleaning.outlierMode === 'exclude'
              ? cleaned.outliers
              : undefined,
        };
      })
      .sort((a, b) => a.day.localeCompare(b.day));

    return { result };
  }

  @Get('/pipelines/workflows')
  async workflows(): Promise<PipelineWorkflowsResponse> {
    return (await this.pipelineFiltersRepository.loadOptions()).workflows;
  }

  @Get('/pipelines/statuses')
  async statuses(): Promise<PipelineStatusesResponse> {
    return (await this.pipelineFiltersRepository.loadOptions()).statuses;
  }

  @Get('/pipelines/conclusions')
  async conclusions(): Promise<PipelineConclusionsResponse> {
    return (await this.pipelineFiltersRepository.loadOptions()).conclusions;
  }

  @Get('/pipelines/branches')
  async branches(): Promise<PipelineBranchesResponse> {
    return (await this.pipelineFiltersRepository.loadOptions()).branches;
  }

  @Get('/pipelines/events')
  async events(): Promise<PipelineEventsResponse> {
    return (await this.pipelineFiltersRepository.loadOptions()).events;
  }

  @Get('/pipelines/jobs')
  async jobs(@Query() query: PipelineFiltersQuery): Promise<PipelineJobsResponse> {
    return (
      await this.pipelineFiltersRepository.loadOptions({
        workflowPath: query.workflow_path,
      })
    ).jobs;
  }

  @Get('/pipelines/filter-options')
  async filterOptions(
    @Query() query: PipelineFiltersQuery
  ): Promise<PipelineFilterOptionsResponse> {
    return this.pipelineFiltersRepository.loadOptions({
      workflowPath: query.workflow_path,
    });
  }

  // ========== PRIVATE HELPERS ==========

  private toServiceFilters(query: PipelineFiltersQuery): {
    startDate?: string;
    endDate?: string;
    workflowPath?: string;
    status?: string;
    conclusion?: string;
    targetBranch?: string;
    jobName?: string;
    event?: string;
    cleaning?: ReturnType<typeof parseMetricCleaningOptions>;
  } {
    return {
      startDate: query.start_date,
      endDate: query.end_date,
      workflowPath: query.workflow_path,
      status: query.status,
      conclusion: query.conclusion,
      targetBranch: query.branch,
      jobName: query.job_name,
      event: query.event,
      cleaning: parseMetricCleaningOptions({
        weekends: query.weekends,
        outlierMode: query.outlier_mode,
      }),
    };
  }

  private async loadRunsWithFilters(
    filters: {
      start_date?: string;
      end_date?: string;
      weekends?: string;
      workflow_path?: string;
      status?: string;
      conclusion?: string;
      branch?: string;
      job_name?: string;
      exclude_job_name?: string;
      job_conclusion?: string;
      event?: string;
      includeJobs: boolean;
    },
    options?: LoadRunsOptions
  ): Promise<RunLike[]> {
    return this.pipelinesRepo.loadPipelines({
      includeJobs: filters.includeJobs,
      startDate: filters.start_date,
      endDate: filters.end_date,
      weekends:
        filters.weekends === 'exclude' || filters.weekends === 'weekends_only'
          ? filters.weekends
          : 'include',
      workflowPath: filters.workflow_path,
      status: filters.status,
      conclusion: filters.conclusion,
      targetBranch: filters.branch,
      event: filters.event,
      jobName: filters.job_name,
      excludeJobName: filters.exclude_job_name,
      jobConclusion: filters.job_conclusion,
      sort_by: options?.sort_by,
    });
  }
}
