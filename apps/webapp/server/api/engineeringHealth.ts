import { ApiParams, fetchAPI } from './client';

export type EngineeringHealthMetricCategory =
  | 'delivery'
  | 'quality'
  | 'collaboration'
  | 'architecture';

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

export interface EngineeringHealthEvaluation {
  generatedAt: string;
  evaluations: Array<{
    id: EngineeringHealthMetricId;
    category: EngineeringHealthMetricCategory;
    scope?: {
      type: 'deployment-target';
      key: string;
      label: string;
      deploymentTarget: {
        pipeline: string;
        job: string;
      };
    };
    value: {
      value: number | null;
      value_formatted: string;
      unit: string;
      direction: 'higher_is_better' | 'lower_is_better' | 'neutral';
      sampleSize?: number;
      series?: Array<{ period: string; value: number; value_formatted: string }>;
      details?: Record<string, unknown>;
    };
    comparison: {
      trend: 'improving' | 'stable' | 'degrading' | 'unknown';
      delta: number | null;
      delta_formatted: string;
      deltaPercentage: number | null;
      current: number | null;
      current_formatted: string;
      previous: number | null;
      previous_formatted: string;
      summary: string;
    };
    summary: {
      title: string;
      valueLabel: string;
      notes: string[];
    };
    target: {
      operator: 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'custom';
      value: number | string;
      description: string;
    };
    recommendation: {
      level: 'good' | 'watch' | 'critical';
      summary: string;
      actions: string[];
    };
  }>;
}

export const engineeringHealthAPI = {
  evaluate: (params?: ApiParams) =>
    fetchAPI<EngineeringHealthEvaluation>('/engineering-health/evaluate', params),
};
