'use client';

import { createContext, useContext, useMemo } from 'react';
import type { MetricCatalogEntry } from '@/lib/metrics/metric-catalog';

const MetricCatalogContext = createContext<ReadonlyMap<string, MetricCatalogEntry>>(new Map());

export function MetricCatalogProvider({
  entries,
  children,
}: {
  entries: MetricCatalogEntry[];
  children: React.ReactNode;
}) {
  const catalog = useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry])),
    [entries],
  );

  return (
    <MetricCatalogContext.Provider value={catalog}>{children}</MetricCatalogContext.Provider>
  );
}

export function useMetricCatalog(): ReadonlyMap<string, MetricCatalogEntry> {
  return useContext(MetricCatalogContext);
}

export function useMetricDefinition(id?: string): MetricCatalogEntry | undefined {
  const catalog = useContext(MetricCatalogContext);

  if (!id) {
    return undefined;
  }

  return catalog.get(id);
}
