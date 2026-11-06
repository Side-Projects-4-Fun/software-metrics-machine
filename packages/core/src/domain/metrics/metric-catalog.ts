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
import { METRIC_REFERENCES } from './metric-references';
import type {
  MetricReference,
  MetricReferenceSource,
  MetricReferenceTarget,
} from './metric-references';

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

export interface MetricComputation {
  /** How the underlying evidence is identified: source records and fields used. */
  readonly evidence: string;
  /** How the identified evidence is reduced into the reported value(s). */
  readonly formula: string;
  /** Compact mathematical notation for the computation. */
  readonly notation: string;
}

export interface MetricDefinition {
  readonly namespace: MetricNamespace;
  readonly label: string;
  readonly description: string;
  readonly computation: MetricComputation;
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
    computation: {
      evidence:
        'Change request records with author, labels, comments, and created/merged/closed timestamps from the git provider.',
      formula:
        'Counts records in the selected window, totals comments and unique authors/labels, then derives first/last change request by created date, top comment themes from n-grams, most-commented change requests, top commenter, and average hours to the first comment.',
      notation:
        'counts = |{cr ∈ CR}|; comments/CR = Σ comments ÷ |CR|; t_first = mean(t_first_comment − t_created)',
    },
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
    computation: {
      evidence:
        'Change request records with author, labels, comments, and created/merged/closed timestamps.',
      formula:
        'Aggregates open days (creation to merge/close, or now when still open), comments per change request, and lead time with the selected statistical method; includes label and comment summaries.',
      notation:
        'open_days = days((merged_at ∨ closed_at ∨ now) − created_at); comments = Σ comments; lead_time = open_days',
    },
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
    computation: {
      evidence: 'Change request records with created, merged, and closed timestamps.',
      formula:
        'Counts change requests opened by created date and closed by merge/close date per day, week, or month, and emits one series row per period and kind.',
      notation: 'opened(p) = |{cr: created_at ∈ p}|; closed(p) = |{cr: merged_at ∨ closed_at ∈ p}|',
    },
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
    computation: {
      evidence: 'Change request records and their author login.',
      formula:
        'Groups change requests by author, counts each group, and returns the top N authors sorted by count.',
      notation: 'count(author) = |{cr: cr.author = author}|',
    },
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
    computation: {
      evidence:
        'Merged or closed change requests with created and merged/closed timestamps, grouped by author.',
      formula:
        'Computes days from creation to merge/close per change request, groups the samples by author, and applies the selected method (average/median/p75/p90/p95/min/max).',
      notation:
        'review_days = ((merged_at ∨ closed_at) − created_at) ÷ 86 400 000; value(author) = method(review_days)',
    },
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
    computation: {
      evidence: 'Change request records with created and merged/closed timestamps.',
      formula:
        'Computes days open per change request (to merge/close, or now when still open), groups samples by day/week/month, and applies the selected statistical method.',
      notation:
        'open_days = ((merged_at ∨ closed_at ∨ now) − created_at) ÷ 86 400 000; value(period) = method(open_days)',
    },
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
    computation: {
      evidence: 'Change request records and their total comment counts.',
      formula:
        'Collects comments per change request, optionally groups the samples by period, and applies the selected statistical method to the distribution.',
      notation: 'value(period) = method({cr.comments})',
    },
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
    computation: {
      evidence: 'Comments attached to change requests with the commenter login.',
      formula: 'Counts comments per commenter, sorts descending, and returns the top N reviewers.',
      notation: 'count(commenter) = |{comment: comment.author = commenter}|',
    },
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
    computation: {
      evidence: 'Change requests with comments and timestamps for creation and the first comment.',
      formula:
        'Computes hours from creation to the earliest comment, groups samples by change request author, and applies the selected statistical method.',
      notation:
        't_first = (min(comment.created_at) − created_at) ÷ 3 600 000; value(author) = method(t_first)',
    },
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
    computation: {
      evidence: 'Merged change requests with created/merged timestamps and comments.',
      formula:
        'Groups merged change requests by timezone-aware week and computes totals, merged/closed/open counts, open days, comments, and lead time per week.',
      notation:
        'week = iso_week(merged_at); value = {count, merged, closed, open, open_days, comments, lead_time}',
    },
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
    computation: {
      evidence: 'Change requests with created/merged timestamps and comments.',
      formula:
        'Groups change requests by timezone-aware calendar month and computes totals, merged/closed/open counts, open days, comments, and lead time per month.',
      notation:
        'month = calendar_month(created_at); value = {count, merged, closed, open, open_days, comments, lead_time}',
    },
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
    computation: {
      evidence: 'Change request labels attached to each change request.',
      formula:
        'Counts change requests per distinct label (case-insensitive), adds average open days per label, and sorts by count.',
      notation: 'count(label) = |{cr: label ∈ cr.labels}|; open_days(label) = mean(open_days(cr))',
    },
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
    computation: {
      evidence:
        'Aggregated change request metrics, review-time distributions, comment counts, and per-author comment volume.',
      formula:
        'Runs six threshold-based signal detectors (review_time, reviewer_workload, open_time, throughput, first_comment, comment_health) and returns each signal with severity, metrics, and description.',
      notation:
        'signals = {review_time, reviewer_workload, open_time, throughput, first_comment, comment_health}',
    },
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
    computation: {
      evidence:
        'Pipeline runs with status, conclusion, attempt metadata, and job start/completion timestamps.',
      formula:
        'Counts runs by conclusion plus in-progress/queued, computes success rate as successful divided by completed times 100, and aggregates run duration (max job completion minus min job start) with the selected method.',
      notation:
        'success_rate = successful ÷ completed × 100; duration = max(job.completed_at) − min(job.started_at); value = method(duration)',
    },
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
    computation: {
      evidence: 'Pipeline runs and their conclusion values.',
      formula: 'Groups runs by conclusion and counts each group.',
      notation: 'count(conclusion) = |{run: run.conclusion = conclusion}|',
    },
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
    computation: {
      evidence: 'Pipeline jobs and their conclusion/status values.',
      formula: 'Groups jobs by conclusion (falling back to status) and counts each group.',
      notation: 'count(status) = |{job: job.conclusion ∨ job.status = status}|',
    },
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
    computation: {
      evidence: 'Pipeline runs and their job start/completion timestamps, grouped by workflow.',
      formula:
        'Computes each run duration as max job completion minus min job start, groups samples by workflow, and returns the minimum, maximum, and selected aggregation.',
      notation:
        'duration(run) = max(job.completed_at) − min(job.started_at); value(workflow) = method(duration); min/max = min(duration)/max(duration)',
    },
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
    computation: {
      evidence: 'Pipeline runs with completion/creation timestamps and workflow path.',
      formula: 'Groups runs by day and workflow and counts them per period.',
      notation: 'runs(day, workflow) = |{run: date(run) = day ∧ run.path = workflow}|',
    },
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
    computation: {
      evidence: 'Pipeline jobs with conclusion, run attempt, and start/completion timestamps.',
      formula:
        'Groups jobs by workflow and normalized job name, counts runs and successes/failures, sums reruns as attempt minus one, applies the selected duration aggregation, and derives success/failure rates.',
      notation:
        'success_rate = success ÷ total × 100; failure_rate = failure ÷ total × 100; reruns = Σ max(run_attempt − 1, 0); value = method(job_duration)',
    },
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
    computation: {
      evidence: 'Pipeline jobs with start and completion timestamps.',
      formula:
        'Computes each job duration in minutes, groups samples by normalized job name, and applies the selected statistical method.',
      notation:
        'job_duration = (job.completed_at − job.started_at) ÷ 60 000; value(job) = method(job_duration)',
    },
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
    computation: {
      evidence:
        'Pipeline jobs with start/completion timestamps and the run completion/creation date.',
      formula:
        'Computes job durations in minutes, groups samples by run day, and applies the selected statistical method per day.',
      notation: 'day = date(run); value(day, job) = method(job_duration)',
    },
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
    computation: {
      evidence: 'Pipeline job steps with name and start/completion timestamps.',
      formula:
        'Computes each step duration in minutes, groups samples by step name, and applies the selected statistical method.',
      notation:
        'step_duration = (step.completed_at − step.started_at) ÷ 60 000; value(step) = method(step_duration)',
    },
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
    computation: {
      evidence: 'Pipeline job steps with name and start/completion timestamps, plus the run date.',
      formula:
        'Computes step durations in minutes, groups samples by run day and step name, and applies the selected statistical method per group.',
      notation: 'day = date(run); value(day, step) = method(step_duration)',
    },
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
    computation: {
      evidence: 'Pipeline runs with attempt number and completion/creation date.',
      formula: 'Computes reruns per run as max(attempt minus 1, 0) and sums reruns per day.',
      notation: 'reruns(run) = max(run_attempt − 1, 0); reruns(day) = Σ reruns(run)',
    },
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
    computation: {
      evidence: 'Pipeline jobs with workflow path and start/completion timestamps.',
      formula:
        'Computes job durations in minutes and returns the arithmetic mean per job, grouped by workflow.',
      notation: 'value(workflow, job) = Σ job_duration ÷ n',
    },
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
    computation: {
      evidence:
        'Successful pipeline runs and successful jobs matching each configured deployment target (pipeline plus job).',
      formula:
        'Counts successful target jobs per day/week/month, zero-fills missing intervals, and returns the latest period count per target.',
      notation:
        'frequency(p, target) = |{job: target ∧ job.conclusion = success ∧ completed_at ∈ p}|',
    },
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
    computation: {
      evidence: 'Pipeline dashboard summary for the selected window and deployment target.',
      formula:
        'Returns the dashboard summary aggregate value in minutes (the same run-duration aggregation used by the pipeline dashboard).',
      notation:
        'lead_time = summary.duration = method(max(job.completed_at) − min(job.started_at))',
    },
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
    computation: {
      evidence:
        'Pipeline dashboard data: job durations, job summaries, reruns, workflows, and job counts.',
      formula:
        'Runs five signal detectors (duration_top_job, stability_worst_job, rerun_analysis, slowest_workflow, job_overview) and returns each signal with severity, metrics, and description.',
      notation:
        'signals = {duration_top_job, stability_worst_job, rerun_analysis, slowest_workflow, job_overview}',
    },
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
    computation: {
      evidence:
        'Source files in the configured repository, scanned line by line for loops, sort calls, binary searches, and iteration helpers.',
      formula:
        'Classifies the highest-weight signal per file as O(1) through O(n^3+), scores it as min(100, topWeight times 12 plus signalCount times 2), and flags needsHelp when the score is 60 or more.',
      notation:
        'classification = argmax(weight[signal]); score = min(100, weight[top] × 12 + |signals| × 2); needs_help = score ≥ 60',
    },
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
    computation: {
      evidence: 'Git commits with author, co-authors, changed files, and timestamps.',
      formula:
        'Uses the pairing index (paired commits divided by analyzed commits times 100) as the summary core and exposes paired commit counts and top pairs.',
      notation: 'pairing_index = paired_commits ÷ total_commits × 100',
    },
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
    computation: {
      evidence: 'Git commits in the selected window with lines added and deleted.',
      formula:
        'Aggregates additions, deletions, commit counts, and total churn (added plus deleted) per day; the series projects one churn type.',
      notation:
        'churn(day) = Σ added(day) + Σ deleted(day); value = {added, deleted, commits, churn}',
    },
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
    computation: {
      evidence: 'Git commits with author and line-level churn.',
      formula: 'Groups additions, deletions, and commit counts by author.',
      notation: 'churn(author) = {Σ added, Σ deleted, Σ commits}',
    },
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
    computation: {
      evidence: 'CodeMaat file-coupling output: pairs of files that change in the same commits.',
      formula:
        'Returns the coupling degree (shared revisions divided by revisions of the entity) and average revisions per pair, optionally filtered by minimum coupling and path patterns.',
      notation: 'degree = shared_revisions ÷ entity_revisions × 100; avg_revs = mean(revisions)',
    },
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
    computation: {
      evidence: 'CodeMaat layered-coupling output aggregated by file path group.',
      formula:
        'Returns coupling degree and average revisions between architectural layers derived from path groups.',
      notation: 'degree(layer_a, layer_b) = shared_revisions ÷ layer_revisions × 100',
    },
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
    computation: {
      evidence: 'CodeMaat entity-churn output with per-file added/deleted lines and commit counts.',
      formula:
        'Returns added, deleted, and commit totals per entity, with optional path filters and top-N.',
      notation: 'churn(entity) = {Σ added, Σ deleted, Σ commits}',
    },
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
    computation: {
      evidence: 'CodeMaat entity-effort output with revision counts per file.',
      formula:
        'Returns total revisions per entity as the effort proxy, with optional path filters and top-N.',
      notation: 'effort(entity) = total_revs(entity)',
    },
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
    computation: {
      evidence: 'CodeMaat entity-ownership output with author, file, additions, and deletions.',
      formula:
        'Returns lines added and deleted per author per entity, with optional author/path filters and top-N.',
      notation: 'ownership(entity, author) = {Σ added, Σ deleted}',
    },
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
    computation: {
      evidence: 'Git commits with author, co-authors, changed files, and timestamps.',
      formula:
        'Computes (commits with co-authors divided by total analyzed commits) times 100, plus the paired commit count and top author pairs.',
      notation: 'pairing_index = |{commit: co_authors ≠ ∅}| ÷ |commits| × 100',
    },
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
    computation: {
      evidence: 'Per-file cyclomatic complexity and test coverage from SonarQube component data.',
      formula:
        'CRAP equals complexity squared times (1 minus coverage divided by 100) cubed, plus complexity, rounded to one decimal.',
      notation: 'CRAP = complexity² × (1 − coverage ÷ 100)³ + complexity',
    },
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
    computation: {
      evidence: 'Timestamped CodeMaat churn entries.',
      formula:
        'Returns the stored churn series (date, added, deleted, commits) in chronological order.',
      notation: 'series = {(date, added, deleted, commits)}',
    },
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
    computation: {
      evidence: 'Timestamped CodeMaat file-coupling entries.',
      formula: 'Returns the stored coupling series with degree and average revisions per snapshot.',
      notation: 'series = {(snapshot, entity, coupled, degree, avg_revs)}',
    },
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
    computation: {
      evidence: 'Timestamped CodeMaat layered-coupling entries.',
      formula: 'Returns the stored layered-coupling series per snapshot.',
      notation: 'series = {(snapshot, layer, coupled, degree, avg_revs)}',
    },
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
    computation: {
      evidence: 'Timestamped CodeMaat entity-churn entries.',
      formula: 'Returns the stored per-entity added/deleted/commit series.',
      notation: 'series = {(snapshot, entity, added, deleted, commits)}',
    },
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
    computation: {
      evidence: 'Timestamped CodeMaat entity-effort entries.',
      formula: 'Returns the stored per-entity revision series.',
      notation: 'series = {(snapshot, entity, total_revs)}',
    },
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
    computation: {
      evidence: 'Timestamped CodeMaat entity-ownership entries.',
      formula: 'Returns the stored per-author and per-entity added/deleted series.',
      notation: 'series = {(snapshot, entity, author, added, deleted)}',
    },
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
    computation: {
      evidence:
        'Code dashboard data: entity churn, daily churn, coupling, ownership, CRAP, Big O, and pairing.',
      formula:
        'Runs ten threshold-based signal detectors (churn_hotspot, churn_trend, coupling_top, coupling_burst, ownership_concentration, ownership_unknown, complexity_hotspot, complexity_big_o, pairing_index, pairing_concentration) and returns severity, metrics, and description.',
      notation:
        'signals = {churn_hotspot, churn_trend, coupling_top, coupling_burst, ownership_concentration, ownership_unknown, complexity_hotspot, complexity_big_o, pairing_index, pairing_concentration}',
    },
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
    computation: {
      evidence: 'SonarQube coverage measure for the project.',
      formula: 'Returns the stored line-coverage percentage.',
      notation: 'coverage = sonar.coverage',
    },
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
    computation: {
      evidence: 'SonarQube sqale_rating measure.',
      formula: 'Returns the 1-to-5 maintainability rating.',
      notation: 'rating = sonar.sqale_rating',
    },
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
    computation: {
      evidence: 'SonarQube reliability_rating measure.',
      formula: 'Returns the 1-to-5 reliability rating consumed by the quality evaluation.',
      notation: 'rating = sonar.reliability_rating',
    },
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
    computation: {
      evidence: 'SonarQube security_rating measure.',
      formula: 'Returns the 1-to-5 security rating consumed by the quality evaluation.',
      notation: 'rating = sonar.security_rating',
    },
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
    computation: {
      evidence: 'SonarQube complexity measure.',
      formula: 'Returns the total cyclomatic complexity.',
      notation: 'complexity = Σ cyclomatic_complexity',
    },
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
    computation: {
      evidence: 'SonarQube component tree with cognitive_complexity measures per component.',
      formula:
        'Returns the per-component cognitive-complexity rows from the latest component tree.',
      notation: 'cognitive_complexity(component) = measure',
    },
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
    computation: {
      evidence: 'SonarQube duplicated_lines_density measure.',
      formula: 'Returns the duplicated-lines percentage.',
      notation: 'duplication = duplicated_lines ÷ lines × 100',
    },
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
    computation: {
      evidence: 'SonarQube ncloc measure.',
      formula: 'Returns non-commenting lines of code.',
      notation: 'ncloc = non_commenting_lines',
    },
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
    computation: {
      evidence: 'SonarQube code_smells measure.',
      formula: 'Returns the code-smell count.',
      notation: 'code_smells = count',
    },
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
    computation: {
      evidence: 'SonarQube bugs measure.',
      formula: 'Returns the bug count.',
      notation: 'bugs = count',
    },
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
    computation: {
      evidence: 'SonarQube component-tree response with per-component measures.',
      formula:
        'Maps each component to its complexity, ncloc, rating, coverage, duplication, and cognitive-complexity fields.',
      notation:
        'component = {complexity, ncloc, rating, coverage, duplication, cognitive_complexity}',
    },
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
    computation: {
      evidence: 'Stored SonarQube component-tree snapshots.',
      formula: 'Returns each timestamped component-tree entry in chronological order.',
      notation: 'series = {(timestamp, component, measures)}',
    },
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
    computation: {
      evidence: 'Raw SonarQube measure set for the project.',
      formula: 'Returns the stored measures without aggregation.',
      notation: 'measures = {(metric, value)}',
    },
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
    computation: {
      evidence: 'Stored SonarQube measurement entries.',
      formula: 'Returns the stored time series per metric.',
      notation: 'series = {(timestamp, metric, value)}',
    },
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
    computation: {
      evidence: 'SonarQube quality metrics and component tree.',
      formula:
        'Runs seven threshold-based signal detectors (reliability_rating, security_rating, maintainability_rating, duplication_density, coverage_health, complexity_outlier, coverage_outlier) and returns severity, metrics, and description.',
      notation:
        'signals = {reliability_rating, security_rating, maintainability_rating, duplication_density, coverage_health, complexity_outlier, coverage_outlier}',
    },
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
    computation: {
      evidence:
        'Persisted architecture snapshots with id, timestamp, project, branch, commit count, and available views.',
      formula:
        'Lists snapshot headers; each snapshot is generated from package.json discovery plus git commit history.',
      notation: 'snapshot = {id, generated_at, project, branch, commit_count, views}',
    },
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
    computation: {
      evidence: "Latest architecture snapshot's selected C4 view with nodes and relationships.",
      formula:
        'Counts containers, edges, orphan nodes, average edge confidence, most-connected node, and hub node.',
      notation:
        'summary = {containers = |nodes|, edges = |edges|, avg_confidence = mean(confidence), orphans, most_connected = argmax(in_degree), hub = argmax(out_degree)}',
    },
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
    computation: {
      evidence: "Latest architecture snapshot's context, container, component, or code view.",
      formula:
        "Returns the selected view's nodes and edges, filtered by include/ignore path patterns when provided.",
      notation: 'view = {nodes, edges} filtered by path patterns',
    },
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
    computation: {
      evidence: 'Architecture snapshot nodes of kind container or component.',
      formula: 'Counts matching nodes; severity is warning at 12 and critical at 20.',
      notation: 'count = |{node: kind ∈ {container, component}}|',
    },
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
    computation: {
      evidence: 'Architecture relationships with incoming edges per node.',
      formula:
        'Computes the highest incoming-edge count divided by the average incoming edges per node; severity is warning at 1.5 and critical at 3.',
      notation: 'ratio = max(in_degree) ÷ mean(in_degree)',
    },
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
    computation: {
      evidence: 'Architecture relationships with outgoing edges per node.',
      formula:
        'Computes the highest outgoing-edge count divided by the average outgoing edges per node; severity is warning at 1.5 and critical at 3.',
      notation: 'ratio = max(out_degree) ÷ mean(out_degree)',
    },
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
    computation: {
      evidence: 'Architecture nodes and the source/target ids of all relationships.',
      formula:
        'Counts nodes with no incident edge and divides by total nodes; severity is warning at 2 orphans and critical at 5.',
      notation: 'orphans = |{node: in_degree + out_degree = 0}|; share = orphans ÷ |nodes| × 100',
    },
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
    computation: {
      evidence: 'Architecture relationships and their confidence scores.',
      formula:
        'Averages edge confidence and counts edges below 0.5; severity is warning below 0.7 and critical below 0.5 average confidence.',
      notation:
        'avg_confidence = mean(edge.confidence); low = |{edge: confidence < 0.5}| ÷ |edges| × 100',
    },
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
    computation: {
      evidence: 'Architecture snapshot view plus the summary signals.',
      formula:
        'Runs container_count, dependency_concentration, hub_dependency, orphan_nodes, and confidence_health detectors and returns severity, metrics, and description.',
      notation:
        'signals = {container_count, dependency_concentration, hub_dependency, orphan_nodes, confidence_health}',
    },
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
    description:
      'Total issues from the configured issue tracker (Jira, GitHub, or a Jira CSV export) for the selected window and status filter.',
    unit: 'count',
    direction: 'neutral',
    computation: {
      evidence:
        'Issues from the configured issue tracker (Jira, GitHub, or a Jira CSV export) matching the selected project, window, status and label filters.',
      formula: 'Counts the matching issue records.',
      notation: 'count = |{issue: filter(issue)}|',
    },
    shape: 'scalar',
    visibility: 'public',
    status: 'active',
    surfaces: {
      cli: ['issues fetch'],
      rest: ['/api/metrics/issues'],
      mcp: ['smm_get_issue_metrics'],
    },
  },
  'issue-list': {
    namespace: 'issue',
    label: 'Issue records',
    description: 'Raw issue records from the configured issue tracker backing the issue count.',
    unit: 'rows',
    direction: 'neutral',
    computation: {
      evidence: 'Issue records from the configured issue tracker matching the selected filter.',
      formula: 'Returns the raw issue rows that back the count.',
      notation: 'rows = {issue: filter(issue)}',
    },
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
    computation: {
      evidence:
        'Successful deployment-target jobs (configured pipeline plus job) per day/week/month.',
      formula:
        'Counts successful target jobs per period and returns the latest period count per target; missing intervals are zero-filled.',
      notation: 'frequency(p, target) = |{job: target ∧ success ∧ completed_at ∈ p}|',
    },
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
    computation: {
      evidence: 'Pipeline dashboard summary for the selected window and deployment target.',
      formula:
        'Returns the summary aggregate value in minutes, using the same run-duration aggregation as the pipeline dashboard.',
      notation: 'lead_time = summary.duration',
    },
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
    computation: {
      evidence: 'Pipeline runs with job start/completion timestamps.',
      formula:
        'Aggregates run duration (max job completion minus min job start) with the selected method and returns the value in minutes.',
      notation: 'duration = method(max(job.completed_at) − min(job.started_at))',
    },
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
    computation: {
      evidence: 'Pipeline runs with conclusion values.',
      formula:
        'Failure rate equals failed runs divided by total runs times 100, rounded to two decimals.',
      notation: 'failure_rate = failed ÷ total × 100',
    },
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
    computation: {
      evidence: 'SonarQube complexity measure.',
      formula: 'Returns the total complexity value.',
      notation: 'complexity = sonar.complexity',
    },
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
    computation: {
      evidence: 'SonarQube duplicated_lines_density measure.',
      formula: 'Returns the duplicated-lines percentage.',
      notation: 'duplication = duplicated_lines ÷ lines × 100',
    },
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
    computation: {
      evidence: 'SonarQube coverage measure.',
      formula: 'Returns line coverage percentage.',
      notation: 'coverage = sonar.coverage',
    },
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
    computation: {
      evidence:
        'Merged or closed change requests with created and merged/closed timestamps, grouped by author.',
      formula:
        "Computes each author's average review days, then averages those author values into one score, rounded to two decimals.",
      notation: 'value = mean(review_days(author))',
    },
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
    computation: {
      evidence: 'Comments on change requests with the commenter login.',
      formula: 'Counts unique commenters (reviewers) in the selected window.',
      notation: 'reviewers = |{comment.author}|',
    },
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
    computation: {
      evidence: 'Git commits with co-authors and changed files.',
      formula: 'Pairing index equals paired commits divided by total analyzed commits times 100.',
      notation: 'pairing_index = paired_commits ÷ total_commits × 100',
    },
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
    computation: {
      evidence: 'CodeMaat entity ownership with author, added, and deleted lines.',
      formula:
        "100 minus the top contributor's touched lines divided by total touched lines times 100, where touched equals added plus deleted.",
      notation: 'distribution = 100 − (top_owner_touched ÷ total_touched) × 100',
    },
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
    computation: {
      evidence: 'CodeMaat file-coupling pairs and their degree.',
      formula: 'Arithmetic mean of all coupling degrees, rounded to two decimals.',
      notation: 'coupling = mean(degree)',
    },
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
    computation: {
      evidence: 'CodeMaat entity ownership with author, added, and deleted lines.',
      formula:
        "Top contributor's touched lines divided by total touched lines times 100, rounded to two decimals.",
      notation: 'ownership = top_owner_touched ÷ total_touched × 100',
    },
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
    computation: {
      evidence: 'Architecture component-view nodes.',
      formula: 'Counts nodes whose kind is component.',
      notation: 'count = |{node: node.kind = component}|',
    },
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
  /** Documented benchmark, when the family has a published target. */
  readonly target?: MetricReferenceTarget;
  /** External papers, reports and books backing the benchmark. */
  readonly sources?: readonly MetricReferenceSource[];
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
    .map(([id, definition]) => {
      const reference = (METRIC_REFERENCES as Partial<Record<CatalogMetricId, MetricReference>>)[
        id
      ];

      return {
        id,
        definition,
        ...(reference ? { target: reference.target, sources: reference.sources } : {}),
      };
    });
}
