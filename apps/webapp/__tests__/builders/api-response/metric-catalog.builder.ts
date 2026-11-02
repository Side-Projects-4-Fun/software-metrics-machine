import type {
  MetricCatalogComputation,
  MetricCatalogDefinition,
  MetricCatalogDirection,
  MetricCatalogEntry,
  MetricCatalogSource,
  MetricCatalogTarget,
  MetricNamespace,
} from '@/lib/metrics/metric-catalog';

const defaultSources: MetricCatalogSource[] = [
  {
    label: 'Cormen et al. (2022) — Introduction to Algorithms, 4th edition',
    url: 'https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/',
  },
  {
    label: 'Khan Academy — Big-O notation and asymptotic analysis',
    url: 'https://www.khanacademy.org/computing/computer-science/algorithms/asymptotic-notation/a/big-o-notation',
  },
  {
    label: 'NIST Dictionary of Algorithms and Data Structures — big-O notation',
    url: 'https://xlinux.nist.gov/dads/HTML/bigOnotation.html',
  },
];

export class MetricCatalogEntryBuilder {
  private entry: MetricCatalogEntry = {
    id: 'code-big-o',
    definition: {
      namespace: 'code',
      label: 'Big O',
      description: 'Asymptotic complexity classification per file.',
      computation: {
        evidence: 'Source files scanned for loops and iteration helpers.',
        formula: 'Highest signal weight times 12 plus signal count times 2.',
        notation: 'score = min(100, weight[top] × 12 + |signals| × 2)',
      },
      unit: 'score',
      direction: 'lower_is_better',
      shape: 'table',
      visibility: 'public',
      status: 'active',
      surfaces: {
        cli: ['code big-o'],
        rest: ['/code/big-o'],
        mcp: ['smm_get_code_metrics'],
      },
    },
    target: {
      operator: 'custom',
      value: 'review',
      description: 'Review O(n^2+) hotspots',
    },
    sources: defaultSources,
  };

  withId(id: string): this {
    this.entry = { ...this.entry, id };
    return this;
  }

  withNamespace(namespace: MetricNamespace): this {
    this.entry = {
      ...this.entry,
      definition: { ...this.entry.definition, namespace },
    };
    return this;
  }

  withLabel(label: string): this {
    this.entry = {
      ...this.entry,
      definition: { ...this.entry.definition, label },
    };
    return this;
  }

  withDescription(description: string): this {
    this.entry = {
      ...this.entry,
      definition: { ...this.entry.definition, description },
    };
    return this;
  }

  withComputation(computation: MetricCatalogComputation): this {
    this.entry = {
      ...this.entry,
      definition: { ...this.entry.definition, computation },
    };
    return this;
  }

  withDirection(direction: MetricCatalogDirection): this {
    this.entry = {
      ...this.entry,
      definition: { ...this.entry.definition, direction },
    };
    return this;
  }

  withDefinition(definition: Partial<MetricCatalogDefinition>): this {
    this.entry = {
      ...this.entry,
      definition: { ...this.entry.definition, ...definition },
    };
    return this;
  }

  withTarget(target: MetricCatalogTarget | undefined): this {
    this.entry = { ...this.entry, target };
    return this;
  }

  withSources(sources: MetricCatalogSource[] | undefined): this {
    this.entry = { ...this.entry, sources };
    return this;
  }

  build(): MetricCatalogEntry {
    return this.entry;
  }
}

/** Minimal catalog used by tests that render a metric info tooltip. */
export function buildMetricCatalogFixture(): MetricCatalogEntry[] {
  return [new MetricCatalogEntryBuilder().build()];
}
