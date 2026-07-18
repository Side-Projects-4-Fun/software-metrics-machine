import {
  EngineeringHealthEvaluationInput,
  MetricCalculationInput,
  MetricComparison,
  MetricEvaluation,
  MetricRecommendation,
  MetricScope,
  MetricSummary,
  MetricTarget,
  MetricValue,
  TrendDirection,
} from './types';
import type { MetricCategory, MetricId } from './types';

export interface Metric {
  readonly id: MetricId;
  readonly category: MetricCategory;

  evaluate?(input: EngineeringHealthEvaluationInput): Promise<MetricEvaluation[]>;

  calculate(input?: MetricCalculationInput): Promise<MetricValue>;
  compare(current: MetricValue, previous?: MetricValue): MetricComparison;
  summarize(value: MetricValue, comparison: MetricComparison): MetricSummary;
  target(): MetricTarget;
  recommendation(value: MetricValue, comparison: MetricComparison): MetricRecommendation;
}

export abstract class BaseMetric implements Metric {
  abstract readonly id: MetricId;
  abstract readonly category: MetricCategory;

  async evaluate(input: EngineeringHealthEvaluationInput): Promise<MetricEvaluation[]> {
    return [await this.evaluateForScope(input.current, input.previous)];
  }

  abstract calculate(input?: MetricCalculationInput): Promise<MetricValue>;
  abstract target(): MetricTarget;

  protected async evaluateForScope(
    currentInput?: MetricCalculationInput,
    previousInput?: MetricCalculationInput,
    scope?: MetricScope
  ): Promise<MetricEvaluation> {
    const current = await this.calculate(currentInput);
    const previous = previousInput ? await this.calculate(previousInput) : undefined;
    const comparison = this.compare(current, previous);

    return {
      id: this.id,
      category: this.category,
      scope,
      value: current,
      comparison,
      summary: this.summarize(current, comparison),
      target: this.target(),
      recommendation: this.recommendation(current, comparison),
    };
  }

  compare(current: MetricValue, previous?: MetricValue): MetricComparison {
    const currentValue = current.value;
    const previousValue = previous?.value ?? null;

    if (currentValue === null || previousValue === null) {
      return {
        trend: 'unknown',
        delta: null,
        deltaPercentage: null,
        current: currentValue,
        previous: previousValue,
        summary: 'Insufficient data to compare periods.',
      };
    }

    const delta = currentValue - previousValue;
    const deltaPercentage = previousValue === 0 ? null : (delta / previousValue) * 100;
    const trend = this.resolveTrend(current.direction, delta);

    return {
      trend,
      delta,
      deltaPercentage,
      current: currentValue,
      previous: previousValue,
      summary: this.describeTrend(trend, delta, current.unit),
    };
  }

  summarize(value: MetricValue, comparison: MetricComparison): MetricSummary {
    const formatted = value.value === null ? 'N/A' : `${value.value.toFixed(2)} ${value.unit}`;
    const notes: string[] = [comparison.summary];

    if (typeof value.sampleSize === 'number') {
      notes.push(`Sample size: ${value.sampleSize}`);
    }

    return {
      title: this.id,
      valueLabel: formatted,
      notes,
    };
  }

  recommendation(value: MetricValue, comparison: MetricComparison): MetricRecommendation {
    const meetsTarget = this.meetsTarget(value);

    if (meetsTarget) {
      return {
        level: 'good',
        summary: 'Metric is within target range.',
        actions: ['Keep current practices and continue monitoring trend stability.'],
      };
    }

    if (comparison.trend === 'improving') {
      return {
        level: 'watch',
        summary: 'Metric is improving but has not reached target yet.',
        actions: ['Keep the improvement plan active until the target is consistently met.'],
      };
    }

    return {
      level: 'critical',
      summary: 'Metric is outside target and needs attention.',
      actions: ['Investigate root causes and define a short-term corrective action plan.'],
    };
  }

  private resolveTrend(direction: MetricValue['direction'], delta: number): TrendDirection {
    const epsilon = 0.0001;
    if (Math.abs(delta) <= epsilon) {
      return 'stable';
    }

    if (direction === 'neutral') {
      return 'unknown';
    }

    if (direction === 'higher_is_better') {
      return delta > 0 ? 'improving' : 'degrading';
    }

    return delta < 0 ? 'improving' : 'degrading';
  }

  private describeTrend(trend: TrendDirection, delta: number, unit: string): string {
    if (trend === 'stable') {
      return 'No significant change from previous period.';
    }

    if (trend === 'unknown') {
      return 'Trend is not available for this metric.';
    }

    const direction = trend === 'improving' ? 'improved' : 'degraded';
    return `Metric ${direction} by ${Math.abs(delta).toFixed(2)} ${unit}.`;
  }

  private meetsTarget(value: MetricValue): boolean {
    if (value.value === null) {
      return false;
    }

    const target = this.target();
    if (typeof target.value !== 'number') {
      return false;
    }

    if (target.operator === 'lt') {
      return value.value < target.value;
    }

    if (target.operator === 'lte') {
      return value.value <= target.value;
    }

    if (target.operator === 'gt') {
      return value.value > target.value;
    }

    if (target.operator === 'gte') {
      return value.value >= target.value;
    }

    if (target.operator === 'eq') {
      return value.value === target.value;
    }

    return false;
  }
}
