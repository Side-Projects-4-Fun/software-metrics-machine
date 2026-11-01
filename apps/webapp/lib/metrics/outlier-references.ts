import type { MetricCatalogSource } from './metric-catalog';

/**
 * Outlier detection is a cross-cutting analysis, not a catalogued metric
 * family, so its explanation and sources live with the webapp.
 */
export const OUTLIER_REFERENCE: {
  target: string;
  description: string;
  sources: MetricCatalogSource[];
} = {
  target: 'Investigate points outside IQR bounds',
  description:
    'Outliers in software delivery and code metrics can reveal quality risks, process instability, or exceptional events that deserve root-cause analysis.',
  sources: [
    {
      label:
        'Kamei et al. (2013) — A Large-Scale Empirical Study of Just-In-Time Quality Assurance (IEEE TSE)',
      url: 'https://doi.org/10.1109/TSE.2012.70',
    },
    {
      label:
        'Rahman & Devanbu (2013) — How, and Why, Process Metrics Are Better (ICSE)',
      url: 'https://scholar.google.com/scholar?q=How+and+Why+Process+Metrics+Are+Better+Rahman+Devanbu+ICSE+2013',
    },
    {
      label:
        'Nagappan & Ball (2005) — Use of Relative Code Churn Measures to Predict System Defect Density (ICSE)',
      url: 'https://doi.org/10.1145/1062455.1062570',
    },
  ],
};
