import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type {
  EngineeringHealthEvaluation,
  EngineeringHealthEvaluationInput,
  EngineeringHealthOrchestrator,
  MetricCategory,
  MetricId,
} from '@smmachine/core';

interface EngineeringHealthQuery {
  metric?: string;
  category?: string;
  start_date?: string;
  end_date?: string;
  compare_start_date?: string;
  compare_end_date?: string;
  raw_filters?: string;
  period?: 'day' | 'week' | 'month';
  weekends?: 'include' | 'exclude' | 'weekends_only';
  outlier_mode?: 'include' | 'flag' | 'exclude';
}

function parseCsv(value?: string): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return parsed.length > 0 ? parsed : undefined;
}

@ApiTags('Engineering Health')
@Controller()
export class EngineeringHealthController {
  constructor(
    @Inject('EngineeringHealthOrchestrator')
    private readonly orchestrator: EngineeringHealthOrchestrator
  ) {}

  @Get('/engineering-health/evaluate')
  async evaluate(@Query() query: EngineeringHealthQuery): Promise<EngineeringHealthEvaluation> {
    const metrics = parseCsv(query.metric) as MetricId[] | undefined;
    const category = query.category as MetricCategory | undefined;

    const input: EngineeringHealthEvaluationInput = {
      metrics,
      category,
      current: {
        startDate: query.start_date,
        endDate: query.end_date,
        rawFilters: query.raw_filters,
        period: query.period,
        weekends: query.weekends,
        outlierMode: query.outlier_mode,
      },
      previous:
        query.compare_start_date || query.compare_end_date
          ? {
              startDate: query.compare_start_date,
              endDate: query.compare_end_date,
              rawFilters: query.raw_filters,
              period: query.period,
              weekends: query.weekends,
              outlierMode: query.outlier_mode,
            }
          : undefined,
    };

    return this.orchestrator.evaluate(input);
  }
}
