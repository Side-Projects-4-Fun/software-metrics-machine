import { fetchAPI } from './client';

export type ArchitectureSummary = {
  snapshot_id: string;
  generated_at: string;
  project: string;
  branch?: string;
  commit_count: number;
  views: Array<{
    level: 'context' | 'container' | 'component' | 'code';
    title: string;
    nodes: number;
    edges: number;
  }>;
};

export type ArchitectureNode = {
  id: string;
  kind: 'person' | 'system' | 'container' | 'component' | 'code';
  name: string;
  technology?: string;
  description?: string;
};

export type ArchitectureEdge = {
  id: string;
  source: string;
  target: string;
  kind: 'uses';
  description?: string;
  confidence: number;
};

export type ArchitectureView = {
  id: string;
  level: 'context' | 'container' | 'component' | 'code';
  title: string;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
};

export type ArchitectureEvaluationSignal = {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'good';
  category: string;
  metrics: Array<{ label: string; value: string }>;
};

export type ArchitectureEvaluation = {
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
};

type ApiResult<T> = {
  result: T;
};

export const architectureAPI = {
  summary: (snapshotId?: string) =>
    fetchAPI<ApiResult<ArchitectureSummary | null>>('/architecture/summary', {
      snapshot_id: snapshotId,
    }),
  view: (
    level: 'context' | 'container' | 'component' | 'code' = 'container',
    snapshotId?: string,
    filters?: { ignore_files?: string; include_only?: string }
  ) =>
    fetchAPI<ApiResult<ArchitectureView | null>>('/architecture/view', {
      level,
      snapshot_id: snapshotId,
      ignore_files: filters?.ignore_files,
      include_only: filters?.include_only,
    }),
  snapshots: () =>
    fetchAPI<
      ApiResult<
        Array<{
          snapshotId: string;
          generatedAt: string;
          project: string;
          branch?: string;
          commitCount: number;
          availableViews: Array<'context' | 'container' | 'component' | 'code'>;
        }>
      >
    >('/architecture/snapshots'),
  evaluate: (params?: {
    snapshot_id?: string;
    level?: string;
    ignore_files?: string;
    include_only?: string;
  }) =>
    fetchAPI<ArchitectureEvaluation | null>('/architecture/evaluate', params),
};
