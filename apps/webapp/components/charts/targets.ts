export interface SourceEntry {
  label: string;
  url: string;
}

export interface TargetDefinition {
  target: string;
  description: string;
  sources: SourceEntry[];
}

export const METRIC_TARGETS: Record<string, TargetDefinition> = {
  'pairing-index': {
    target: '> 30%',
    description:
      'Higher paired commit percentage correlates with better knowledge sharing and bus factor resilience.',
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
  'deployment-frequency': {
    target: 'Daily (Elite)',
    description:
      'Elite deployments (multiple/day) are the top DORA benchmark for delivery performance.',
    sources: [
      {
        label: 'Forsgren, Humble & Kim (2018) — Accelerate: The Science of Lean Software and DevOps',
        url: 'https://itrevolution.com/product/accelerate/',
      },
      {
        label: 'DORA State of DevOps Report 2023 — Google Cloud',
        url: 'https://cloud.google.com/devops',
      },
    ],
  },
  'pipeline-duration': {
    target: '< 10 min',
    description:
      'Fast CI feedback is critical for developer productivity. Under 10 min correlates with elite delivery performance.',
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
  'job-avg-time': {
    target: '< 5 min',
    description:
      'Individual jobs should complete quickly to keep total pipeline under 10 minutes.',
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
  'job-reruns': {
    target: '0 reruns',
    description:
      'Reruns waste compute time and erode CI trust. Flaky tests are a primary cause.',
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
  'jobs-success-rate': {
    target: '> 90%',
    description:
      'A high success rate indicates stable pipelines. This maps to DORA low change failure rate.',
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
  'average-review-time': {
    target: '< 24 hours',
    description:
      'Elite teams review PRs within 24 hours. Longer times create delivery bottlenecks.',
    sources: [
      {
        label: 'Forsgren et al. (2018) — Accelerate review lead time benchmarks',
        url: 'https://itrevolution.com/product/accelerate/',
      },
      {
        label: 'Bacchelli & Bird (2013) — ICSE on expectations and challenges of modern code review',
        url: 'https://doi.org/10.1109/ICSE.2013.6606625',
      },
    ],
  },
  'time-to-first-comment': {
    target: '< 4 hours',
    description:
      'Quick first responses keep PR momentum. Delays reduce author productivity.',
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
  'prs-by-author': {
    target: 'Balanced distribution',
    description:
      'Over-reliance on a few authors creates bus-factor risk. Balanced contributions improve resilience.',
    sources: [
      {
        label: 'Avelino et al. (2016) — J. Brazilian Comp. Soc. truck factor analysis of GitHub projects',
        url: 'https://doi.org/10.1186/s13173-016-0046-1',
      },
      {
        label: 'Bird et al. (2011) — FSE on the effects of ownership on software quality',
        url: 'https://doi.org/10.1145/2025113.2025119',
      },
    ],
  },
  'prs-remain-open': {
    target: '< 3 days',
    description:
      'PRs open beyond 3 days slow delivery and increase merge conflicts.',
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
  'pr-statistics': {
    target: 'High merge rate',
    description:
      'A healthy process merges most PRs with constructive discussion. Stalled PRs signal process issues.',
    sources: [
      {
        label: 'Gousios et al. (2015) — ICSE integrator perspective on pull-based development',
        url: 'https://doi.org/10.1109/ICSE.2015.48',
      },
      {
        label: 'Sadowski et al. (2018) — ICSE SEIP case study on modern code review at Google',
        url: 'https://doi.org/10.1145/3183519.3183526',
      },
    ],
  },
  'most-commented-prs': {
    target: 'Monitor outliers',
    description:
      'Excessive comments may indicate unclear requirements or scope creep. Moderate discussion is healthy.',
    sources: [
      {
        label: 'Bacchelli & Bird (2013) — ICSE on expectations and challenges of modern code review',
        url: 'https://doi.org/10.1109/ICSE.2013.6606625',
      },
      {
        label: 'Bosu et al. (2015) — HICSS on code review quality and peer effects',
        url: 'https://scholar.google.com/scholar?q=code+review+quality+Bosu+HICSS+2015',
      },
    ],
  },
  'metric-outliers': {
    target: 'Investigate points outside IQR bounds',
    description:
      'Outliers in software delivery and code metrics can reveal quality risks, process instability, or exceptional events that deserve root-cause analysis.',
    sources: [
      {
        label: 'Kamei et al. (2013) — A Large-Scale Empirical Study of Just-In-Time Quality Assurance (IEEE TSE)',
        url: 'https://doi.org/10.1109/TSE.2012.70',
      },
      {
        label: 'Rahman & Devanbu (2013) — How, and Why, Process Metrics Are Better (ICSE)',
        url: 'https://scholar.google.com/scholar?q=How+and+Why+Process+Metrics+Are+Better+Rahman+Devanbu+ICSE+2013',
      },
      {
        label: 'Nagappan & Ball (2005) — Use of Relative Code Churn Measures to Predict System Defect Density (ICSE)',
        url: 'https://doi.org/10.1145/1062455.1062570',
      },
    ],
  },
  'comments-by-author': {
    target: 'Inclusive participation',
    description:
      'Code review should be a team-wide practice, not concentrated on one person.',
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
  'open-prs-through-time': {
    target: 'Opened ≈ Closed',
    description:
      'A growing gap between opened and closed PRs signals review bottlenecks.',
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
  'code-churn': {
    target: 'Consistent, moderate churn',
    description:
      'Stable churn rates indicate healthy evolution. Sudden spikes precede defect density increases.',
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
  'entity-churn': {
    target: 'Monitor hotspots',
    description:
      'Files with extreme churn are defect-prone hotspots needing refactoring.',
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
  'entity-effort': {
    target: 'Distributed effort',
    description:
      'Effort concentrated in a few files increases maintenance risk and defect density.',
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
  ownership: {
    target: 'Shared ownership (< 80% single owner)',
    description:
      'Files owned > 80% by one person are bus-factor risks. Shared ownership reduces defects.',
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
    target: '< 30% degree',
    description:
      'Highly coupled components require coordinated changes, increasing maintenance cost and defect risk.',
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
  'big-o-classification': {
    target: 'Review O(n^2+) hotspots',
    description:
      'Higher asymptotic complexity can become a scalability risk as input size grows. Prioritize files with high scores or polynomial classifications for performance review.',
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
  'sonarqube-reliability': {
    target: 'A (Rating 1)',
    description:
      'Rating A means zero bugs. Each bug escalates quality debt and risk.',
    sources: [
      {
        label: 'Letouzey & Coq (2010) — SQALE method for managing technical debt (ACM MTD Workshop)',
        url: 'https://doi.org/10.1145/1873323.1873339',
      },
      {
        label: 'ISO/IEC 25010 — Software product quality model (based on ISO/IEC 9126)',
        url: 'https://iso25000.com/index.php/en/iso-25000-standards/iso-25010',
      },
    ],
  },
  'sonarqube-security': {
    target: 'A (Rating 1)',
    description:
      'Security issues must be fixed with highest priority. Rating A means no vulnerabilities.',
    sources: [
      {
        label: 'OWASP Top 10 — Standard vulnerability awareness framework',
        url: 'https://owasp.org/Top10/',
      },
      {
        label: 'Letouzey & Coq (2010) — SQALE method for managing technical debt (ACM MTD Workshop)',
        url: 'https://doi.org/10.1145/1873323.1873339',
      },
    ],
  },
  'sonarqube-maintainability': {
    target: 'A (Rating 1)',
    description:
      'Low technical debt ensures sustainable development pace.',
    sources: [
      {
        label: 'Letouzey & Coq (2010) — SQALE method for managing technical debt (ACM MTD Workshop)',
        url: 'https://doi.org/10.1145/1873323.1873339',
      },
      {
        label: 'ISO/IEC 25010 — Software maintainability sub-characteristics model',
        url: 'https://iso25000.com/index.php/en/iso-25000-standards/iso-25010',
      },
    ],
  },
  'sonarqube-duplication': {
    target: '< 3%',
    description:
      'Duplication increases maintenance costs — each change must be replicated.',
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
  'sonarqube-coverage': {
    target: '> 80%',
    description:
      'Higher test coverage reduces post-release defect density significantly.',
    sources: [
      {
        label: 'Nagappan, Ball & Murphy (2009) — MSR Tech Report on coverage and post-release defects',
        url: 'https://www.microsoft.com/en-us/research/publication/test-coverage-and-post-release-defects-a-large-scale-empirical-study/',
      },
      {
        label: 'El Emam et al. (2001) — JSS validation of OO design metrics and defect prediction',
        url: 'https://doi.org/10.1016/S0164-1212(00)00104-7',
      },
    ],
  },
  'sonarqube-complexity': {
    target: '< 15 per component',
    description:
      'McCabe cyclomatic complexity < 15 is the widely accepted threshold. Higher values impede testability.',
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
  'sonarqube-measurements': {
    target: 'Improving trends',
    description:
      'Monitoring metric trends reveals emerging technical debt before it becomes critical.',
    sources: [
      {
        label: 'Letouzey & Coq (2010) — SQALE method for managing technical debt (ACM MTD Workshop)',
        url: 'https://doi.org/10.1145/1873323.1873339',
      },
      {
        label: 'Fowler (1999) — Refactoring: Improving the Design of Existing Code',
        url: 'https://www.amazon.com/dp/0201485672',
      },
    ],
  },
};
