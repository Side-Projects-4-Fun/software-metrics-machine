/**
 * Static catalog of every metric type exposed by the application.
 *
 * Identity rules:
 * - An ID names a metric family, not a single number. Statistical method,
 *   aggregation period, and scope are parameters of that family.
 * - IDs are public API: never rename one. Deprecate it and point `replacedBy`
 *   at its successor instead.
 * - IDs are explicit strings and are never derived from class, file, or
 *   command names.
 */
export const METRIC_NAMESPACES = ['cr', 'pl', 'code', 'sq', 'arch', 'issue', 'eh'] as const;

export type MetricNamespace = (typeof METRIC_NAMESPACES)[number];

export type MetricShape = 'scalar' | 'series' | 'distribution' | 'record' | 'table' | 'graph';

export type MetricCatalogDirection = 'higher_is_better' | 'lower_is_better' | 'neutral';

export const METRIC_VISIBILITIES = ['public', 'internal'] as const;

export type MetricVisibility = (typeof METRIC_VISIBILITIES)[number];

export type MetricStatus = 'active' | 'deprecated';

export interface MetricSurfaces {
  readonly cli?: readonly string[];
  readonly rest?: readonly string[];
  readonly mcp?: readonly string[];
}

export interface MetricDefinition {
  readonly namespace: MetricNamespace;
  readonly label: string;
  readonly description: string;
  readonly unit: string;
  readonly direction: MetricCatalogDirection;
  readonly shape: MetricShape;
  readonly visibility: MetricVisibility;
  readonly status: MetricStatus;
  readonly replacedBy?: string;
  readonly surfaces: MetricSurfaces;
}

