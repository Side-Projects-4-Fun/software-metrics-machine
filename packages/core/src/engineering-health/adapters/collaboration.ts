import type { PRFilters } from '../../domain/prs';
import { BaseMetric } from '../metric';
import type { EngineeringHealthDependencies } from '../dependencies';
import type { MetricCalculationInput, MetricTarget, MetricValue } from '../types';

function toPrFilters(input?: MetricCalculationInput): PRFilters {
  return {
    startDate: input?.startDate,
    endDate: input?.endDate,
    rawFilters: input?.rawFilters,
  };
}

function toPatternString(value?: string | string[]): string | undefined {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.join('\n');
  }

  return value;
}

function safePercentage(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return (numerator / denominator) * 100;
}

export class ReviewTimeMetric extends BaseMetric {
  readonly id = 'review-time' as const;
  readonly category = 'collaboration' as const;

  constructor(private readonly dependencies: EngineeringHealthDependencies) {
    super();
  }

  async calculate(input?: MetricCalculationInput): Promise<MetricValue> {
    const rows = await this.dependencies.prsService.getAverageReviewTime(
      toPrFilters(input),
      input?.top
    );
    const sum = rows.reduce((acc, row) => acc + row.avg_days, 0);
    const average = rows.length > 0 ? sum / rows.length : 0;

    return {
      value: Number(average.toFixed(2)),
      unit: 'days',
      direction: 'lower_is_better',
      sampleSize: rows.length,
    };
  }

  target(): MetricTarget {
    return {
      operator: 'lt',
      value: 1,
      description: 'Average review time below one day.',
    };
  }
}

export class ReviewParticipationMetric extends BaseMetric {
  readonly id = 'review-participation' as const;
  readonly category = 'collaboration' as const;

  constructor(private readonly dependencies: EngineeringHealthDependencies) {
    super();
  }

  async calculate(input?: MetricCalculationInput): Promise<MetricValue> {
    const commentsByAuthor = await this.dependencies.prsService.getCommentsByAuthor(
      toPrFilters(input),
      input?.top
    );
    const totalComments = commentsByAuthor.reduce((sum, item) => sum + item.count, 0);
    const uniqueParticipants = commentsByAuthor.length;

    return {
      value: uniqueParticipants,
      unit: 'reviewers',
      direction: 'higher_is_better',
      sampleSize: totalComments,
      details: {
        totalComments,
      },
    };
  }

  target(): MetricTarget {
    return {
      operator: 'gte',
      value: 3,
      description: 'At least three active reviewers in the selected window.',
    };
  }
}

export class PairProgrammingMetric extends BaseMetric {
  readonly id = 'pair-programming' as const;
  readonly category = 'collaboration' as const;

  constructor(private readonly dependencies: EngineeringHealthDependencies) {
    super();
  }

  async calculate(input?: MetricCalculationInput): Promise<MetricValue> {
    const result = await this.dependencies.pairingService.getPairingIndex({
      startDate: input?.startDate,
      endDate: input?.endDate,
    });

    return {
      value: result.pairingIndexPercentage,
      unit: '%',
      direction: 'higher_is_better',
      sampleSize: result.totalAnalyzedCommits,
      details: {
        pairedCommits: result.pairedCommits,
      },
    };
  }

  target(): MetricTarget {
    return {
      operator: 'gte',
      value: 30,
      description: 'Pairing index at or above thirty percent.',
    };
  }
}

export class KnowledgeDistributionMetric extends BaseMetric {
  readonly id = 'knowledge-distribution' as const;
  readonly category = 'collaboration' as const;

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
            ...Array.from(byAuthor.values()).map((value) =>
              safePercentage(value, totalTouchedLines)
            )
          );

    return {
      value: Number((100 - topOwnerShare).toFixed(2)),
      unit: '%',
      direction: 'higher_is_better',
      sampleSize: ownership.length,
      details: {
        topOwnerShare: Number(topOwnerShare.toFixed(2)),
        contributors: byAuthor.size,
      },
    };
  }

  target(): MetricTarget {
    return {
      operator: 'gte',
      value: 60,
      description: 'Knowledge distribution score at or above sixty percent.',
    };
  }
}
