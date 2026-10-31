/**
 * Deterministic REST API payloads for the Cypress happy-path journeys.
 *
 * The webapp renders its data in server components that call the SMM REST API
 * (`SMM_REST_BASE_URL`). Those requests never reach the browser, so the MSW
 * handlers in `handlers.mjs` intercept them inside the Next.js Node process.
 *
 * Keep every fixture shaped like the real REST response — they are typed on the
 * webapp side in `server/api/*.ts`.
 */

/**
 * Reserved host used as `SMM_REST_BASE_URL` during the run. MSW answers every
 * request for it, so nothing is ever resolved over the network.
 */
export const REST_BASE_URL = 'http://smm-rest-stub.local';

export const PROJECT_REPOSITORY = 'acme/widgets';

const dashboardFilters = {
  startDate: '2025-01-01',
  endDate: '2025-03-31',
  timezone: 'UTC',
  workflowStatus: [],
  workflowConclusions: [],
  jobSelector: [],
  branch: [],
  event: [],
  authorSelect: [],
  excludeAuthorSelect: [],
  excludeCommenterSelect: [],
  labelSelector: [],
  weekends: 'include',
  outlierMode: 'include',
  compareStartDate: '2024-10-01',
  compareEndDate: '2024-12-31',
  rawFilters: '',
  period: 'week',
  ignorePatternFiles: '',
  includePatternFiles: '',
  authorSelectSourceCode: [],
  topEntries: 20,
  typeChurn: 'added',
  aggregateMetric: 'avg',
  sonarqubeRemoveFolders: true,
  method: 'average',
};

const savedChangeRequestFilter = {
  id: 'saved-filter-sprint-12-prs',
  name: 'Sprint 12 PRs',
  section: 'change-requests',
  pathname: '/dashboard/change-requests',
  filters: dashboardFilters,
  repository: PROJECT_REPOSITORY,
  createdAt: '2025-03-01T10:00:00.000Z',
};

const sprintReport = {
  id: 'report-sprint-12',
  name: 'Sprint 12 Review',
  repository: PROJECT_REPOSITORY,
  sections: [
    {
      section: 'change-requests',
      savedFilterId: savedChangeRequestFilter.id,
    },
  ],
  createdAt: '2025-03-02T09:00:00.000Z',
};

const engineeringHealthEvaluation = {
  generatedAt: '2025-04-01T08:30:00.000Z',
  evaluations: [
    {
      id: 'deployment-frequency',
      category: 'delivery',
      value: {
        value: 3.4,
        value_formatted: '3.40 deployments/day',
        unit: 'deployments/day',
        direction: 'higher_is_better',
        sampleSize: 42,
        series: [
          { period: '2025-02', value: 3, value_formatted: '3.00 deployments/day' },
          { period: '2025-03', value: 3.2, value_formatted: '3.20 deployments/day' },
          { period: '2025-04', value: 3.4, value_formatted: '3.40 deployments/day' },
        ],
      },
      comparison: {
        trend: 'improving',
        delta: 0.4,
        delta_formatted: '+0.40',
        deltaPercentage: 13.3,
        current: 3.4,
        current_formatted: '3.40 deployments/day',
        previous: 3,
        previous_formatted: '3.00 deployments/day',
        summary: 'Deployments per day increased from 3.00 to 3.40.',
      },
      summary: {
        title: 'deployment-frequency',
        valueLabel: 'Deployments per day',
        notes: ['Counted from successful deployment jobs.'],
      },
      target: {
        operator: 'gte',
        value: 2,
        description: 'At least 2 deployments per day',
      },
      recommendation: {
        level: 'good',
        summary: 'Deployment cadence is healthy.',
        actions: ['Keep the current release rhythm.'],
      },
    },
    {
      id: 'coverage',
      category: 'quality',
      value: {
        value: 81.5,
        value_formatted: '81.50%',
        unit: '%',
        direction: 'higher_is_better',
        sampleSize: 320,
      },
      comparison: {
        trend: 'stable',
        delta: 0.5,
        delta_formatted: '+0.50',
        deltaPercentage: 0.6,
        current: 81.5,
        current_formatted: '81.50%',
        previous: 81,
        previous_formatted: '81.00%',
        summary: 'Coverage stayed flat compared with the previous period.',
      },
      summary: {
        title: 'coverage',
        valueLabel: 'Line coverage',
        notes: ['Reported by SonarQube.'],
      },
      target: {
        operator: 'gte',
        value: 80,
        description: 'Line coverage of at least 80%',
      },
      recommendation: {
        level: 'good',
        summary: 'Coverage is above the agreed target.',
        actions: ['Focus new tests on high-churn modules.'],
      },
    },
    {
      id: 'review-time',
      category: 'collaboration',
      value: {
        value: 6.2,
        value_formatted: '6.20 hours',
        unit: 'hours',
        direction: 'lower_is_better',
        sampleSize: 57,
      },
      comparison: {
        trend: 'degrading',
        delta: 1.7,
        delta_formatted: '+1.70',
        deltaPercentage: 37.8,
        current: 6.2,
        current_formatted: '6.20 hours',
        previous: 4.5,
        previous_formatted: '4.50 hours',
        summary: 'Review time increased by 1.70 hours.',
      },
      summary: {
        title: 'review-time',
        valueLabel: 'Average review time',
        notes: ['Measured from first review request to approval.'],
      },
      target: {
        operator: 'lte',
        value: 4,
        description: 'Review time under 4 hours',
      },
      recommendation: {
        level: 'critical',
        summary: 'Review turnaround is above the target.',
        actions: ['Add a second reviewer to the busiest repository area.'],
      },
    },
    {
      id: 'ownership',
      category: 'architecture',
      value: {
        value: 0.62,
        value_formatted: '62.00%',
        unit: '%',
        direction: 'higher_is_better',
        sampleSize: 18,
      },
      comparison: {
        trend: 'unknown',
        delta: null,
        delta_formatted: 'n/a',
        deltaPercentage: null,
        current: 0.62,
        current_formatted: '62.00%',
        previous: null,
        previous_formatted: 'n/a',
        summary: 'No previous period data available for comparison.',
      },
      summary: {
        title: 'ownership',
        valueLabel: 'Knowledge distribution',
        notes: ['Share of components with at least two active contributors.'],
      },
      target: {
        operator: 'gte',
        value: 0.6,
        description: 'At least 60% of components owned by two or more people',
      },
      recommendation: {
        level: 'watch',
        summary: 'Knowledge distribution is close to the target.',
        actions: ['Pair on the single-owner components.'],
      },
    },
  ],
};

