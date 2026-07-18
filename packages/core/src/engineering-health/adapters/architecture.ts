import type { ArchitectureNode } from '../../domain/architecture';
import { BaseMetric } from '../metric';
import type { EngineeringHealthDependencies } from '../dependencies';
import type { MetricCalculationInput, MetricTarget, MetricValue } from '../types';

function toPatternString(value?: string | string[]): string | undefined {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.join('\n');
  }

  return value;
}

function toStringArray(value?: string | string[]): string[] | undefined {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value;
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function average(numbers: number[]): number {
  if (numbers.length === 0) {
    return 0;
  }

  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

export class CouplingMetric extends BaseMetric {
  readonly id = 'coupling' as const;
  readonly category = 'architecture' as const;

  constructor(private readonly dependencies: EngineeringHealthDependencies) {
    super();
  }

  async calculate(input?: MetricCalculationInput): Promise<MetricValue> {
    const coupling = await this.dependencies.codemaatService.getFileCoupling({
      ignorePatterns: toStringArray(input?.ignorePatterns),
    });
    const values = coupling.map((row) => row.degree);

    return {
      value: Number(average(values).toFixed(2)),
      unit: 'degree',
      direction: 'lower_is_better',
      sampleSize: coupling.length,
    };
  }

  target(): MetricTarget {
    return {
      operator: 'lt',
      value: 10,
      description: 'Average coupling degree below ten.',
    };
  }
}

export class OwnershipMetric extends BaseMetric {
  readonly id = 'ownership' as const;
  readonly category = 'architecture' as const;

  constructor(private readonly dependencies: EngineeringHealthDependencies) {
    super();
  }

  async calculate(input?: MetricCalculationInput): Promise<MetricValue> {
    const ownership = await this.dependencies.codemaatService.getEntityOwnership({
      ignoreFiles: toPatternString(input?.ignorePatterns),
      includeOnly: toPatternString(input?.includePatterns),
      top: input?.top,
    });

    const byAuthor = new Map<string, number>();
    let totalTouchedLines = 0;

    for (const row of ownership) {
      const touched = (row.added || 0) + (row.deleted || 0);
      totalTouchedLines += touched;
      byAuthor.set(row.author, (byAuthor.get(row.author) || 0) + touched);
    }

    const topOwnerShare =
      byAuthor.size === 0 || totalTouchedLines === 0
        ? 0
        : Math.max(
            ...Array.from(byAuthor.values()).map((value) => (value / totalTouchedLines) * 100)
          );

    return {
      value: Number(topOwnerShare.toFixed(2)),
      unit: '%',
      direction: 'lower_is_better',
      sampleSize: ownership.length,
      details: {
        contributors: byAuthor.size,
      },
    };
  }

  target(): MetricTarget {
    return {
      operator: 'lt',
      value: 40,
      description: 'No single contributor should dominate architectural ownership.',
    };
  }
}

export class ComponentsMetric extends BaseMetric {
  readonly id = 'components' as const;
  readonly category = 'architecture' as const;

  constructor(private readonly dependencies: EngineeringHealthDependencies) {
    super();
  }

  async calculate(input?: MetricCalculationInput): Promise<MetricValue> {
    const view = await this.dependencies.architectureService.getView('component', undefined, {
      includePatterns: input?.includePatterns,
      ignorePatterns: input?.ignorePatterns,
    });

    const nodes = (view?.nodes || []) as ArchitectureNode[];
    const componentCount = nodes.filter((node) => node.kind === 'component').length;

    return {
      value: componentCount,
      unit: 'components',
      direction: 'neutral',
      sampleSize: nodes.length,
    };
  }

  target(): MetricTarget {
    return {
      operator: 'custom',
      value: 'context-dependent',
      description: 'Track component count trend over time instead of a fixed threshold.',
    };
  }
}
