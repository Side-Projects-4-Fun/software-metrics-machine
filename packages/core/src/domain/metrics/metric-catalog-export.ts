import { listMetricCatalogEntries } from './metric-catalog';
import type { MetricCatalogEntry } from './metric-catalog';
import { stringifyCsv } from '../../infrastructure/csv';

export const METRIC_CATALOG_EXPORT_COLUMNS = [
  'id',
  'namespace',
  'label',
  'description',
  'evidence',
  'formula',
  'notation',
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
  readonly evidence: string;
  readonly formula: string;
  readonly notation: string;
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

export function toMetricCatalogExportRows(
  entries: readonly MetricCatalogEntry[] = listMetricCatalogEntries()
): MetricCatalogExportRow[] {
  return entries.map((entry) => ({
    id: entry.id,
    namespace: entry.definition.namespace,
    label: entry.definition.label,
    description: entry.definition.description,
    evidence: entry.definition.computation.evidence,
    formula: entry.definition.computation.formula,
    notation: entry.definition.computation.notation,
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
  const dataRows = rows.map((row) => [
    row.id,
    row.namespace,
    row.label,
    row.description,
    row.evidence,
    row.formula,
    row.notation,
    row.unit,
    row.direction,
    row.shape,
    row.visibility,
    row.status,
    row.target,
    row.cli.join(' | '),
    row.rest.join(' | '),
    row.mcp.join(' | '),
  ]);

  return stringifyCsv([[...METRIC_CATALOG_EXPORT_COLUMNS], ...dataRows]);
}
