import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  PipelineImplementation,
  PipelineFilters,
  parseMetricCleaningOptions,
} from '@smmachine/core';
import { PipelineDashboardResponse } from '../dtos';

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
    @Query('outlier_mode') outlierMode?: string
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
    };

    return this.pipelineImpl.dashboard(filters);
  }
}
