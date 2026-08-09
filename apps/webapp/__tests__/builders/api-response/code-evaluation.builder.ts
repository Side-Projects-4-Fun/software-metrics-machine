import type { CodeEvaluation, CodeEvaluationSignal } from '@/server/api/sourceCode';

export class CodeEvaluationBuilder {
  private data: CodeEvaluation = {
    generatedAt: '2026-01-01T00:00:00Z',
    signals: [],
    summary: {
      totalChurn: 500,
      linesAdded: 300,
      linesDeleted: 200,
      hotspots: 2,
      avgPairingIndex: 45,
      totalCouplingPairs: 10,
      highComplexityFiles: 3,
    },
  };

  withSignals(signals: CodeEvaluationSignal[]): this {
    this.data.signals = signals;
    return this;
  }

  build(): CodeEvaluation {
    return { ...this.data, signals: [...this.data.signals], summary: { ...this.data.summary } };
  }
}
