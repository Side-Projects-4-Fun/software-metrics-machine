import type { EngineeringHealthEvaluation } from '@/server/api/engineeringHealth';

export class EngineeringHealthEvaluationBuilder {
  private items: EngineeringHealthEvaluation['evaluations'] = [];
  private generatedAt: string = '2026-01-01T00:00:00Z';

  withMetric(item: EngineeringHealthEvaluation['evaluations'][number]): this {
    this.items.push(item); return this;
  }

  withGeneratedAt(generatedAt: string): this {
    this.generatedAt = generatedAt;
    return this;
  }

  build(): EngineeringHealthEvaluation {
    return {
      generatedAt: this.generatedAt,
      evaluations: [...this.items],
    };
  }
}