export const restResponses = {
  '/configuration': {
    result: {
      git_provider: 'github',
      github_repository: PROJECT_REPOSITORY,
      git_repository_location: '/workspace/widgets',
      store_data: true,
      deployment_frequency_targets: [{ pipeline: 'deploy', job: 'release' }],
      main_branch: 'main',
      dashboard_start_date: '2025-01-01',
      dashboard_end_date: '2025-03-31',
      logging_level: 'INFO',
      jira_url: null,
      jira_email: null,
      jira_token: null,
      jira_project: null,
      sonar_url: null,
      sonar_project: null,
    },
  },
  '/projects': {
    result: [{ github_repository: PROJECT_REPOSITORY }],
  },
  '/version': {
    result: { version: '0.0.0-e2e' },
  },
  '/filters': {
    version: 1,
    filters: [savedChangeRequestFilter],
    reports: [sprintReport],
  },
  '/code/pairing-index': {
    pairing_index_percentage: 62.5,
    total_analyzed_commits: 48,
    paired_commits: 30,
    top_pairs: [{ author: 'ana', co_author: 'bruno', paired_commits: 12 }],
  },
  '/code/authors': ['ana', 'bruno', 'carla'],
  '/pipelines/summary': {
    total_runs: 128,
    first_run: { createdAt: '2025-01-06T09:00:00.000Z' },
    last_run: { createdAt: '2025-03-28T17:30:00.000Z' },
    in_progress: 2,
    queued: 1,
  },
  '/pipelines/filter-options': {
    workflows: [{ name: 'CI', path: '.github/workflows/ci.yml' }],
    statuses: ['completed', 'in_progress', 'queued'],
    conclusions: ['success', 'failure', 'cancelled'],
    branches: ['main'],
    events: ['push', 'pull_request'],
    jobs: [{ name: 'build', id: 'build' }],
  },
  '/pipelines/jobs-summary': [
    {
      workflow_name: 'CI',
      job_name: 'build',
      total_runs: 120,
      value: 4.5,
      value_formatted: '4.50 minutes',
      method: 'average',
      success_count: 112,
      failure_count: 8,
      success_rate: 93.3,
      failure_rate: 6.7,
      rerun_count: 5,
    },
  ],
  '/dora/deployment-frequency': [
    {
      pipeline: 'deploy',
      job: 'release',
      days: '2025-03-03',
      weeks: '2025-W10',
      months: '2025-03',
      daily_counts: 3,
      weekly_counts: 11,
      monthly_counts: 42,
      commits: 'abc123',
      links: '',
    },
  ],
  '/change-requests/summary': {
    total: 96,
    merged: 74,
    closed: 14,
    open: 8,
    first_change_request: { created_at: '2025-01-07T10:15:00.000Z' },
    last_change_request: { created_at: '2025-03-27T16:45:00.000Z' },
    top_themes: [],
    labels: [],
  },
  '/change-requests/filter-options': {
    authors: ['ana', 'bruno'],
    commenters: ['carla'],
    labels: ['bug', 'feature'],
  },
  '/change-requests/review-time': [
    { author: 'ana', value: 3.2, value_formatted: '3.20 hours', method: 'average' },
  ],
  '/change-requests/evaluate': {
    generatedAt: '2025-04-01T08:30:00.000Z',
    signals: [
      {
        id: 'slow-review-turnaround',
        title: 'Slow review turnaround',
        description: 'Review time is above the agreed target for the selected window.',
        severity: 'warning',
        category: 'collaboration',
        metrics: [
          { label: 'Review time', value: '5.50 hours' },
          { label: 'Target', value: '4.00 hours' },
        ],
      },
    ],
    summary: {
      totalChangeRequests: 96,
      mergedChangeRequests: 74,
      openChangeRequests: 8,
      commentsPerChangeRequest: 3.4,
      reviewHours: 5.5,
      reviewHours_formatted: '5.50 hours',
      openDays: 2.2,
      openDays_formatted: '2.20 days',
      method: 'average',
      uniqueAuthors: 7,
      topReviewer: 'ana',
      bottleneckAuthor: 'bruno',
    },
  },
  '/engineering-health/evaluate': engineeringHealthEvaluation,
};
