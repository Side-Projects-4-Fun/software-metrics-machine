import { cache } from 'react';
import { metricCatalogAPI } from './api/metricCatalog';
import type { MetricCatalogEntry } from '@/lib/metrics/metric-catalog';

/**
 * Request-scoped metric catalog loader.
 *
 * Cached with React `cache` so the root layout and any page that needs the
 * catalog share a single `GET /metrics` call per request.
 */
export const getMetricCatalog = cache(async (): Promise<MetricCatalogEntry[]> => {
  return metricCatalogAPI.list();
});
