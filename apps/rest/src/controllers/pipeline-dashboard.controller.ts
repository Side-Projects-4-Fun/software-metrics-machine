import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  PipelineImplementation,
  PipelineFilters,
  parseMetricCleaningOptions,
} from '@smmachine/core';
import { PipelineDashboardResponse } from '../dtos';
import { normalizeMetricMethod } from '../utils/metric-method';
import { formatDuration } from '@smmachine/utils';

@ApiTags('Pipeline Dashboard')
@Controller()
export class PipelineDashboardController {
  constructor(private readonly pipelineImpl: PipelineImplementation) {}

  @Get('/pipelines/dashboard')
  async dashboard(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('workflow_path') workflowPath?: string,
    @Query('status') status?: string,
    @Query('conclusion') conclusion?: string,
    @Query('branch') branch?: string,
    @Query('job_name') jobName?: string,
    @Query('job_conclusion') jobConclusion?: string,
    @Query('event') event?: string,
    @Query('weekends') weekends?: string,
    @Query('outlier_mode') outlierMode?: string,
    @Query('method') methodRaw?: string
  ): Promise<PipelineDashboardResponse> {
    const filters: PipelineFilters = {
      startDate,
      endDate,
      workflowPath,
      status,
      conclusion,
      targetBranch: branch,
      jobName,
      jobConclusion,
      event,
      cleaning: parseMetricCleaningOptions({ weekends, outlierMode }),
      method: normalizeMetricMethod(methodRaw),
    };

    const dashboard = await this.pipelineImpl.dashboard(filters);

    return {
      ...dashboard,
      summary: {
        ...dashboard.summary,
        value_formatted: formatDuration(dashboard.summary.value, 'minutes'),
      },
      runs_duration: dashboard.runs_duration.map((run) => ({
        workflow: run.workflow,
        value: run.value,
        value_formatted: formatDuration(run.value, 'minutes'),
        method: run.method,
        min_duration: run.min_duration,
        min_duration_formatted: formatDuration(run.min_duration, 'minutes'),
        max_duration: run.max_duration,
        max_duration_formatted: formatDuration(run.max_duration, 'minutes'),
        total_runs: run.total_runs,
        outliers: run.outliers,
      })),
      jobs_average_time: dashboard.jobs_average_time.map((job) => ({
        ...job,
        value_formatted: formatDuration(job.value, 'minutes'),
      })),
      jobs_summary: dashboard.jobs_summary.map((job) => ({
        ...job,
        value_formatted: formatDuration(job.value, 'minutes'),
      })),
      job_steps_average_time: dashboard.job_steps_average_time.map((step) => ({
        ...step,
        value_formatted: formatDuration(step.value, 'minutes'),
      })),
      job_steps_average_time_total_minutes: dashboard.job_steps_average_time.reduce(
        (sum, step) => sum + step.value,
        0
      ),
      job_steps_average_time_total_minutes_formatted: formatDuration(
        dashboard.job_steps_average_time.reduce((sum, step) => sum + step.value, 0),
        'minutes'
      ),
      jobs_average_time_by_day: dashboard.jobs_average_time_by_day.map((row) => ({
        ...row,
        value_formatted: formatDuration(row.value, 'minutes'),
      })),
      job_steps_average_time_by_day: dashboard.job_steps_average_time_by_day.map((row) => ({
        ...row,
        steps: row.steps.map((step) => ({
          ...step,
          value_formatted: formatDuration(step.value, 'minutes'),
        })),
      })),
      jobs_duration_by_workflow: dashboard.jobs_duration_by_workflow.map((row) => {
        const jobs_formatted: Record<string, string> = {};
        for (const [name, avgDuration] of Object.entries(row.jobs)) {
          jobs_formatted[name] = formatDuration(avgDuration, 'minutes');
        }
        return { ...row, jobs_formatted };
      }),
    };
  }
}
