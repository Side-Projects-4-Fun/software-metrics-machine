import type { Metric } from './metric';
import { EngineeringHealthRegistry } from './registry';
import type {
  EngineeringHealthEvaluation,
  EngineeringHealthEvaluationInput,
  MetricEvaluation,
} from './types';

export class EngineeringHealthOrchestrator {
  constructor(private readonly registry: EngineeringHealthRegistry) {}

  async evaluate(
    input: EngineeringHealthEvaluationInput = {}
  ): Promise<EngineeringHealthEvaluation> {
    const metrics = this.selectMetrics(input);
    const evaluations: MetricEvaluation[] = [];

    for (const metric of metrics) {
      evaluations.push(...(await this.evaluateMetricInstance(metric, input)));
    }

    return {
      generatedAt: new Date().toISOString(),
      evaluations,
    };
  }

  async evaluateMetric(
    metricId: Parameters<EngineeringHealthRegistry['get']>[0],
    input: EngineeringHealthEvaluationInput = {}
  ): Promise<MetricEvaluation> {
    const metric = this.registry.get(metricId);
    const evaluations = await this.evaluateMetricInstance(metric, input);

    if (evaluations.length === 0) {
      throw new Error(`Engineering health metric produced no evaluations: ${metricId}`);
    }

    return evaluations[0];
  }

  private async evaluateMetricInstance(
    metric: Metric,
    input: EngineeringHealthEvaluationInput
  ): Promise<MetricEvaluation[]> {
    if (metric.evaluate) {
      return metric.evaluate(input);
    }

    const current = await metric.calculate(input.current);
    const previous = input.previous ? await metric.calculate(input.previous) : undefined;
    const comparison = metric.compare(current, previous);

    return [
      {
        id: metric.id,
        category: metric.category,
        value: current,
        comparison,
        summary: metric.summarize(current, comparison),
        target: metric.target(),
        recommendation: metric.recommendation(current, comparison),
      },
    ];
  }

  private selectMetrics(input: EngineeringHealthEvaluationInput): Metric[] {
    if (input.metrics && input.metrics.length > 0) {
      return input.metrics.map((metricId) => this.registry.get(metricId));
    }

    if (input.category) {
      return this.registry.listByCategory(input.category);
    }

    return this.registry.list();
  }
}
