import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listMetricCatalogEntries } from '../metric-catalog';
import { toMetricCatalogCsv, toMetricCatalogExportRows } from '../metric-catalog-export';

const CSV_ARTIFACT = 'docs/vitepress/public/metrics-catalog.csv';

function findRepositoryRoot(start: string): string {
  let current = resolve(start);

  for (;;) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`Unable to locate the repository root from ${start}`);
    }
    current = parent;
  }
}

const repositoryRoot = findRepositoryRoot(process.cwd());
const exportRows = toMetricCatalogExportRows(listMetricCatalogEntries());

describe('metric catalog docs artifacts', () => {
  it('keeps the published CSV export in sync with the catalog', () => {
    const published = readFileSync(join(repositoryRoot, CSV_ARTIFACT), 'utf8');

    expect(published).toBe(toMetricCatalogCsv(exportRows));
  });

  it('exports one CSV line per catalogued metric plus a header', () => {
    const csv = toMetricCatalogCsv(exportRows);

    expect(csv.trimEnd().split('\n')).toHaveLength(exportRows.length + 1);
  });
});
