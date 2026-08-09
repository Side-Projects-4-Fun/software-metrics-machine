import type { ArchitectureEvaluation } from '@/server/api/architecture';

export class ArchitectureEvaluationBuilder {
  private data: ArchitectureEvaluation = {
    generatedAt: '2026-01-01T00:00:00Z',
    signals: [],
    summary: {
      totalContainers: 2,
      totalEdges: 1,
      avgConfidence: 0.9,
      orphanNodes: 0,
    },
  };

  build(): ArchitectureEvaluation {
    return { ...this.data, signals: [...this.data.signals], summary: { ...this.data.summary } };
  }
}
