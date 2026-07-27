import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { MetricMethod } from '@smmachine/core';
import {
  PipelineImplementation,
  PipelineFilters,
  parseMetricCleaningOptions,
} from '@smmachine/core';
import { PipelineDashboardResponse } from '../dtos';

const VALID_METRIC_METHODS: MetricMethod[] = [
  'average',
  'median',
  'p75',
  'p90',
  'p95',
  'min',
  'max',
];

function normalizeMetricMethod(value?: string): MetricMethod {
  const normalized = (value || 'average').toLowerCase();
  return VALID_METRIC_METHODS.includes(normalized as MetricMethod)
    ? (normalized as MetricMethod)
    : 'average';
}

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

    return this.pipelineImpl.dashboard(filters);
  }
}