export const METRIC_CATALOG = {
  // ─────────────────────────────────────────────────────────────────────────
  // Change requests
  // ─────────────────────────────────────────────────────────────────────────
  'cr-summary': {
    namespace: 'cr',
    label: 'Change request summary',
    description:
      'Totals, merged/open/closed counts, comments per change request, unique authors and labels, and time to first comment.',
    unit: 'record',
    direction: 'neutral',
    shape: 'record',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['change-requests summary'],
      rest: ['/change-requests/summary'],
      mcp: ['smm_get_change_request_summary'],
    },
  },
  'cr-metrics': {
    namespace: 'cr',
    label: 'Change request metrics',
    description:
      'Aggregate change request metrics for the selected window: open days, comments, lead time, and label and comment summaries.',
    unit: 'record',
    direction: 'neutral',
    shape: 'record',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/api/metrics/change-requests'],
      mcp: ['smm_get_change_request_metrics'],
    },
  },
  'cr-throughput': {
    namespace: 'cr',
    label: 'Change request throughput',
    description: 'Change requests opened and closed per day, week, or month.',
    unit: 'count',
    direction: 'neutral',
    shape: 'series',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['change-requests through-time'],
      rest: ['/change-requests/through-time'],
      mcp: ['smm_get_change_request_through_time'],
    },
  },
  'cr-volume-by-author': {
    namespace: 'cr',
    label: 'Change request volume by author',
    description: 'Change request count grouped by author.',
    unit: 'count',
    direction: 'neutral',
    shape: 'table',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['change-requests by-author'],
      rest: ['/change-requests/by-author'],
      mcp: ['smm_get_change_request_by_author'],
    },
  },
  'cr-review-time': {
    namespace: 'cr',
    label: 'Review time',
    description:
      'Days from change request creation to review, per author, using the selected statistical method.',
    unit: 'days',
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
  'cr-open-time': {
    namespace: 'cr',
    label: 'Open time',
    description:
      'Days a change request stays open, grouped by day, week, or month, using the selected statistical method.',
    unit: 'days',
    direction: 'lower_is_better',
    shape: 'distribution',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['change-requests open-time'],
      rest: ['/change-requests/open-time'],
      mcp: ['smm_get_change_request_open_time'],
    },
  },
  'cr-comments-per-cr': {
    namespace: 'cr',
    label: 'Comments per change request',
    description:
      'Number of comments per change request, using the selected statistical method and optional aggregation period.',
    unit: 'count',
    direction: 'higher_is_better',
    shape: 'distribution',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['change-requests comments'],
      rest: ['/change-requests/comments'],
      mcp: ['smm_get_change_request_comments'],
    },
  },
  'cr-comments-by-author': {
    namespace: 'cr',
    label: 'Comments by reviewer',
    description: 'Comment volume grouped by reviewer.',
    unit: 'count',
    direction: 'neutral',
    shape: 'table',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/change-requests/comments-by-author'],
      mcp: ['smm_get_change_request_comments_by_author'],
    },
  },
  'cr-first-comment-time': {
    namespace: 'cr',
    label: 'Time to first comment',
    description: 'Hours from change request creation to its first comment, per author.',
    unit: 'hours',
    direction: 'lower_is_better',
    shape: 'distribution',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/change-requests/first-comment-time'],
      mcp: ['smm_get_change_request_first_comment_time'],
    },
  },
  'cr-metrics-by-week': {
    namespace: 'cr',
    label: 'Change requests by week',
    description:
      'Change request metrics grouped by week: totals, merged/closed/open counts, comments, open days, and lead time.',
    unit: 'record',
    direction: 'neutral',
    shape: 'table',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['change-requests by-week'],
      mcp: ['smm_get_change_request_metrics_by_week'],
    },
  },
  'cr-metrics-by-month': {
    namespace: 'cr',
    label: 'Change requests by month',
    description:
      'Change request metrics grouped by month: totals, merged/closed/open counts, comments, open days, and lead time.',
    unit: 'record',
    direction: 'neutral',
    shape: 'table',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['change-requests by-month'],
      mcp: ['smm_get_change_request_metrics_by_month'],
    },
  },
  'cr-label-summary': {
    namespace: 'cr',
    label: 'Change request labels',
    description: 'Change request count per label. Embedded in the change request summary.',
    unit: 'count',
    direction: 'neutral',
    shape: 'table',
    visibility: 'internal',
    status: 'active',
    surfaces: {},
  },
  'cr-evaluation': {
    namespace: 'cr',
    label: 'Change request bottleneck evaluation',
    description:
      'Bottleneck signals covering review time, reviewer workload, open time, throughput, first comment, and comment health.',
    unit: 'record',
    direction: 'neutral',
    shape: 'record',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/change-requests/evaluate'],
      mcp: ['smm_evaluate_change_requests'],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Pipelines
  // ─────────────────────────────────────────────────────────────────────────
  'pl-summary': {
    namespace: 'pl',
    label: 'Pipeline summary',
    description:
      'Run totals by conclusion, in-progress and queued counts, success rate, and aggregate duration.',
    unit: 'record',
    direction: 'neutral',
    shape: 'record',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['pipelines summary'],
      rest: ['/pipelines/summary', '/pipelines/dashboard', '/api/metrics/deployment'],
      mcp: ['smm_get_pipeline_dashboard', 'smm_get_deployment_metrics'],
    },
  },
  'pl-status-counts': {
    namespace: 'pl',
    label: 'Runs by status',
    description: 'Pipeline run count grouped by conclusion.',
    unit: 'count',
    direction: 'neutral',
    shape: 'table',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['pipelines by-status'],
      rest: ['/pipelines/by-status'],
    },
  },
  'pl-job-status-counts': {
    namespace: 'pl',
    label: 'Jobs by status',
    description: 'Pipeline job count grouped by status.',
    unit: 'count',
    direction: 'neutral',
    shape: 'table',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['pipelines jobs-by-status'],
      rest: ['/pipelines/jobs-by-status'],
    },
  },
  'pl-run-duration': {
    namespace: 'pl',
    label: 'Run duration',
    description:
      'Pipeline run duration with minimum, maximum, and selected statistical aggregation.',
    unit: 'minutes',
    direction: 'lower_is_better',
    shape: 'distribution',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['pipelines runs-duration'],
      rest: ['/pipelines/runs-duration'],
    },
  },
  'pl-runs-over-time': {
    namespace: 'pl',
    label: 'Runs over time',
    description: 'Pipeline run count per period and workflow.',
    unit: 'count',
    direction: 'neutral',
    shape: 'series',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['pipelines runs-by'],
      rest: ['/pipelines/runs-by'],
    },
  },
  'pl-jobs-summary': {
    namespace: 'pl',
    label: 'Job summary',
    description:
      'Per-job run counts, success and failure rates, rerun counts, and duration statistics.',
    unit: 'record',
    direction: 'neutral',
    shape: 'table',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['pipelines jobs-summary'],
      rest: ['/pipelines/jobs-summary', '/api/metrics/deployment'],
      mcp: ['smm_get_deployment_metrics'],
    },
  },
  'pl-job-duration': {
    namespace: 'pl',
    label: 'Job execution time',
    description: 'Pipeline job execution duration using the selected statistical method.',
    unit: 'minutes',
    direction: 'lower_is_better',
    shape: 'distribution',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['pipelines jobs-time-execution'],
      rest: ['/pipelines/jobs-time-execution'],
    },
  },
  'pl-job-duration-by-day': {
    namespace: 'pl',
    label: 'Job time by day',
    description: 'Daily pipeline job execution duration series.',
    unit: 'minutes',
    direction: 'lower_is_better',
    shape: 'series',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/pipelines/jobs-time-execution-by-day'],
    },
  },
  'pl-job-steps-duration': {
    namespace: 'pl',
    label: 'Job step execution time',
    description: 'Pipeline job step duration using the selected statistical method.',
    unit: 'minutes',
    direction: 'lower_is_better',
    shape: 'distribution',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['pipelines jobs-steps-time'],
      rest: ['/pipelines/jobs-steps-time'],
    },
  },
  'pl-job-steps-duration-by-day': {
    namespace: 'pl',
    label: 'Job step time by day',
    description: 'Daily pipeline job step duration series.',
    unit: 'minutes',
    direction: 'lower_is_better',
    shape: 'series',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/pipelines/jobs-steps-time-by-day'],
    },
  },
  'pl-reruns-by-day': {
    namespace: 'pl',
    label: 'Reruns by day',
    description: 'Daily pipeline job rerun count.',
    unit: 'count',
    direction: 'lower_is_better',
    shape: 'series',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/pipelines/jobs-reruns-by-day'],
    },
  },
  'pl-jobs-duration-by-workflow': {
    namespace: 'pl',
    label: 'Job duration by workflow',
    description: 'Pipeline job duration grouped by workflow.',
    unit: 'minutes',
    direction: 'lower_is_better',
    shape: 'table',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/pipelines/jobs-duration-by-workflow'],
    },
  },
  'pl-deployment-frequency': {
    namespace: 'pl',
    label: 'Deployment frequency',
    description: 'DORA deployment frequency measured per day, week, and month.',
    unit: 'deployments/period',
    direction: 'higher_is_better',
    shape: 'series',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['pipelines deployment-frequency'],
      rest: ['/dora/deployment-frequency', '/api/metrics/deployment'],
      mcp: ['smm_get_dora_metrics', 'smm_get_deployment_metrics'],
    },
  },
  'pl-lead-time': {
    namespace: 'pl',
    label: 'Lead time for changes',
    description: 'DORA lead time for changes, in minutes.',
    unit: 'minutes',
    direction: 'lower_is_better',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['pipelines lead-time'],
      mcp: ['smm_get_dora_metrics'],
    },
  },
  'pl-evaluation': {
    namespace: 'pl',
    label: 'Pipeline bottleneck evaluation',
    description:
      'Bottleneck signals covering job duration, stability, reruns, slowest workflow, and job overview.',
    unit: 'record',
    direction: 'neutral',
    shape: 'record',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/pipelines/evaluate'],
      mcp: ['smm_evaluate_pipelines'],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Code
  // ─────────────────────────────────────────────────────────────────────────
  'code-big-o': {
    namespace: 'code',
    label: 'Big O complexity',
    description:
      'Per-file algorithmic complexity classification, score, and whether the file needs performance attention.',
    unit: 'classification',
    direction: 'lower_is_better',
    shape: 'table',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['code big-o'],
      rest: ['/code/big-o', '/code/big-o/file'],
      mcp: ['smm_list_big_o_files', 'smm_analyze_big_o_file'],
    },
  },
  'code-summary': {
    namespace: 'code',
    label: 'Code summary',
    description: 'Code overview with developer pairing insights.',
    unit: 'record',
    direction: 'neutral',
    shape: 'record',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['code summary'],
      rest: ['/api/metrics/code'],
      mcp: ['smm_get_code_metrics'],
    },
  },
  'code-churn': {
    namespace: 'code',
    label: 'Code churn',
    description: 'Commits, lines added, lines deleted, and total churn over time.',
    unit: 'lines',
    direction: 'neutral',
    shape: 'series',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['code churn'],
      rest: ['/code/code-churn', '/api/metrics/code'],
      mcp: ['smm_get_code_churn', 'smm_get_code_metrics'],
    },
  },
  'code-author-churn': {
    namespace: 'code',
    label: 'Churn by author',
    description: 'Lines added, lines deleted, and commit count per author.',
    unit: 'lines',
    direction: 'neutral',
    shape: 'table',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['code churn'],
    },
  },
  'code-coupling': {
    namespace: 'code',
    label: 'File coupling',
    description: 'Coupling degree and average revisions between file pairs.',
    unit: 'ratio',
    direction: 'lower_is_better',
    shape: 'table',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['code coupling'],
      rest: ['/code/coupling', '/api/metrics/code'],
      mcp: ['smm_get_code_coupling', 'smm_get_code_metrics'],
    },
  },
  'code-layered-coupling': {
    namespace: 'code',
    label: 'Layered coupling',
    description: 'Coupling between architectural layers.',
    unit: 'ratio',
    direction: 'lower_is_better',
    shape: 'table',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/code/layered-coupling'],
      mcp: ['smm_get_code_layered_coupling'],
    },
  },
  'code-entity-churn': {
    namespace: 'code',
    label: 'Entity churn',
    description: 'Lines added, lines deleted, and commit count per entity.',
    unit: 'lines',
    direction: 'neutral',
    shape: 'table',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['code entity-churn'],
      rest: ['/code/entity-churn'],
      mcp: ['smm_get_code_entity_churn'],
    },
  },
  'code-entity-effort': {
    namespace: 'code',
    label: 'Entity effort',
    description: 'Revision count per entity, used as an effort proxy.',
    unit: 'revisions',
    direction: 'neutral',
    shape: 'table',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['code entity-effort'],
      rest: ['/code/entity-effort'],
      mcp: ['smm_get_code_entity_effort'],
    },
  },
  'code-entity-ownership': {
    namespace: 'code',
    label: 'Entity ownership',
    description: 'Lines added and deleted per author for each entity.',
    unit: 'lines',
    direction: 'neutral',
    shape: 'table',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['code entity-ownership'],
      rest: ['/code/entity-ownership'],
      mcp: ['smm_get_code_entity_ownership'],
    },
  },
  'code-pairing-index': {
    namespace: 'code',
    label: 'Pairing index',
    description:
      'Percentage of commits with co-authors, paired commit count, and the most frequent pairs.',
    unit: 'percent',
    direction: 'higher_is_better',
    shape: 'record',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['code pairing-index'],
      rest: ['/code/pairing-index'],
      mcp: ['smm_get_code_pairing_index'],
    },
  },
  'code-crap': {
    namespace: 'code',
    label: 'CRAP score',
    description: 'Change risk anti-pattern score derived from complexity and coverage per file.',
    unit: 'score',
    direction: 'lower_is_better',
    shape: 'table',
    visibility: 'internal',
    status: 'active',
    surfaces: {},
  },
  'code-churn-history': {
    namespace: 'code',
    label: 'Code churn history',
    description: 'Timestamped code churn series.',
    unit: 'series',
    direction: 'neutral',
    shape: 'series',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/code/code-churn/history'],
      mcp: ['smm_get_code_churn_history'],
    },
  },
  'code-coupling-history': {
    namespace: 'code',
    label: 'File coupling history',
    description: 'Timestamped file coupling series.',
    unit: 'series',
    direction: 'lower_is_better',
    shape: 'series',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/code/coupling/history'],
      mcp: ['smm_get_code_coupling_history'],
    },
  },
  'code-layered-coupling-history': {
    namespace: 'code',
    label: 'Layered coupling history',
    description: 'Timestamped layered coupling series.',
    unit: 'series',
    direction: 'lower_is_better',
    shape: 'series',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/code/layered-coupling/history'],
      mcp: ['smm_get_code_layered_coupling_history'],
    },
  },
  'code-entity-churn-history': {
    namespace: 'code',
    label: 'Entity churn history',
    description: 'Timestamped entity churn series.',
    unit: 'series',
    direction: 'neutral',
    shape: 'series',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/code/entity-churn/history'],
      mcp: ['smm_get_code_entity_churn_history'],
    },
  },
  'code-entity-effort-history': {
    namespace: 'code',
    label: 'Entity effort history',
    description: 'Timestamped entity effort series.',
    unit: 'series',
    direction: 'neutral',
    shape: 'series',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/code/entity-effort/history'],
      mcp: ['smm_get_code_entity_effort_history'],
    },
  },
  'code-entity-ownership-history': {
    namespace: 'code',
    label: 'Entity ownership history',
    description: 'Timestamped entity ownership series.',
    unit: 'series',
    direction: 'neutral',
    shape: 'series',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/code/entity-ownership/history'],
      mcp: ['smm_get_code_entity_ownership_history'],
    },
  },
  'code-evaluation': {
    namespace: 'code',
    label: 'Code evaluation',
    description:
      'Code signals covering churn hotspots, churn trend, coupling, ownership concentration, complexity, Big O, and pairing.',
    unit: 'record',
    direction: 'neutral',
    shape: 'record',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/code/evaluate'],
      mcp: ['smm_evaluate_code'],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Quality (SonarQube)
  // ─────────────────────────────────────────────────────────────────────────
  'sq-coverage': {
    namespace: 'sq',
    label: 'Coverage',
    description: 'Line coverage measured by SonarQube. Embedded in the change request summary.',
    unit: 'percent',
    direction: 'higher_is_better',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['sonarqube fetch-measures'],
      rest: ['/sonarqube/quality'],
      mcp: ['smm_get_quality_metrics'],
    },
  },
  'sq-maintainability-rating': {
    namespace: 'sq',
    label: 'Maintainability rating',
    description: 'SonarQube maintainability rating (sqale_rating).',
    unit: 'rating',
    direction: 'higher_is_better',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['sonarqube fetch-measures'],
      rest: ['/sonarqube/quality'],
      mcp: ['smm_get_quality_metrics'],
    },
  },
  'sq-reliability-rating': {
    namespace: 'sq',
    label: 'Reliability rating',
    description: 'SonarQube reliability rating.',
    unit: 'rating',
    direction: 'higher_is_better',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/sonarqube/evaluate'],
      mcp: ['smm_evaluate_quality'],
    },
  },
  'sq-security-rating': {
    namespace: 'sq',
    label: 'Security rating',
    description: 'SonarQube security rating.',
    unit: 'rating',
    direction: 'higher_is_better',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/sonarqube/evaluate'],
      mcp: ['smm_evaluate_quality'],
    },
  },
  'sq-complexity': {
    namespace: 'sq',
    label: 'Complexity',
    description: 'Total cyclomatic complexity measured by SonarQube.',
    unit: 'score',
    direction: 'lower_is_better',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['sonarqube fetch-measures'],
      rest: ['/sonarqube/quality'],
      mcp: ['smm_get_quality_metrics'],
    },
  },
  'sq-cognitive-complexity': {
    namespace: 'sq',
    label: 'Cognitive complexity',
    description: 'Per-component cognitive complexity from the SonarQube component tree.',
    unit: 'score',
    direction: 'lower_is_better',
    shape: 'table',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['sonarqube fetch-component-tree'],
      rest: ['/sonarqube/component-tree'],
      mcp: ['smm_get_sonarqube_component_tree'],
    },
  },
  'sq-duplication-density': {
    namespace: 'sq',
    label: 'Duplication density',
    description: 'Percentage of duplicated lines measured by SonarQube.',
    unit: 'percent',
    direction: 'lower_is_better',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['sonarqube fetch-measures'],
      rest: ['/sonarqube/quality'],
      mcp: ['smm_get_quality_metrics'],
    },
  },
  'sq-ncloc': {
    namespace: 'sq',
    label: 'Non-commenting lines of code',
    description: 'Non-commenting lines of code measured by SonarQube.',
    unit: 'lines',
    direction: 'neutral',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['sonarqube fetch-measures'],
      rest: ['/sonarqube/quality'],
      mcp: ['smm_get_quality_metrics'],
    },
  },
  'sq-code-smells': {
    namespace: 'sq',
    label: 'Code smells',
    description: 'Code smell count measured by SonarQube.',
    unit: 'count',
    direction: 'lower_is_better',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['sonarqube fetch-measures'],
      rest: ['/sonarqube/quality'],
      mcp: ['smm_get_quality_metrics'],
    },
  },
  'sq-bugs': {
    namespace: 'sq',
    label: 'Bugs',
    description: 'Bug count measured by SonarQube.',
    unit: 'count',
    direction: 'lower_is_better',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['sonarqube fetch-measures'],
      rest: ['/sonarqube/quality'],
      mcp: ['smm_get_quality_metrics'],
    },
  },
  'sq-component-tree': {
    namespace: 'sq',
    label: 'Component tree',
    description:
      'Per-component SonarQube measures including complexity, size, rating, and coverage.',
    unit: 'record',
    direction: 'neutral',
    shape: 'table',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['sonarqube fetch-component-tree'],
      rest: ['/sonarqube/component-tree'],
      mcp: ['smm_get_sonarqube_component_tree'],
    },
  },
  'sq-component-tree-history': {
    namespace: 'sq',
    label: 'Component tree history',
    description: 'Timestamped SonarQube component tree entries.',
    unit: 'series',
    direction: 'neutral',
    shape: 'series',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/sonarqube/component-tree/history'],
      mcp: ['smm_get_sonarqube_component_tree_history'],
    },
  },
  'sq-measurements': {
    namespace: 'sq',
    label: 'SonarQube measurements',
    description: 'Raw SonarQube measure set for the project.',
    unit: 'record',
    direction: 'neutral',
    shape: 'table',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/sonarqube/measurements', '/api/metrics/quality'],
      mcp: ['smm_get_sonarqube_measurements'],
    },
  },
  'sq-measurements-history': {
    namespace: 'sq',
    label: 'Measurements history',
    description: 'Timestamped SonarQube measure entries.',
    unit: 'series',
    direction: 'neutral',
    shape: 'series',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['sonarqube fetch-historical-measures'],
      rest: ['/sonarqube/measurements/history'],
      mcp: ['smm_get_sonarqube_measurements_history'],
    },
  },
  'sq-evaluation': {
    namespace: 'sq',
    label: 'Quality evaluation',
    description:
      'Quality signals covering reliability, security, maintainability, duplication, coverage, and complexity outliers.',
    unit: 'record',
    direction: 'neutral',
    shape: 'record',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/sonarqube/evaluate'],
      mcp: ['smm_evaluate_quality'],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Architecture
  // ─────────────────────────────────────────────────────────────────────────
  'arch-snapshot': {
    namespace: 'arch',
    label: 'Architecture snapshot',
    description: 'Persisted architecture snapshot metadata.',
    unit: 'record',
    direction: 'neutral',
    shape: 'record',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['architecture generate', 'architecture list-snapshots'],
      rest: ['/architecture/snapshots'],
      mcp: ['smm_list_architecture_snapshots'],
    },
  },
  'arch-summary': {
    namespace: 'arch',
    label: 'Architecture summary',
    description: 'Container, edge, confidence, orphan, and hub summaries for a snapshot.',
    unit: 'record',
    direction: 'neutral',
    shape: 'record',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/architecture/summary'],
      mcp: ['smm_get_architecture_summary'],
    },
  },
  'arch-view': {
    namespace: 'arch',
    label: 'Architecture view',
    description: 'C4 context, container, component, or code view with nodes and relationships.',
    unit: 'graph',
    direction: 'neutral',
    shape: 'graph',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['architecture export'],
      rest: ['/architecture/view'],
      mcp: ['smm_get_architecture_view', 'smm_export_architecture_view'],
    },
  },
  'arch-container-count': {
    namespace: 'arch',
    label: 'Container count',
    description: 'Number of containers in the architecture snapshot.',
    unit: 'count',
    direction: 'neutral',
    shape: 'scalar',
    visibility: 'internal',
    status: 'active',
    surfaces: {},
  },
  'arch-dependency-concentration': {
    namespace: 'arch',
    label: 'Dependency concentration',
    description: 'Concentration of relationships around a small set of dependencies.',
    unit: 'ratio',
    direction: 'lower_is_better',
    shape: 'scalar',
    visibility: 'internal',
    status: 'active',
    surfaces: {},
  },
  'arch-hub-dependency': {
    namespace: 'arch',
    label: 'Hub dependency',
    description: 'The architecture node with the most incoming dependencies.',
    unit: 'node',
    direction: 'neutral',
    shape: 'scalar',
    visibility: 'internal',
    status: 'active',
    surfaces: {},
  },
  'arch-orphan-nodes': {
    namespace: 'arch',
    label: 'Orphan nodes',
    description: 'Architecture nodes that have no relationships.',
    unit: 'count',
    direction: 'lower_is_better',
    shape: 'scalar',
    visibility: 'internal',
    status: 'active',
    surfaces: {},
  },
  'arch-confidence-health': {
    namespace: 'arch',
    label: 'Relationship confidence',
    description: 'Average confidence of detected architecture relationships.',
    unit: 'ratio',
    direction: 'higher_is_better',
    shape: 'scalar',
    visibility: 'internal',
    status: 'active',
    surfaces: {},
  },
  'arch-evaluation': {
    namespace: 'arch',
    label: 'Architecture evaluation',
    description:
      'Architecture signals covering container count, dependency concentration, hub dependency, orphan nodes, and confidence.',
    unit: 'record',
    direction: 'neutral',
    shape: 'record',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/architecture/evaluate'],
      mcp: ['smm_evaluate_architecture'],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Issues (Jira)
  // ─────────────────────────────────────────────────────────────────────────
  'issue-total': {
    namespace: 'issue',
    label: 'Issue count',
    description: 'Total Jira issues for the selected window and status filter.',
    unit: 'count',
    direction: 'neutral',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      rest: ['/api/metrics/issues'],
      mcp: ['smm_get_issue_metrics'],
    },
  },
  'issue-list': {
    namespace: 'issue',
    label: 'Issue records',
    description: 'Raw Jira issue records backing the issue count.',
    unit: 'rows',
    direction: 'neutral',
    shape: 'table',
    visibility: 'internal',
    status: 'active',
    surfaces: {},
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Engineering health
  // ─────────────────────────────────────────────────────────────────────────
  'deployment-frequency': {
    namespace: 'eh',
    label: 'Deployment frequency',
    description:
      'Successful deployments per selected period for each configured deployment target.',
    unit: 'deployments/period',
    direction: 'higher_is_better',
    shape: 'series',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['engineering-health evaluate'],
      rest: ['/engineering-health/evaluate'],
      mcp: ['smm_get_engineering_health'],
    },
  },
  'lead-time': {
    namespace: 'eh',
    label: 'Lead time',
    description: 'Time from change creation to deployment.',
    unit: 'minutes',
    direction: 'lower_is_better',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['engineering-health evaluate'],
      rest: ['/engineering-health/evaluate'],
      mcp: ['smm_get_engineering_health'],
    },
  },
  'pipeline-duration': {
    namespace: 'eh',
    label: 'Pipeline duration',
    description: 'Average pipeline run duration.',
    unit: 'minutes',
    direction: 'lower_is_better',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['engineering-health evaluate'],
      rest: ['/engineering-health/evaluate'],
      mcp: ['smm_get_engineering_health'],
    },
  },
  'failure-rate': {
    namespace: 'eh',
    label: 'Failure rate',
    description: 'Percentage of failed pipeline runs.',
    unit: 'percent',
    direction: 'lower_is_better',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['engineering-health evaluate'],
      rest: ['/engineering-health/evaluate'],
      mcp: ['smm_get_engineering_health'],
    },
  },
  complexity: {
    namespace: 'eh',
    label: 'Complexity',
    description: 'Total complexity reported by SonarQube.',
    unit: 'score',
    direction: 'lower_is_better',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['engineering-health evaluate'],
      rest: ['/engineering-health/evaluate'],
      mcp: ['smm_get_engineering_health'],
    },
  },
  duplication: {
    namespace: 'eh',
    label: 'Duplication',
    description: 'Duplicated lines density reported by SonarQube.',
    unit: 'percent',
    direction: 'lower_is_better',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['engineering-health evaluate'],
      rest: ['/engineering-health/evaluate'],
      mcp: ['smm_get_engineering_health'],
    },
  },
  coverage: {
    namespace: 'eh',
    label: 'Coverage',
    description: 'Line coverage reported by SonarQube.',
    unit: 'percent',
    direction: 'higher_is_better',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['engineering-health evaluate'],
      rest: ['/engineering-health/evaluate'],
      mcp: ['smm_get_engineering_health'],
    },
  },
  'review-time': {
    namespace: 'eh',
    label: 'Review time',
    description: 'Average time from change request creation to review.',
    unit: 'days',
    direction: 'lower_is_better',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['engineering-health evaluate'],
      rest: ['/engineering-health/evaluate'],
      mcp: ['smm_get_engineering_health'],
    },
  },
  'review-participation': {
    namespace: 'eh',
    label: 'Review participation',
    description: 'Number of unique reviewers participating in the window.',
    unit: 'reviewers',
    direction: 'higher_is_better',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['engineering-health evaluate'],
      rest: ['/engineering-health/evaluate'],
      mcp: ['smm_get_engineering_health'],
    },
  },
  'pair-programming': {
    namespace: 'eh',
    label: 'Pair programming',
    description: 'Pairing index across analyzed commits.',
    unit: 'percent',
    direction: 'higher_is_better',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['engineering-health evaluate'],
      rest: ['/engineering-health/evaluate'],
      mcp: ['smm_get_engineering_health'],
    },
  },
  'knowledge-distribution': {
    namespace: 'eh',
    label: 'Knowledge distribution',
    description: 'Share of touched lines not owned by the top contributor.',
    unit: 'percent',
    direction: 'higher_is_better',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['engineering-health evaluate'],
      rest: ['/engineering-health/evaluate'],
      mcp: ['smm_get_engineering_health'],
    },
  },
  coupling: {
    namespace: 'eh',
    label: 'Coupling',
    description: 'Average file coupling degree.',
    unit: 'degree',
    direction: 'lower_is_better',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['engineering-health evaluate'],
      rest: ['/engineering-health/evaluate'],
      mcp: ['smm_get_engineering_health'],
    },
  },
  ownership: {
    namespace: 'eh',
    label: 'Ownership',
    description: 'Share of touched lines owned by the top contributor.',
    unit: 'percent',
    direction: 'lower_is_better',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['engineering-health evaluate'],
      rest: ['/engineering-health/evaluate'],
      mcp: ['smm_get_engineering_health'],
    },
  },
  components: {
    namespace: 'eh',
    label: 'Components',
    description: 'Number of components in the architecture component view.',
    unit: 'components',
    direction: 'neutral',
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['engineering-health evaluate'],
      rest: ['/engineering-health/evaluate'],
      mcp: ['smm_get_engineering_health'],
    },
  },
} as const satisfies Record<string, MetricDefinition>;

export type CatalogMetricId = keyof typeof METRIC_CATALOG;

export interface MetricCatalogEntry {
  readonly id: CatalogMetricId;
  readonly definition: MetricDefinition;
}

export interface MetricCatalogQuery {
  readonly namespace?: MetricNamespace;
  readonly visibility?: MetricVisibility;
}

export function isMetricNamespace(value: string): value is MetricNamespace {
  return METRIC_NAMESPACES.some((namespace) => namespace === value);
}

export function isMetricVisibility(value: string): value is MetricVisibility {
  return METRIC_VISIBILITIES.some((visibility) => visibility === value);
}

export function listMetricCatalogEntries(query: MetricCatalogQuery = {}): MetricCatalogEntry[] {
  return (Object.entries(METRIC_CATALOG) as Array<[CatalogMetricId, MetricDefinition]>)
    .filter(
      ([, definition]) => query.namespace === undefined || definition.namespace === query.namespace
    )
    .filter(
      ([, definition]) =>
        query.visibility === undefined || definition.visibility === query.visibility
    )
    .map(([id, definition]) => ({ id, definition }));
}
