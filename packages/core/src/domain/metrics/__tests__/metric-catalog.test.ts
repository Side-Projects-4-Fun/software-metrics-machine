import { describe, expect, it } from 'vitest';
import {
  METRIC_CATALOG,
  isMetricNamespace,
  isMetricVisibility,
  listMetricCatalogEntries,
  type MetricCatalogEntry,
  type MetricDefinition,
} from '../metric-catalog';
import { METRIC_IMPLEMENTATIONS } from '../metric-implementations';

const catalogEntries = Object.entries(METRIC_CATALOG) as Array<[string, MetricDefinition]>;
const catalogIds = catalogEntries.map(([id]) => id);

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function invalidKebabIds(): string[] {
  return catalogIds.filter((id) => !KEBAB_CASE.test(id));
}

function namespacePrefixViolations(): string[] {
  return catalogEntries
    .filter(
      ([id, definition]) =>
        definition.namespace !== 'eh' && !id.startsWith(`${definition.namespace}-`)
    )
    .map(([id]) => id);
}

function publicMetricsWithoutSurfaces(): string[] {
  return catalogEntries
    .filter(([, definition]) => definition.visibility === 'public')
    .filter(([, definition]) => {
      const { cli = [], rest = [], mcp = [] } = definition.surfaces;
      return cli.length + rest.length + mcp.length === 0;
    })
    .map(([id]) => id);
}

function internalMetricsWithSurfaces(): string[] {
  return catalogEntries
    .filter(([, definition]) => definition.visibility === 'internal')
    .filter(([, definition]) => {
      const { cli = [], rest = [], mcp = [] } = definition.surfaces;
      return cli.length + rest.length + mcp.length > 0;
    })
    .map(([id]) => id);
}

function blankSurfaceViolations(): string[] {
  return catalogEntries
    .filter(([, definition]) => {
      const values = [
        ...(definition.surfaces.cli ?? []),
        ...(definition.surfaces.rest ?? []),
        ...(definition.surfaces.mcp ?? []),
      ];
      return values.some((value) => value.trim().length === 0);
    })
    .map(([id]) => id);
}

function blankFieldViolations(): string[] {
  return catalogEntries.flatMap(([id, definition]) => {
    const violations: string[] = [];

    if (definition.label.trim().length === 0) {
      violations.push(`${id}.label`);
    }
    if (definition.description.trim().length === 0) {
      violations.push(`${id}.description`);
    }
    if (definition.unit.trim().length === 0) {
      violations.push(`${id}.unit`);
    }

    return violations;
  });
}

function engineeringHealthIds(): string[] {
  return catalogEntries
    .filter(([, definition]) => definition.namespace === 'eh')
    .map(([id]) => id)
    .sort();
}

function implementationMismatches(): string[] {
  const catalogKeys = new Set(catalogIds);
  const implementationKeys = Object.keys(METRIC_IMPLEMENTATIONS);

  return [
    ...catalogIds.filter((id) => !implementationKeys.includes(id)),
    ...implementationKeys.filter((id) => !catalogKeys.has(id)),
  ];
}

function blankImplementationViolations(): string[] {
  return Object.entries(METRIC_IMPLEMENTATIONS)
    .filter(
      ([, reference]) =>
        reference.service.trim().length === 0 || reference.method.trim().length === 0
    )
    .map(([id]) => id);
}

function entryIds(entries: MetricCatalogEntry[]): string[] {
  return entries.map((entry) => entry.id);
}

function namespacesOf(entries: MetricCatalogEntry[]): string[] {
  return Array.from(new Set(entries.map((entry) => entry.definition.namespace)));
}

function visibilitiesOf(entries: MetricCatalogEntry[]): string[] {
  return Array.from(new Set(entries.map((entry) => entry.definition.visibility)));
}

describe('METRIC_CATALOG', () => {
  it('uses kebab-case identifiers', () => {
    expect(invalidKebabIds()).toEqual([]);
  });

  it('keeps identifiers unique', () => {
    expect(new Set(catalogIds).size).toBe(catalogIds.length);
  });

  it('prefixes every non-engineering-health identifier with its namespace', () => {
    expect(namespacePrefixViolations()).toEqual([]);
  });

  it('gives every public metric at least one surface', () => {
    expect(publicMetricsWithoutSurfaces()).toEqual([]);
  });

  it('keeps internal metrics off the public surfaces', () => {
    expect(internalMetricsWithSurfaces()).toEqual([]);
  });

  it('never declares a blank surface name', () => {
    expect(blankSurfaceViolations()).toEqual([]);
  });

  it('fills every required catalog field', () => {
    expect(blankFieldViolations()).toEqual([]);
  });

  it('exposes the fourteen engineering health metrics', () => {
    expect(engineeringHealthIds()).toEqual([
      'complexity',
      'components',
      'coupling',
      'coverage',
      'deployment-frequency',
      'duplication',
      'failure-rate',
      'knowledge-distribution',
      'lead-time',
      'ownership',
      'pair-programming',
      'pipeline-duration',
      'review-participation',
      'review-time',
    ]);
  });
});

describe('METRIC_IMPLEMENTATIONS', () => {
  it('binds every catalog metric and nothing else', () => {
    expect(implementationMismatches()).toEqual([]);
  });

  it('references non-empty service and method names', () => {
    expect(blankImplementationViolations()).toEqual([]);
  });
});

describe('isMetricNamespace', () => {
  it('accepts supported namespaces', () => {
    expect(isMetricNamespace('cr')).toBe(true);
    expect(isMetricNamespace('pl')).toBe(true);
    expect(isMetricNamespace('eh')).toBe(true);
  });

  it('rejects unknown namespaces', () => {
    expect(isMetricNamespace('unknown')).toBe(false);
    expect(isMetricNamespace('')).toBe(false);
  });
});

describe('isMetricVisibility', () => {
  it('accepts supported visibilities', () => {
    expect(isMetricVisibility('public')).toBe(true);
    expect(isMetricVisibility('internal')).toBe(true);
  });

  it('rejects unknown visibilities', () => {
    expect(isMetricVisibility('private')).toBe(false);
    expect(isMetricVisibility('')).toBe(false);
  });
});

describe('listMetricCatalogEntries', () => {
  it('returns every metric by default', () => {
    expect(entryIds(listMetricCatalogEntries())).toHaveLength(catalogIds.length);
  });

  it('filters by namespace', () => {
    const entries = listMetricCatalogEntries({ namespace: 'eh' });

    expect(namespacesOf(entries)).toEqual(['eh']);
    expect(entryIds(entries)).toHaveLength(14);
  });

  it('filters by visibility', () => {
    const entries = listMetricCatalogEntries({ visibility: 'internal' });

    expect(visibilitiesOf(entries)).toEqual(['internal']);
    expect(entryIds(entries).length).toBeGreaterThan(0);
  });

  it('combines namespace and visibility filters', () => {
    expect(entryIds(listMetricCatalogEntries({ namespace: 'arch', visibility: 'public' }))).toEqual(
      ['arch-snapshot', 'arch-summary', 'arch-view', 'arch-evaluation']
    );
  });
});
