import { parseMetricCleaningOptions } from '../../domain/metric-samples';
import type { DeploymentFrequencyTarget, PipelineFilters } from '../../domain/pipelines';
import { BaseMetric } from '../metric';
import type { EngineeringHealthDependencies } from '../dependencies';
import type {
  EngineeringHealthEvaluationInput,
  MetricCalculationInput,
  MetricScope,
  MetricTarget,
  MetricValue,
} from '../types';

function toPipelineFilters(input?: MetricCalculationInput): PipelineFilters {
  return {
    startDate: input?.startDate,
    endDate: input?.endDate,
    workflowPath: input?.workflowPath,
    jobName: input?.jobName,
    rawFilters: input?.rawFilters,
    cleaning: parseMetricCleaningOptions({
      weekends: input?.weekends,
      outlierMode: input?.outlierMode,
    }),
  };
}

function createTargetScope(target: DeploymentFrequencyTarget): MetricScope {
  return {
    type: 'deployment-target',
    key: `${target.pipeline}||${target.job}`,
    label: `${target.job} (${target.pipeline})`,
    deploymentTarget: target,
  };
}

function withDeploymentTarget(
  input: MetricCalculationInput | undefined,
  target: DeploymentFrequencyTarget
): MetricCalculationInput {
  return {
    ...input,
    workflowPath: target.pipeline,
    jobName: target.job,
  };
}

abstract class TargetScopedDeliveryMetric extends BaseMetric {
  constructor(protected readonly dependencies: EngineeringHealthDependencies) {
    super();
  }

  async evaluate(input: EngineeringHealthEvaluationInput) {
    if (this.dependencies.deploymentTargets.length === 0) {
      return [];
    }

    return Promise.all(
      this.dependencies.deploymentTargets.map((target) => {
        const scope = createTargetScope(target);

        return this.evaluateForScope(
          withDeploymentTarget(input.current, target),
          input.previous ? withDeploymentTarget(input.previous, target) : undefined,
          scope
        );
      })
    );
  }
}

export class DeploymentFrequencyMetric extends TargetScopedDeliveryMetric {
  readonly id = 'deployment-frequency' as const;
  readonly category = 'delivery' as const;

  async calculate(input?: MetricCalculationInput): Promise<MetricValue> {
    const period = input?.period || 'week';
    const rows =
      await this.dependencies.deploymentFrequencyService.getDeploymentFrequencyWithAllIntervals(
        toPipelineFilters(input)
      );

    const groupedByPeriod = new Map<string, number>();

    for (const row of rows) {
      const keyPeriod = period === 'day' ? row.days : period === 'month' ? row.months : row.weeks;
      const keyCount =
        period === 'day'
          ? row.daily_counts
          : period === 'month'
            ? row.monthly_counts
            : row.weekly_counts;

      const existing = groupedByPeriod.get(keyPeriod) || 0;
      groupedByPeriod.set(keyPeriod, Math.max(existing, keyCount));
    }

    const series = Array.from(groupedByPeriod.entries())
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

export class LeadTimeMetric extends TargetScopedDeliveryMetric {
  readonly id = 'lead-time' as const;
  readonly category = 'delivery' as const;

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

export class PipelineDurationMetric extends TargetScopedDeliveryMetric {
  readonly id = 'pipeline-duration' as const;
  readonly category = 'delivery' as const;

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

export class FailureRateMetric extends TargetScopedDeliveryMetric {
  readonly id = 'failure-rate' as const;
  readonly category = 'delivery' as const;

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
