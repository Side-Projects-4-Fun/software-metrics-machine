import ReferencesCatalog from '@/components/references/ReferencesCatalog';
import { getMetricCatalog } from '@/server/metric-catalog';
import type { MetricCatalogEntry } from '@/lib/metrics/metric-catalog';

/**
 * References page.
 *
 * The catalog is owned by `packages/core/src/domain/metrics/`; this page reads
 * it through `GET /metrics` so ids, descriptions, targets and the external
 * sources behind them stay aligned with every other surface.
 */
export default async function ReferencesPage() {
  let entries: MetricCatalogEntry[] = [];
  let error: string | null = null;

  try {
    entries = await getMetricCatalog();
  } catch (fetchError) {
    console.error('Error fetching metric catalog:', fetchError);
    error = 'Failed to load the metric catalog. Verify that the REST API is running.';
  }

  return <ReferencesCatalog entries={entries} error={error} />;
}
