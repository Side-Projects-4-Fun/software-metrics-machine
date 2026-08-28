export type CodeEvaluationSeverity = 'critical' | 'warning' | 'good';
export type CodeEvaluationCategory =
  'churn' | 'coupling' | 'ownership' | 'complexity' | 'collaboration';

export interface CodeEvaluationSignal {
  id: string;
  title: string;
  description: string;
  severity: CodeEvaluationSeverity;
  category: CodeEvaluationCategory;
  metrics: Array<{
    label: string;
    value: string;
  }>;
}

export interface CodeDashboardData {
  entityChurn: Array<{ entity: string; added: number; deleted: number; commits: number }>;
  coupling: Array<{ entity: string; coupled: string; degree: number; averageRevs: number }>;
  entityEffort: Array<{ entity: string; 'total-revs': number }>;
  codeChurn: Array<{ date: string; added: number; deleted: number; commits: number }>;
  entityOwnership: Array<{ entity: string; author: string; added: number; deleted: number }>;
  pairing: {
    pairingIndexPercentage: number;
    totalAnalyzedCommits: number;
    pairedCommits: number;
    topPairs: Array<{ author: string; coAuthor: string; pairedCommits: number }>;
  };
  bigOFiles: Array<{
    filePath: string;
    classification: string;
    score: number;
    needsHelp: boolean;
  }>;
  crapMetrics: Array<{ name: string; complexity: number; coverage: number; crap: number }>;
}

export interface CodeEvaluation {
  generatedAt: string;
  signals: CodeEvaluationSignal[];
  summary: {
    totalChurn: number;
    linesAdded: number;
    linesDeleted: number;
    hotspots: number;
    avgPairingIndex: number;
    totalCouplingPairs: number;
    highComplexityFiles: number;
    topChurnFile?: string;
    mostCoupledPair?: string;
    dominantAuthor?: string;
  };
}
