import type { OutlierMode, WeekendsMode } from '../domain/metric-samples';
import type { DeploymentFrequencyTarget } from '../domain/pipelines';

export type EngineeringHealthMetricCategory =
  'delivery' | 'quality' | 'collaboration' | 'architecture';

export type EngineeringHealthMetricId =
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

export interface EngineeringHealthMetricValue {
  value: number | null;
  unit: string;
  direction: MetricDirection;
  sampleSize?: number;
  series?: TimeSeriesPoint[];
  details?: Record<string, unknown>;
}

export interface EngineeringHealthMetricTarget {
  operator: MetricTargetOperator;
  value: number | string;
  description: string;
}

export interface EngineeringHealthMetricComparison {
  trend: TrendDirection;
  delta: number | null;
  deltaPercentage: number | null;
  current: number | null;
  previous: number | null;
  summary: string;
}

export interface EngineeringHealthMetricSummary {
  title: string;
  valueLabel: string;
  notes: string[];
}

export interface EngineeringHealthMetricRecommendation {
  level: 'good' | 'watch' | 'critical';
  summary: string;
  actions: string[];
}

export interface MetricCalculationInput {
  startDate?: string;
  endDate?: string;
  changeRequestLabels?: string | string[];
  rawFilters?: string;
  period?: 'day' | 'week' | 'month';
  weekends?: WeekendsMode;
  outlierMode?: OutlierMode;
  includePatterns?: string | string[];
  ignorePatterns?: string | string[];
  top?: number;
  workflowPath?: string;
  jobName?: string;
}

export interface EngineeringHealthMetricScope {
  type: 'deployment-target';
  key: string;
  label: string;
  deploymentTarget: DeploymentFrequencyTarget;
}

export interface EngineeringHealthEvaluationInput {
  current?: MetricCalculationInput;
  previous?: MetricCalculationInput;
  metrics?: EngineeringHealthMetricId[];
  category?: EngineeringHealthMetricCategory;
}

export interface MetricEvaluation {
  id: EngineeringHealthMetricId;
  category: EngineeringHealthMetricCategory;
  scope?: EngineeringHealthMetricScope;
  value: EngineeringHealthMetricValue;
  comparison: EngineeringHealthMetricComparison;
  summary: EngineeringHealthMetricSummary;
  target: EngineeringHealthMetricTarget;
  recommendation: EngineeringHealthMetricRecommendation;
}

export interface EngineeringHealthEvaluation {
  generatedAt: string;
  evaluations: MetricEvaluation[];
}
