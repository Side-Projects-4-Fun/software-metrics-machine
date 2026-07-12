import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DeploymentFrequencyService, parseMetricCleaningOptions } from '@smmachine/core';
import type { DeploymentFrequencyRow } from '../dtos';

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

@ApiTags('Dora Metrics')
@Controller()
export class DoraController {
  constructor(private readonly deploymentFrequencyService: DeploymentFrequencyService) {}

  @Get('/dora/deployment-frequency')
  async deploymentFrequency(
    @Query() query: PipelineFiltersQuery
  ): Promise<DeploymentFrequencyRow[]> {
    return this.deploymentFrequencyService.getDeploymentFrequencyWithAllIntervals(
      this.toServiceFilters(query)
    );
  }

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
}
