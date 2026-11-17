import { ApiParams, fetchAPI } from './client';
import type { MetricCatalogEntry } from '@/lib/metrics/metric-catalog';

interface MetricCatalogResponse {
  result: MetricCatalogEntry[];
}

export const metricCatalogAPI = {
  list: async (params?: ApiParams): Promise<MetricCatalogEntry[]> => {
    const response = await fetchAPI<MetricCatalogResponse>('/metrics', params);
    return response.result;
  },
};
