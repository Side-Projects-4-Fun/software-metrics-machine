import { ComponentsMetric, CouplingMetric, OwnershipMetric } from './adapters/architecture';
import {
  KnowledgeDistributionMetric,
  PairProgrammingMetric,
  ReviewParticipationMetric,
  ReviewTimeMetric,
} from './adapters/collaboration';
import {
  DeploymentFrequencyMetric,
  FailureRateMetric,
  LeadTimeMetric,
  PipelineDurationMetric,
} from './adapters/delivery';
import { ComplexityMetric, CoverageMetric, DuplicationMetric } from './adapters/quality';
import type { EngineeringHealthDependencies } from './dependencies';
import type { Metric } from './metric';
import type { MetricCategory, MetricId } from './types';

export class EngineeringHealthRegistry {
  private readonly metrics = new Map<MetricId, Metric>();

  register(metric: Metric): this {
    this.metrics.set(metric.id, metric);
    return this;
  }

  get(metricId: MetricId): Metric {
    const metric = this.metrics.get(metricId);
    if (!metric) {
      throw new Error(`Engineering health metric not found: ${metricId}`);
    }

    return metric;
  }

  list(): Metric[] {
    return Array.from(this.metrics.values());
  }

  listByCategory(category: MetricCategory): Metric[] {
    return this.list().filter((metric) => metric.category === category);
  }
}

export function createDefaultEngineeringHealthRegistry(
  dependencies: EngineeringHealthDependencies
): EngineeringHealthRegistry {
  return new EngineeringHealthRegistry()
    .register(new DeploymentFrequencyMetric(dependencies))
    .register(new LeadTimeMetric(dependencies))
    .register(new PipelineDurationMetric(dependencies))
    .register(new FailureRateMetric(dependencies))
    .register(new ComplexityMetric(dependencies))
    .register(new DuplicationMetric(dependencies))
    .register(new CoverageMetric(dependencies))
    .register(new ReviewTimeMetric(dependencies))
    .register(new ReviewParticipationMetric(dependencies))
    .register(new PairProgrammingMetric(dependencies))
    .register(new KnowledgeDistributionMetric(dependencies))
    .register(new CouplingMetric(dependencies))
    .register(new OwnershipMetric(dependencies))
    .register(new ComponentsMetric(dependencies));
}
