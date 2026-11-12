import Link from 'next/link';
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

  return (
    <div className="relative min-h-screen py-12 px-4">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-blue-50 to-indigo-100" />
      <div className="max-w-7xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 font-medium mb-6"
        >
          ← Back to Home
        </Link>
        <ReferencesCatalog entries={entries} error={error} />
      </div>
    </div>
  );
}
