import type { CatalogMetricId } from './metric-catalog';

/**
 * Curated reference metadata for catalogued metric families.
 *
 * Identity lives in `metric-catalog.ts`; this module holds the published
 * benchmarks and the external papers, reports and books behind them. Keeping
 * the evidence separate keeps the identity table readable while still making
 * the catalog the single source for ids.
 *
 * Only families with a documented benchmark appear here. Metrics without a
 * published reference keep their catalog entry and simply omit this block.
 */

export type MetricReferenceTargetOperator = 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'custom';

export interface MetricReferenceTarget {
  readonly operator: MetricReferenceTargetOperator;
  readonly value: number | string;
  readonly description: string;
}

export interface MetricReferenceSource {
  readonly label: string;
  readonly url: string;
}

export interface MetricReference {
  readonly target: MetricReferenceTarget;
  readonly sources: readonly MetricReferenceSource[];
}

export const METRIC_REFERENCES = {
  'code-pairing-index': {
    target: { operator: 'gt', value: 30, description: '> 30%' },
    sources: [
      {
        label: 'Cockburn & Williams (2001) — Pair Programming Illuminated',
        url: 'https://www.amazon.com/dp/0201713104',
      },
      {
        label: 'Hannay et al. (2009) — IEEE TSE meta-analysis of pair programming effectiveness',
        url: 'https://doi.org/10.1109/TSE.2009.35',
      },
    ],
  },
  'code-churn': {
    target: {
      operator: 'custom',
      value: 'Consistent, moderate churn',
      description: 'Consistent, moderate churn',
    },
    sources: [
      {
        label: 'Nagappan & Ball (2005) — ICSE on relative code churn as defect predictor',
        url: 'https://doi.org/10.1145/1062455.1062570',
      },
      {
        label: 'Hassan (2009) — ICSE on predicting faults using complexity of code changes',
        url: 'https://doi.org/10.1109/ICSE.2009.5070534',
      },
    ],
  },
  'code-entity-churn': {
    target: { operator: 'custom', value: 'Monitor hotspots', description: 'Monitor hotspots' },
    sources: [
      {
        label: 'Zimmermann et al. (2007) — ICSE on predicting defects from dependency networks',
        url: 'https://scholar.google.com/scholar?q=Predicting+defects+using+network+analysis+Zimmermann+ICSE+2007',
      },
      {
        label: 'Eaddy et al. (2008) — IEEE TSE on crosscutting concerns and defect density',
        url: 'https://doi.org/10.1109/TSE.2007.70768',
      },
    ],
  },
  'code-entity-effort': {
    target: { operator: 'custom', value: 'Distributed effort', description: 'Distributed effort' },
    sources: [
      {
        label: 'Hassan (2009) — ICSE on fault prediction using code change complexity',
        url: 'https://doi.org/10.1109/ICSE.2009.5070534',
      },
      {
        label: 'Mockus & Herbsleb (2002) — ICSE on expertise browser and ownership',
        url: 'https://doi.org/10.1145/581339.581407',
      },
    ],
  },
  'code-entity-ownership': {
    target: {
      operator: 'custom',
      value: 'Shared ownership (< 80% single owner)',
      description: 'Shared ownership (< 80% single owner)',
    },
    sources: [
      {
        label: 'Bird et al. (2011) — FSE on ownership and software quality',
        url: 'https://doi.org/10.1145/2025113.2025119',
      },
      {
        label: 'Greiler et al. (2015) — ICSE on knowledge loss in software teams',
        url: 'https://scholar.google.com/scholar?q=knowledge+loss+software+teams+Greiler+ICSE+2015',
      },
    ],
  },
  'code-coupling': {
    target: { operator: 'lt', value: 30, description: '< 30% degree' },
    sources: [
      {
        label: 'Yourdon & Constantine (1979) — Structured Design: coupling and cohesion principles',
        url: 'https://www.amazon.com/dp/0138544719',
      },
      {
        label: 'El Emam et al. (2001) — JSS validation of OO design metrics',
        url: 'https://doi.org/10.1016/S0164-1212(00)00104-7',
      },
    ],
  },
  'code-layered-coupling': {
    target: { operator: 'lt', value: 30, description: '< 30% degree across layers' },
    sources: [
      {
        label: 'Yourdon & Constantine (1979) — Structured Design: coupling and cohesion principles',
        url: 'https://www.amazon.com/dp/0138544719',
      },
      {
        label: 'El Emam et al. (2001) — JSS validation of OO design metrics',
        url: 'https://doi.org/10.1016/S0164-1212(00)00104-7',
      },
    ],
  },
  'code-big-o': {
    target: {
      operator: 'custom',
      value: 'Review O(n^2+) hotspots',
      description: 'Review O(n^2+) hotspots',
    },
    sources: [
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
    ],
  },
  'code-crap': {
    target: { operator: 'lte', value: 30, description: '<= 30' },
    sources: [
      {
        label: 'Alberto Savoia — The CRAP metric',
        url: 'https://www.artima.com/weblogs/viewpost.jsp?thread=215899',
      },
      { label: 'CRAP4J — Change Risk Analysis and Predictions', url: 'https://www.crap4j.org/' },
      {
        label: 'McCabe (1976) — IEEE TSE "A Complexity Measure"',
        url: 'https://doi.org/10.1109/TSE.1976.233837',
      },
    ],
  },
  'pl-deployment-frequency': {
    target: { operator: 'custom', value: 'Daily (Elite)', description: 'Daily (Elite)' },
    sources: [
      {
        label:
          'Forsgren, Humble & Kim (2018) — Accelerate: The Science of Lean Software and DevOps',
        url: 'https://itrevolution.com/product/accelerate/',
      },
      {
        label: 'DORA State of DevOps Report 2023 — Google Cloud',
        url: 'https://cloud.google.com/devops',
      },
    ],
  },
  'pl-run-duration': {
    target: { operator: 'lt', value: 10, description: '< 10 min' },
    sources: [
      {
        label: 'Forsgren et al. (2018) — Accelerate (Lead time elite benchmark: < 1 hour)',
        url: 'https://itrevolution.com/product/accelerate/',
      },
      {
        label: 'Vasilescu et al. (2015) — ESEC/FSE on CI quality and productivity outcomes',
        url: 'https://doi.org/10.1145/2786805.2786850',
      },
    ],
  },
  'pl-job-duration': {
    target: { operator: 'lt', value: 5, description: '< 5 min' },
    sources: [
      {
        label: 'Forsgren et al. (2018) — Accelerate DORA lead-time benchmarks',
        url: 'https://itrevolution.com/product/accelerate/',
      },
      {
        label: 'Hilton et al. (2016) — ICSE on continuous integration usage patterns',
        url: 'https://doi.org/10.1145/2884781.2884848',
      },
    ],
  },
  'pl-jobs-summary': {
    target: { operator: 'custom', value: '0 reruns', description: '0 reruns' },
    sources: [
      {
        label: 'Eck et al. (2019) — Empirical Software Engineering on flaky test impact on CI',
        url: 'https://scholar.google.com/scholar?q=How+flaky+tests+affect+CI+Eck+2019',
      },
      {
        label: 'Luo et al. (2014) — ICSE empirical analysis of flaky test causes',
        url: 'https://doi.org/10.1145/2591062.2591110',
      },
    ],
  },
  'pl-job-status-counts': {
    target: { operator: 'gt', value: 90, description: '> 90%' },
    sources: [
      {
        label: 'Forsgren et al. (2018) — Accelerate (Elite: change failure rate < 5%)',
        url: 'https://itrevolution.com/product/accelerate/',
      },
      {
        label: 'DORA 2021 State of DevOps Report — change failure rate benchmarks',
        url: 'https://cloud.google.com/devops',
      },
    ],
  },
  'cr-review-time': {
    target: { operator: 'lt', value: 24, description: '< 24 hours' },
    sources: [
      {
        label: 'Forsgren et al. (2018) — Accelerate review lead time benchmarks',
        url: 'https://itrevolution.com/product/accelerate/',
      },
      {
        label:
          'Bacchelli & Bird (2013) — ICSE on expectations and challenges of modern code review',
        url: 'https://doi.org/10.1109/ICSE.2013.6606625',
      },
    ],
  },
  'cr-first-comment-time': {
    target: { operator: 'lt', value: 4, description: '< 4 hours' },
    sources: [
      {
        label: 'Beller et al. (2014) — MSR on modern code review practices in open-source',
        url: 'https://scholar.google.com/scholar?q=Modern+code+reviews+in+open-source+projects+Beller+2014',
      },
      {
        label: 'Bacchelli & Bird (2013) — ICSE on modern code review expectations',
        url: 'https://doi.org/10.1109/ICSE.2013.6606625',
      },
    ],
  },
  'cr-volume-by-author': {
    target: {
      operator: 'custom',
      value: 'Balanced distribution',
      description: 'Balanced distribution',
    },
    sources: [
      {
        label:
          'Avelino et al. (2016) — J. Brazilian Comp. Soc. truck factor analysis of GitHub projects',
        url: 'https://doi.org/10.1186/s13173-016-0046-1',
      },
      {
        label: 'Bird et al. (2011) — FSE on the effects of ownership on software quality',
        url: 'https://doi.org/10.1145/2025113.2025119',
      },
    ],
  },
  'cr-open-time': {
    target: { operator: 'lt', value: 3, description: '< 3 days' },
    sources: [
      {
        label: 'Gousios et al. (2015) — ICSE on work practices in pull-based development',
        url: 'https://doi.org/10.1109/ICSE.2015.48',
      },
      {
        label: 'Yu et al. (2015) — ICSE on code review latency effects on quality',
        url: 'https://scholar.google.com/scholar?q=review+latency+and+quality+Yu+ICSE+2015',
      },
    ],
  },
  'cr-summary': {
    target: { operator: 'custom', value: 'High merge rate', description: 'High merge rate' },
    sources: [
      {
        label: 'Gousios et al. (2015) — ICSE integrator perspective on pull-based development',
        url: 'https://doi.org/10.1109/ICSE.2015.48',
      },
      {
        label: 'Sadowski et al. (2018) — ICSE SEIP case study on modern code review at Google',
        url: 'https://doi.org/10.1145/3183519.3183526',
      },
      {
        label:
          'Bacchelli & Bird (2013) — ICSE on expectations and challenges of modern code review',
        url: 'https://doi.org/10.1109/ICSE.2013.6606625',
      },
      {
        label: 'Bosu et al. (2015) — HICSS on code review quality and peer effects',
        url: 'https://scholar.google.com/scholar?q=code+review+quality+Bosu+HICSS+2015',
      },
    ],
  },
  'cr-comments-by-author': {
    target: {
      operator: 'custom',
      value: 'Inclusive participation',
      description: 'Inclusive participation',
    },
    sources: [
      {
        label: 'Sadowski et al. (2018) — ICSE SEIP Google code review culture study',
        url: 'https://doi.org/10.1145/3183519.3183526',
      },
      {
        label: 'Rigby et al. (2008) — ICSE on open source peer review patterns',
        url: 'https://scholar.google.com/scholar?q=Open+source+peer+review+patterns+Rigby+ICSE+2008',
      },
    ],
  },
  'cr-throughput': {
    target: { operator: 'custom', value: 'Opened ≈ Closed', description: 'Opened ≈ Closed' },
    sources: [
      {
        label: 'Gousios et al. (2015) — ICSE on pull request dynamics and practices',
        url: 'https://doi.org/10.1109/ICSE.2015.48',
      },
      {
        label: 'Vasilescu et al. (2015) — ESEC/FSE on CI quality and productivity outcomes',
        url: 'https://doi.org/10.1145/2786805.2786850',
      },
    ],
  },
  'sq-reliability-rating': {
    target: { operator: 'custom', value: 'A (Rating 1)', description: 'A (Rating 1)' },
    sources: [
      {
        label:
          'Letouzey & Coq (2010) — SQALE method for managing technical debt (ACM MTD Workshop)',
        url: 'https://doi.org/10.1145/1873323.1873339',
      },
      {
        label: 'ISO/IEC 25010 — Software product quality model (based on ISO/IEC 9126)',
        url: 'https://iso25000.com/index.php/en/iso-25000-standards/iso-25010',
      },
    ],
  },
  'sq-security-rating': {
    target: { operator: 'custom', value: 'A (Rating 1)', description: 'A (Rating 1)' },
    sources: [
      {
        label: 'OWASP Top 10 — Standard vulnerability awareness framework',
        url: 'https://owasp.org/Top10/',
      },
      {
        label:
          'Letouzey & Coq (2010) — SQALE method for managing technical debt (ACM MTD Workshop)',
        url: 'https://doi.org/10.1145/1873323.1873339',
      },
    ],
  },
  'sq-maintainability-rating': {
    target: { operator: 'custom', value: 'A (Rating 1)', description: 'A (Rating 1)' },
    sources: [
      {
        label:
          'Letouzey & Coq (2010) — SQALE method for managing technical debt (ACM MTD Workshop)',
        url: 'https://doi.org/10.1145/1873323.1873339',
      },
      {
        label: 'ISO/IEC 25010 — Software maintainability sub-characteristics model',
        url: 'https://iso25000.com/index.php/en/iso-25000-standards/iso-25010',
      },
    ],
  },
  'sq-duplication-density': {
    target: { operator: 'lt', value: 3, description: '< 3%' },
    sources: [
      {
        label: 'Juergens et al. (2009) — ICSE on "do code clones matter?"',
        url: 'https://doi.org/10.1109/ICSE.2009.5070531',
      },
      {
        label: 'Roy et al. (2009) — Science of Computer Programming on clone detection evaluation',
        url: 'https://doi.org/10.1016/j.scico.2008.09.003',
      },
    ],
  },
  'sq-coverage': {
    target: { operator: 'gt', value: 80, description: '> 80%' },
    sources: [
      {
        label:
          'Nagappan, Ball & Murphy (2009) — MSR Tech Report on coverage and post-release defects',
        url: 'https://www.microsoft.com/en-us/research/publication/test-coverage-and-post-release-defects-a-large-scale-empirical-study/',
      },
      {
        label: 'El Emam et al. (2001) — JSS validation of OO design metrics and defect prediction',
        url: 'https://doi.org/10.1016/S0164-1212(00)00104-7',
      },
    ],
  },
  'sq-complexity': {
    target: { operator: 'lt', value: 15, description: '< 15 per component' },
    sources: [
      {
        label: 'McCabe (1976) — IEEE TSE "A Complexity Measure" (origin of cyclomatic complexity)',
        url: 'https://doi.org/10.1109/TSE.1976.233837',
      },
      {
        label: 'Basili et al. (1995) — IEEE TSE validation of OO metrics as quality indicators',
        url: 'https://scholar.google.com/scholar?q=Validation+of+object-oriented+design+metrics+Basili+1995',
      },
      {
        label: 'McConnell (2004) — Code Complete (recommends complexity < 15)',
        url: 'https://www.amazon.com/dp/0735619670',
      },
    ],
  },
  'sq-measurements': {
    target: { operator: 'custom', value: 'Improving trends', description: 'Improving trends' },
    sources: [
      {
        label:
          'Letouzey & Coq (2010) — SQALE method for managing technical debt (ACM MTD Workshop)',
        url: 'https://doi.org/10.1145/1873323.1873339',
      },
      {
        label: 'Fowler (1999) — Refactoring: Improving the Design of Existing Code',
        url: 'https://www.amazon.com/dp/0201485672',
      },
    ],
  },
} as const satisfies Partial<Record<CatalogMetricId, MetricReference>>;

export function getMetricReference(id: CatalogMetricId): MetricReference | undefined {
  return METRIC_REFERENCES[id as keyof typeof METRIC_REFERENCES];
}
