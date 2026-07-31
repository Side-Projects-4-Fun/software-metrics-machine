export type ArchitectureEvaluationSeverity = 'critical' | 'warning' | 'good';
export type ArchitectureEvaluationCategory = 'structure' | 'coupling' | 'quality';

export interface ArchitectureEvaluationSignal {
  id: string;
  title: string;
  description: string;
  severity: ArchitectureEvaluationSeverity;
  category: ArchitectureEvaluationCategory;
  metrics: Array<{
    label: string;
    value: string;
  }>;
}

export interface ArchitectureDashboardData {
  snapshotId: string;
  generatedAt: string;
  commitCount: number;
  view: {
    level: string;
    title: string;
    nodes: Array<{
      id: string;
      kind: string;
      name: string;
      technology?: string;
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      confidence: number;
    }>;
  };
}

export interface ArchitectureEvaluation {
  generatedAt: string;
  signals: ArchitectureEvaluationSignal[];
  summary: {
    totalContainers: number;
    totalEdges: number;
    avgConfidence: number;
    orphanNodes: number;
    mostConnectedNode?: string;
    hubNode?: string;
  };
}
