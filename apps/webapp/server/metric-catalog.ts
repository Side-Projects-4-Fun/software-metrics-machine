import { cache } from 'react';
import { metricCatalogAPI } from './api/metricCatalog';
import type { MetricCatalogEntry } from '@/lib/metrics/metric-catalog';

export const getMetricCatalog = cache(async (): Promise<MetricCatalogEntry[]> => {
  return metricCatalogAPI.list();
});
