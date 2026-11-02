export type MetricNamespace = 'cr' | 'pl' | 'code' | 'sq' | 'arch' | 'issue' | 'eh';

export type MetricCatalogDirection = 'higher_is_better' | 'lower_is_better' | 'neutral';

export type MetricVisibility = 'public' | 'internal';

export type MetricStatus = 'active' | 'deprecated';

export interface MetricCatalogTarget {
  operator: 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'custom';
  value: number | string;
  description: string;
}

export interface MetricCatalogSource {
  label: string;
  url: string;
}

export interface MetricCatalogComputation {
  evidence: string;
  formula: string;
  notation: string;
}

export interface MetricCatalogDefinition {
  namespace: MetricNamespace;
  label: string;
  description: string;
  computation: MetricCatalogComputation;
  unit: string;
  direction: MetricCatalogDirection;
  shape: string;
  visibility: MetricVisibility;
  status: MetricStatus;
  replacedBy?: string;
  surfaces: {
    cli?: readonly string[];
    rest?: readonly string[];
    mcp?: readonly string[];
  };
}

export interface MetricCatalogEntry {
  id: string;
  definition: MetricCatalogDefinition;
  target?: MetricCatalogTarget;
  sources?: MetricCatalogSource[];
}
