import type { MetricMethod } from '../index';

export const VALID_METRIC_METHODS: MetricMethod[] = [
  'average',
  'median',
  'p75',
  'p90',
  'p95',
  'min',
  'max',
];

export function normalizeMetricMethod(value?: string): MetricMethod {
  const normalized = (value || 'average').toLowerCase();
  return VALID_METRIC_METHODS.includes(normalized as MetricMethod)
    ? (normalized as MetricMethod)
    : 'average';
}
