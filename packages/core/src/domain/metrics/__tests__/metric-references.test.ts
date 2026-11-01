import { describe, expect, it } from 'vitest';
import {
  listMetricCatalogEntries,
  METRIC_CATALOG,
  METRIC_REFERENCES,
  getMetricReference,
} from '../index';
import type { MetricCatalogEntry } from '../metric-catalog';

function findEntry(id: string): MetricCatalogEntry | undefined {
  return listMetricCatalogEntries().find((entry) => entry.id === id);
}

describe('metric references', () => {
  it('attaches a documented target and sources to catalogued families', () => {
    const entry = findEntry('cr-review-time');

    expect(entry?.target).toEqual({
      operator: 'lt',
      value: 24,
      description: '< 24 hours',
    });
    expect(entry?.sources).toHaveLength(2);
    expect(entry?.sources?.[0].label).toContain('Accelerate');
  });

  it('merges evidence when one family backs several dashboard cards', () => {
    const entry = findEntry('cr-summary');
    const urls = entry?.sources?.map((source) => source.url) ?? [];

    expect(entry?.target?.description).toBe('High merge rate');
    expect(urls).toHaveLength(4);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('keeps every referenced id inside the catalog', () => {
    const unknownIds = Object.keys(METRIC_REFERENCES).filter((id) => !(id in METRIC_CATALOG));

    expect(unknownIds).toEqual([]);
  });

  it('only references metric families that exist', () => {
    expect(Object.keys(METRIC_REFERENCES)).toHaveLength(28);
    expect(getMetricReference('cr-review-time')?.target.description).toBe('< 24 hours');
    expect(getMetricReference('eh' as never)).toBeUndefined();
  });

  it('leaves entries without evidence free of targets and sources', () => {
    const entry = findEntry('issue-total');

    expect(entry?.target).toBeUndefined();
    expect(entry?.sources).toBeUndefined();
  });
});
