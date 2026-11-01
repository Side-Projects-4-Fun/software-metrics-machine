import { listMetricCatalogEntries } from './metric-catalog';
import type { MetricCatalogEntry } from './metric-catalog';

/**
 * Flattened, serialisable view of the metric catalog.
 *
 * Used by the generated documentation artifacts (JSON + CSV) so the reference
 * page and offline exports are produced from the same source as the CLI, REST
 * API, MCP server and dashboard.
 */
export const METRIC_CATALOG_EXPORT_COLUMNS = [
  'id',
  'namespace',
  'label',
  'description',
  'unit',
  'direction',
  'shape',
  'visibility',
  'status',
  'target',
  'cli',
  'rest',
  'mcp',
] as const;

export interface MetricCatalogExportRow {
  readonly id: string;
  readonly namespace: string;
  readonly label: string;
  readonly description: string;
  readonly unit: string;
  readonly direction: string;
  readonly shape: string;
  readonly visibility: string;
  readonly status: string;
  readonly target: string;
  readonly cli: readonly string[];
  readonly rest: readonly string[];
  readonly mcp: readonly string[];
}

function escapeCsvValue(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

export function toMetricCatalogExportRows(
  entries: readonly MetricCatalogEntry[] = listMetricCatalogEntries()
): MetricCatalogExportRow[] {
  return entries.map((entry) => ({
    id: entry.id,
    namespace: entry.definition.namespace,
    label: entry.definition.label,
    description: entry.definition.description,
    unit: entry.definition.unit,
    direction: entry.definition.direction,
    shape: entry.definition.shape,
    visibility: entry.definition.visibility,
    status: entry.definition.status,
    target: entry.target?.description ?? '',
    cli: entry.definition.surfaces.cli ?? [],
    rest: entry.definition.surfaces.rest ?? [],
    mcp: entry.definition.surfaces.mcp ?? [],
  }));
}

export function toMetricCatalogCsv(rows: readonly MetricCatalogExportRow[]): string {
  const lines = rows.map((row) =>
    [
      row.id,
      row.namespace,
      row.label,
      row.description,
      row.unit,
      row.direction,
      row.shape,
      row.visibility,
      row.status,
      row.target,
      row.cli.join(' | '),
      row.rest.join(' | '),
      row.mcp.join(' | '),
    ]
      .map((value) => escapeCsvValue(value))
      .join(',')
  );

  return [METRIC_CATALOG_EXPORT_COLUMNS.join(','), ...lines].join('\n').concat('\n');
}
