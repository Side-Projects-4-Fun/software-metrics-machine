import type { EngineeringHealthEvaluation, EngineeringHealthMetricId, EngineeringHealthMetricCategory } from '@/server/api/engineeringHealth';

export class EngineeringHealthMetricBuilder {
  private id: EngineeringHealthMetricId = 'deployment-frequency';
  private category: EngineeringHealthMetricCategory = 'delivery';
  private scope: EngineeringHealthEvaluation['evaluations'][number]['scope'];
  private value: EngineeringHealthEvaluation['evaluations'][number]['value'] = {
    value: 10,
    value_formatted: '10',
    unit: 'deployments/day',
    direction: 'higher_is_better' as const,
    sampleSize: 30,
  };
  private comparison: EngineeringHealthEvaluation['evaluations'][number]['comparison'] = {
    trend: 'stable',
    delta: 0,
    delta_formatted: '0',
    deltaPercentage: 0,
    current: 10,
    current_formatted: '10',
    previous: 10,
    previous_formatted: '10',
    summary: 'No change.',
  };
  private summary: EngineeringHealthEvaluation['evaluations'][number]['summary'] = {
    title: 'Deployment Frequency',
    valueLabel: '10 deployments/day',
    notes: [],
  };
  private target: EngineeringHealthEvaluation['evaluations'][number]['target'] = {
    operator: 'gte',
    value: 1,
    description: 'At least 1 deployment per day.',
  };
  private recommendation: EngineeringHealthEvaluation['evaluations'][number]['recommendation'] = {
    level: 'good',
    summary: 'On track.',
    actions: [],
  };

  withId(id: EngineeringHealthMetricId): this {
    this.id = id;
    this.summary.title = id;
    return this;
  }
  withCategory(category: EngineeringHealthMetricCategory): this { this.category = category; return this; }
  withValue(value: number, formatted: string): this {
    this.value.value = value; this.value.value_formatted = formatted; return this;
  }
  withTrend(trend: 'improving' | 'stable' | 'degrading' | 'unknown', current: number, previous: number): this {
    this.comparison.trend = trend;
    this.comparison.current = current;
    this.comparison.current_formatted = String(current);
    this.comparison.previous = previous;
    this.comparison.previous_formatted = String(previous);
    this.comparison.delta = current - previous;
    this.comparison.delta_formatted = String(this.comparison.delta);
    return this;
  }
  withRecommendation(level: 'good' | 'watch' | 'critical'): this {
    this.recommendation.level = level; return this;
  }
  withDeploymentTarget(pipeline: string, job: string): this {
    this.scope = {
      type: 'deployment-target',
      key: `${pipeline}/${job}`,
      label: `${pipeline} / ${job}`,
      deploymentTarget: { pipeline, job },
    };
    return this;
  }

  build(): EngineeringHealthEvaluation['evaluations'][number] {
    return {
      id: this.id,
      category: this.category,
      scope: this.scope,
      value: { ...this.value },
      comparison: { ...this.comparison },
      summary: { ...this.summary },
      target: { ...this.target },
      recommendation: { ...this.recommendation },
    };
  }
}
