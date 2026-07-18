import { BaseMetric } from '../metric';
import type { EngineeringHealthDependencies } from '../dependencies';
import type { MetricCalculationInput, MetricTarget, MetricValue } from '../types';

type SonarMeasure = {
  metric?: string;
  key?: string;
  name?: string;
  value?: string | number;
};

type SonarPayload = {
  measures?: SonarMeasure[];
};

function toNumber(value: string | number | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getMeasureValue(payload: SonarPayload | null, metric: string): number | null {
  const measures = payload?.measures || [];
  const selected = measures.find((measure) => {
    const key = measure.metric || measure.key || measure.name || '';
    return key.toLowerCase() === metric.toLowerCase();
  });

  return toNumber(selected?.value);
}

abstract class SonarMetricBase extends BaseMetric {
  protected constructor(private readonly dependencies: EngineeringHealthDependencies) {
    super();
  }

  protected async loadMeasures(_input?: MetricCalculationInput): Promise<SonarPayload | null> {
    const payload = await this.dependencies.sonarQubeService.getQualityMetrics();
    return (payload as SonarPayload | null) || null;
  }
}

export class ComplexityMetric extends SonarMetricBase {
  readonly id = 'complexity' as const;
  readonly category = 'quality' as const;

  constructor(dependencies: EngineeringHealthDependencies) {
    super(dependencies);
  }

  async calculate(input?: MetricCalculationInput): Promise<MetricValue> {
    const payload = await this.loadMeasures(input);

    return {
      value: getMeasureValue(payload, 'complexity'),
      unit: 'score',
      direction: 'lower_is_better',
    };
  }

  target(): MetricTarget {
    return {
      operator: 'lt',
      value: 1000,
      description: 'Keep total complexity below an agreed threshold.',
    };
  }
}

export class DuplicationMetric extends SonarMetricBase {
  readonly id = 'duplication' as const;
  readonly category = 'quality' as const;

  constructor(dependencies: EngineeringHealthDependencies) {
    super(dependencies);
  }

  async calculate(input?: MetricCalculationInput): Promise<MetricValue> {
    const payload = await this.loadMeasures(input);

    return {
      value: getMeasureValue(payload, 'duplicated_lines_density'),
      unit: '%',
      direction: 'lower_is_better',
    };
  }

  target(): MetricTarget {
    return {
      operator: 'lt',
      value: 5,
      description: 'Duplicated lines density below five percent.',
    };
  }
}

export class CoverageMetric extends SonarMetricBase {
  readonly id = 'coverage' as const;
  readonly category = 'quality' as const;

  constructor(dependencies: EngineeringHealthDependencies) {
    super(dependencies);
  }

  async calculate(input?: MetricCalculationInput): Promise<MetricValue> {
    const payload = await this.loadMeasures(input);

    return {
      value: getMeasureValue(payload, 'coverage'),
      unit: '%',
      direction: 'higher_is_better',
    };
  }

  target(): MetricTarget {
    return {
      operator: 'gte',
      value: 80,
      description: 'Coverage at or above eighty percent.',
    };
  }
}
