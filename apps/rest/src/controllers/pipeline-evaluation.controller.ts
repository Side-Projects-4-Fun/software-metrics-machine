import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { PipelineEvaluation, PipelineFilters } from '@smmachine/core';
import {
  PipelineImplementation,
  PipelineEvaluationService,
  parseMetricCleaningOptions,
} from '@smmachine/core';
import { normalizeMetricMethod } from '../utils/metric-method';

@ApiTags('Pipeline Evaluation')
@Controller()
export class PipelineEvaluationController {
  private readonly evaluationService = new PipelineEvaluationService();

  constructor(private readonly pipelineImpl: PipelineImplementation) {}

  @Get('/pipelines/evaluate')
  async evaluate(
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
  ): Promise<PipelineEvaluation> {
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
    return this.evaluationService.evaluate(dashboard);
  }
}
