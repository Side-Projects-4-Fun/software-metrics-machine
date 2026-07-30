const MAP: Record<string, string> = {
  average: 'Avg',
  median: 'Median',
  p75: 'P75',
  p90: 'P90',
  p95: 'P95',
  min: 'Min',
  max: 'Max',
};

export function formatMetricMethod(method?: string): string {
  return MAP[(method || 'average').toLowerCase()] || 'Avg';
}

export function formatMetricLabel(method: string | undefined, suffix: string): string {
  const prefix = formatMetricMethod(method);
  return suffix ? `${prefix} ${suffix}` : prefix;
}
