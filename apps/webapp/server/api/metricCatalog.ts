import { ApiParams, fetchAPI } from './client';
import type { MetricCatalogEntry } from '@/lib/metrics/metric-catalog';

interface MetricCatalogResponse {
  result: MetricCatalogEntry[];
}

/**
 * Reads the core-owned metric catalog (`GET /metrics`).
 *
 * Ids, labels, targets and the external sources behind them live in
 * `packages/core/src/domain/metrics`; the webapp only reads them.
 */
export const metricCatalogAPI = {
  list: async (params?: ApiParams): Promise<MetricCatalogEntry[]> => {
    const response = await fetchAPI<MetricCatalogResponse>('/metrics', params);
    return response.result;
  },
};
