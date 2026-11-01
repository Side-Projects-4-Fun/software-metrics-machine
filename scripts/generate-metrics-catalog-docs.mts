/**
 * Generates the metric catalog documentation artifacts from the core catalog.
 *
 * Output (committed to the repository so the docs site builds without the
 * monorepo toolchain):
 *   - docs/vitepress/public/metrics-catalog.csv  (rendered by the docs table and
 *     served as the public download)
 *
 * Usage:
 *   pnpm docs:metrics         # regenerate the artifacts
 *   pnpm docs:metrics:check   # fail when the committed artifacts are stale
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listMetricCatalogEntries } from '../packages/core/src/domain/metrics/metric-catalog.ts';
import {
  toMetricCatalogCsv,
  toMetricCatalogExportRows,
} from '../packages/core/src/domain/metrics/metric-catalog-export.ts';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const csvPath = join(repositoryRoot, 'docs/vitepress/public/metrics-catalog.csv');

const rows = toMetricCatalogExportRows(listMetricCatalogEntries());
const outputs = [{ path: csvPath, content: toMetricCatalogCsv(rows) }];

const relative = (path: string): string => path.replace(`${repositoryRoot}/`, '');

if (process.argv.includes('--check')) {
  const stale = outputs.filter(
    ({ path, content }) => !existsSync(path) || readFileSync(path, 'utf8') !== content
  );

  if (stale.length > 0) {
    console.error('Metric catalog docs are out of date:');
    stale.forEach(({ path }) => console.error(`  - ${relative(path)}`));
    console.error('Run "pnpm docs:metrics" and commit the regenerated files.');
    process.exit(1);
  }

  console.log(`Metric catalog docs are up to date (${rows.length} metrics).`);
} else {
  outputs.forEach(({ path, content }) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, 'utf8');
  });

  console.log(`Wrote ${rows.length} metrics to:`);
  outputs.forEach(({ path }) => console.log(`  - ${relative(path)}`));
}
