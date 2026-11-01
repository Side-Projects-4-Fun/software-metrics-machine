import { describe, expect, it } from 'vitest';
import { listMetricCatalogEntries, type MetricCatalogEntry } from '../metric-catalog';
import {
  METRIC_CATALOG_EXPORT_COLUMNS,
  toMetricCatalogCsv,
  toMetricCatalogExportRows,
  type MetricCatalogExportRow,
} from '../metric-catalog-export';

const reviewTimeEntry: MetricCatalogEntry = {
  id: 'cr-review-time',
  definition: {
    namespace: 'cr',
    label: 'Review time',
    description: 'Days from change request creation to review, per author.',
    unit: 'hours',
    direction: 'lower_is_better',
    shape: 'distribution',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['change-requests review-time'],
      rest: ['/change-requests/review-time'],
      mcp: ['smm_get_change_request_review_time'],
    },
  },
  target: { operator: 'lt', value: 24, description: '< 24 hours' },
  sources: [
    {
      label: 'Forsgren et al. (2018) — Accelerate',
      url: 'https://itrevolution.com/product/accelerate/',
    },
  ],
};

const quotedEntry: MetricCatalogEntry = {
  id: 'issue-total',
  definition: {
    namespace: 'issue',
    label: 'Issue total, "all statuses"',
    description: 'Total issues in the window.\nIncludes open and closed issues.',
    unit: 'count',
    direction: 'neutral',
    shape: 'scalar',
    visibility: 'internal',
    status: 'deprecated',
    surfaces: {},
  },
};

function findRow(rows: readonly MetricCatalogExportRow[], id: string): MetricCatalogExportRow {
  const row = rows.find((candidate) => candidate.id === id);
  if (!row) {
    throw new Error(`Missing export row for ${id}`);
  }
  return row;
}

describe('metric catalog export', () => {
  it('flattens a catalog entry into one export row', () => {
    const rows = toMetricCatalogExportRows([reviewTimeEntry]);

    expect(rows).toEqual([
      {
        id: 'cr-review-time',
        namespace: 'cr',
        label: 'Review time',
        description: 'Days from change request creation to review, per author.',
        unit: 'hours',
        direction: 'lower_is_better',
        shape: 'distribution',
        visibility: 'public',
        status: 'active',
        target: '< 24 hours',
        cli: ['change-requests review-time'],
        rest: ['/change-requests/review-time'],
        mcp: ['smm_get_change_request_review_time'],
      },
    ]);
  });

  it('uses empty values for entries without a target or surfaces', () => {
    const row = findRow(toMetricCatalogExportRows([quotedEntry]), 'issue-total');

    expect(row.target).toBe('');
    expect(row.cli).toEqual([]);
  });

  it('exports every catalogued metric by default', () => {
    const catalogIds = listMetricCatalogEntries().map((entry) => entry.id);
    const exportedIds = toMetricCatalogExportRows().map((row) => row.id);

    expect(exportedIds).toEqual(catalogIds);
  });

  it('writes the documented column order as the CSV header', () => {
    const [header] = toMetricCatalogCsv(toMetricCatalogExportRows([reviewTimeEntry])).split('\n');

    expect(header).toBe(METRIC_CATALOG_EXPORT_COLUMNS.join(','));
    expect(header).toBe(
      'id,namespace,label,description,unit,direction,shape,visibility,status,target,cli,rest,mcp'
    );
  });

  it('writes one CSV line per metric and a trailing newline', () => {
    const csv = toMetricCatalogCsv(toMetricCatalogExportRows([reviewTimeEntry]));
    const lines = csv.split('\n');

    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('cr-review-time,cr,Review time,');
    expect(lines[2]).toBe('');
  });

  it('quotes values containing commas, quotes, or line breaks', () => {
    const csv = toMetricCatalogCsv(toMetricCatalogExportRows([quotedEntry]));

    expect(csv).toContain('"Issue total, ""all statuses"""');
    expect(csv).toContain('"Total issues in the window.\nIncludes open and closed issues."');
  });

  it('joins every surface entry with a pipe', () => {
    const [header, row] = toMetricCatalogCsv(toMetricCatalogExportRows([reviewTimeEntry])).split(
      '\n'
    );

    expect(header).toContain('cli,rest,mcp');
    expect(row).toContain('change-requests review-time,/change-requests/review-time');
  });
});
