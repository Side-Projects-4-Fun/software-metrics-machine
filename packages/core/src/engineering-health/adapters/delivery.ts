import { parseMetricCleaningOptions } from '../../domain/metric-samples';
import type { PipelineFilters } from '../../domain/pipelines';
import { BaseMetric } from '../metric';
import type { EngineeringHealthDependencies } from '../dependencies';
import type { MetricCalculationInput, MetricTarget, MetricValue } from '../types';

function toPipelineFilters(input?: MetricCalculationInput): PipelineFilters {
  return {
    startDate: input?.startDate,
    endDate: input?.endDate,
    rawFilters: input?.rawFilters,
    cleaning: parseMetricCleaningOptions({
      weekends: input?.weekends,
      outlierMode: input?.outlierMode,
    }),
  };
}

export class DeploymentFrequencyMetric extends BaseMetric {
  readonly id = 'deployment-frequency' as const;
  readonly category = 'delivery' as const;

  constructor(private readonly dependencies: EngineeringHealthDependencies) {
    super();
  }

  async calculate(input?: MetricCalculationInput): Promise<MetricValue> {
    const period = input?.period || 'week';
    const rows =
      await this.dependencies.deploymentFrequencyService.getDeploymentFrequencyWithAllIntervals(
        toPipelineFilters(input)
      );

    const groupedByTarget = new Map<string, number>();

    for (const row of rows) {
      const keyPeriod = period === 'day' ? row.days : period === 'month' ? row.months : row.weeks;
      const keyCount =
        period === 'day'
          ? row.daily_counts
          : period === 'month'
            ? row.monthly_counts
            : row.weekly_counts;

      const targetKey = `${row.pipeline}||${row.job}||${keyPeriod}`;
      const existing = groupedByTarget.get(targetKey) || 0;
      groupedByTarget.set(targetKey, Math.max(existing, keyCount));
    }

    const seriesMap = new Map<string, number>();
    for (const [key, count] of groupedByTarget.entries()) {
      const periodKey = key.split('||')[2];
      seriesMap.set(periodKey, (seriesMap.get(periodKey) || 0) + count);
    }

    const series = Array.from(seriesMap.entries())
      .map(([periodKey, count]) => ({ period: periodKey, value: count }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return {
      value: series.length > 0 ? series[series.length - 1].value : 0,
      unit: `deployments/${period}`,
      direction: 'higher_is_better',
      sampleSize: series.length,
      series,
    };
  }

  target(): MetricTarget {
    return {
      operator: 'gte',
      value: 1,
      description: 'At least one successful deployment per selected period.',
    };
  }
}

export class LeadTimeMetric extends BaseMetric {
  readonly id = 'lead-time' as const;
  readonly category = 'delivery' as const;

  constructor(private readonly dependencies: EngineeringHealthDependencies) {
    super();
  }

  async calculate(input?: MetricCalculationInput): Promise<MetricValue> {
    const dashboard = await this.dependencies.pipelineImplementation.dashboard(
      toPipelineFilters(input)
    );

    return {
      value: dashboard.summary.average_duration_minutes,
      unit: 'minutes',
      direction: 'lower_is_better',
      details: {
        totalRuns: dashboard.summary.total_runs,
      },
    };
  }

  target(): MetricTarget {
    return {
      operator: 'lt',
      value: 1440,
      description: 'Lead time below one day.',
    };
  }
}

export class PipelineDurationMetric extends BaseMetric {
  readonly id = 'pipeline-duration' as const;
  readonly category = 'delivery' as const;

  constructor(private readonly dependencies: EngineeringHealthDependencies) {
    super();
  }

  async calculate(input?: MetricCalculationInput): Promise<MetricValue> {
    const metrics = await this.dependencies.pipelinesService.getMetrics(toPipelineFilters(input));

    return {
      value: metrics.averageDurationMinutes,
      unit: 'minutes',
      direction: 'lower_is_better',
      sampleSize: metrics.totalRuns,
      details: {
        outliers: metrics.outliers?.length || 0,
      },
    };
  }

  target(): MetricTarget {
    return {
      operator: 'lt',
      value: 10,
      description: 'Average pipeline duration below ten minutes.',
    };
  }
}

export class FailureRateMetric extends BaseMetric {
  readonly id = 'failure-rate' as const;
  readonly category = 'delivery' as const;

  constructor(private readonly dependencies: EngineeringHealthDependencies) {
    super();
  }

  async calculate(input?: MetricCalculationInput): Promise<MetricValue> {
    const metrics = await this.dependencies.pipelinesService.getMetrics(toPipelineFilters(input));
    const failureRate = metrics.totalRuns > 0 ? (metrics.failedRuns / metrics.totalRuns) * 100 : 0;

    return {
      value: Number(failureRate.toFixed(2)),
      unit: '%',
      direction: 'lower_is_better',
      sampleSize: metrics.totalRuns,
      details: {
        failedRuns: metrics.failedRuns,
        successfulRuns: metrics.successfulRuns,
      },
    };
  }

  target(): MetricTarget {
    return {
      operator: 'lt',
      value: 15,
      description: 'Change failure rate below 15 percent.',
    };
  }
}
