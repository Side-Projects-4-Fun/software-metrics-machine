import type { OutlierMode, WeekendsMode } from '../domain/metric-samples';

export type MetricCategory = 'delivery' | 'quality' | 'collaboration' | 'architecture';

export type MetricId =
  | 'deployment-frequency'
  | 'lead-time'
  | 'pipeline-duration'
  | 'failure-rate'
  | 'complexity'
  | 'duplication'
  | 'coverage'
  | 'review-time'
  | 'review-participation'
  | 'pair-programming'
  | 'knowledge-distribution'
  | 'coupling'
  | 'ownership'
  | 'components';

export type MetricDirection = 'higher_is_better' | 'lower_is_better' | 'neutral';

export type TrendDirection = 'improving' | 'stable' | 'degrading' | 'unknown';

export type MetricTargetOperator = 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'custom';

export interface TimeSeriesPoint {
  period: string;
  value: number;
}

export interface MetricValue {
  value: number | null;
  unit: string;
  direction: MetricDirection;
  sampleSize?: number;
  series?: TimeSeriesPoint[];
  details?: Record<string, unknown>;
}

export interface MetricTarget {
  operator: MetricTargetOperator;
  value: number | string;
  description: string;
}

export interface MetricComparison {
  trend: TrendDirection;
  delta: number | null;
  deltaPercentage: number | null;
  current: number | null;
  previous: number | null;
  summary: string;
}

export interface MetricSummary {
  title: string;
  valueLabel: string;
  notes: string[];
}

export interface MetricRecommendation {
  level: 'good' | 'watch' | 'critical';
  summary: string;
  actions: string[];
}

export interface MetricCalculationInput {
  startDate?: string;
  endDate?: string;
  rawFilters?: string;
  period?: 'day' | 'week' | 'month';
  weekends?: WeekendsMode;
  outlierMode?: OutlierMode;
  includePatterns?: string | string[];
  ignorePatterns?: string | string[];
  top?: number;
}

export interface EngineeringHealthEvaluationInput {
  current?: MetricCalculationInput;
  previous?: MetricCalculationInput;
  metrics?: MetricId[];
  category?: MetricCategory;
}

export interface MetricEvaluation {
  id: MetricId;
  category: MetricCategory;
  value: MetricValue;
  comparison: MetricComparison;
  summary: MetricSummary;
  target: MetricTarget;
  recommendation: MetricRecommendation;
}

export interface EngineeringHealthEvaluation {
  generatedAt: string;
  evaluations: MetricEvaluation[];
}
