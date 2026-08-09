# ADR 0006: Output Field Name Unification — `value` + `method` Everywhere

Date: 2026-08-08

Status: Accepted

## Context

ADR 0005 introduced `MetricMethod` (`average`, `median`, `p75`, `p90`, `p95`, `min`, `max`) as a first-class
concept across services and CLI commands. It explicitly deferred the output field rename:

> Output field names like `avg_days`, `avg_hours`, `averageDurationMinutes` will remain as-is for one release
> cycle, then can be renamed to `value` or `metric_value` in a follow-up ADR.

That follow-up is now being made. Today the same statistical measure is returned under several different field
names depending on which service produced it:

- `avg_days` (review time, open-by), `avg_hours` (time to first comment), `avg_duration_minutes` /
  `average_duration_minutes` / `averageDurationMinutes` (pipeline durations) — all represent one computed statistic.
- `averageComments`, `averageOpenDays` in PR metrics.
- `average_duration_minutes`/`avg_duration_minutes`/`averageDurationMinutes` in the pipeline dashboard.

Each of these is also accompanied by a `method` field already. The inconsistent naming makes the API surface
hard to consume and leaks the exact aggregation into consumer field names.

## Decision

Rename every method-sensitive metric field to `value` across domain types, REST DTOs, dashboard components,
webapp consumption, and CLI output. The statistical method that produced the value travels in the sibling `method`
field (domain `MetricMethod`, REST serialized as string).

### Domain (`packages/core`)

| Type | Old field | New field |
|---|---|---|
| `PrsService.getReviewTime()` rows | `avg_days` | `value` (days) |
| `PrsService.getOpenTimeBy()` rows | `avg_days` | `value` (days) |
| `PrsService.getFirstCommentTime()` rows | `avg_hours` | `value` (hours) |
| `FirstCommentMetric` | `avg_hours` | `value` |
| `PRAverageOutlierItem` | — | `value` (unchanged) |
| `PRMetrics` | `averageOpenDays` / `averageComments` | `openDays` / `comments` |
| `PRsByTimeframe` | `averageOpenDays` / `averageComments` | `openDays` / `comments` |
| `PipelineDashboardSummary` | `average_duration_minutes` | `value` |
| `PipelineDashboardJobsSummaryItem` | `avg_duration_minutes` | `value` |
| `PipelineDashboardStepsAverageTimeItem` | `averageDurationMinutes` | `value` |

All renamed types keep a `method: MetricMethod` sibling where one did not exist before. The only method-sensitive
items that keep an explicit unit name are `min_duration` / `max_duration` (true range values, not a single
aggregation) — they stay unchanged.

### Label summaries and true averages stay untouched

- `LabelSummary.openDays` is a per-label stored value, NOT a `computeMetricSamples` result, so it is not renamed.
- `PRSummary.avg_comments_per_pr`, `PRSummary.time_to_first_comment_hours`, `PipelinesSummary.average_duration`
  (the `summary` statistics that are computed as plain averages only) stay as-is — they are not method-sensitive.
- Evaluation insight summaries keep semantic field names where a single scalar represents one value:
  - PR evaluation: `reviewHours`, `openDays` (days), plus unchanged `avgCommentsPerPR`.
  - Pipeline evaluation: `durationMinutes` (minutes).

### REST (`apps/rest`)

REST DTO builders emit the renamed fields and, where consumers previously had a `_formatted` display string,
keep `value_formatted`:

| Endpoint | Old | New |
|---|---|---|
| `GET /pipelines/...` rows | `avg_duration_minutes` | `value` + `value_formatted` |
| `GET /pipelines/...` summary | `average_duration_minutes` | `value` + `value_formatted` |
| `GET /pull-requests/average-review-time` | `avg_days` | `value` + `value_formatted` |
| `GET /pull-requests/first-comment-time` | `avg_hours` | `value` + `value_formatted` |
| `GET /pull-requests/average-comments` | `avg_comments` | `comments` (endpoint unchanged) |

The REST `method` field is serialized as a plain string (domain `MetricMethod`).

### CLI (`apps/cli`)

`pipelines summary/jobs-summary/jobs-time-execution/jobs-steps-time/lead-time` and `prs review-time/open-time/
comments` read the new `value`/`comments` fields and keep their human-readable text output unchanged.

## Scope

Implement the field rename as described above. Keep all REST endpoint paths and CLI command names stable—the
rename is only inside JSON objects. Because the CLI, REST, and dashboard all consumed the outputs, every consumer
layer was updated in the same change:

- Domain types/services/evaluation adapters.
- REST controllers and DTOs.
- Webapp API types, dashboard pages, chart components, insights/recommendations, and tests.
- CLI commands and CLI/e2e tests.

## Consequences

### Positive

- One consistent field name (`value`) across every method-driven statistic, with `method` beside it.
- Dashboard and CLI consumers stop embedding statistics-specific names into code.
- DORA/evaluation flows become simpler to read (`summary.value` and `summary.method`).

### Negative

- Breaking change for consumers that parsed the specific old JSON field names (e.g. `avg_days`,
  `avg_duration_minutes`, `averageDurationMinutes`). No alias is shipped; the rename is atomic across the repo.
- Existing persisted cache files from older versions use the old names; caches must be regenerated by a re-fetch
  after upgrade.

## Notes

This ADR covers only the output-shape rename. It does NOT:

- Change any `MetricMethod` values or add new statistics.
- Change data storage/schema.
- Change engineering health `MetricValue` output, which already uses the single `value` scalar.
- Rename REST endpoints or CLI commands.

---

## Addendum: REST Endpoint Path Unification (2026-08-09)

### Context

The original ADR explicitly deferred REST endpoint path renames, keeping URLs like
`/change-requests/average-review-time` stable. Since ADR 0005, every one of these endpoints
accepts a `?method=` query parameter (`average`, `median`, `p75`, `p90`, `p95`, `min`, `max`).
This made the hardcoded "average" in the URL misleading — a caller hitting
`/change-requests/average-review-time?method=p90` receives a p90 from an endpoint named
"average". The CLI had already adopted method-neutral subcommand names (`review-time`,
`open-time`, `comments`, `jobs-time-execution`, `jobs-steps-time`); the REST paths were the
last surface still baking "average" into the name.

SMM is not deployed in production. There are no external consumers to coordinate with, so a
clean atomic rename is preferable to carrying deprecated aliases or compatibility shims.

### Decision

Rename the REST endpoint paths to be method-neutral, aligning with the existing CLI subcommand
names. Controller method names, DTO type names, webapp API client method names, tests, and docs
are updated in the same change.

| Old endpoint path | New endpoint path |
|---|---|
| `GET /change-requests/average-review-time` | `GET /change-requests/review-time` |
| `GET /change-requests/average-open-by` | `GET /change-requests/open-time` |
| `GET /change-requests/average-comments` | `GET /change-requests/comments` |
| `GET /pipelines/jobs-average-time` | `GET /pipelines/jobs-time-execution` |
| `GET /pipelines/jobs-average-time-by-day` | `GET /pipelines/jobs-time-execution-by-day` |
| `GET /pipelines/jobs-steps-average-time` | `GET /pipelines/jobs-steps-time` |
| `GET /pipelines/jobs-steps-average-time-by-day` | `GET /pipelines/jobs-steps-time-by-day` |

The `PipelineStepsTimeResponse` field `total_average_minutes` / `total_average_minutes_formatted`
is renamed to `total_minutes` / `total_minutes_formatted` (it is the sum of the returned values,
not an average).

### Extended rename (same change)

The initial pass deliberately left several internal surfaces untouched. On review, these were
all method-sensitive names carrying the same misleading "average" label. They have been renamed
in the same change:

| Surface | Old | New |
|---|---|---|
| Dashboard response keys | `jobs_average_time`, `job_steps_average_time`, etc. | `jobs_time`, `job_steps_time`, etc. |
| Domain service methods | `getAverageReviewTime`, `getAverageOpenBy`, `getJobStepsAverageTime` | `getReviewTime`, `getOpenTimeBy`, `getJobStepsTime` |
| Domain compute helpers | `computeJobsAverageTime`, `computeJobStepsAverageTime` | `computeJobsTime`, `computeJobStepsTime` |
| Domain types | `PipelineDashboardJobsAverageTimeItem`, `PipelineAverageOutlier`, `ChangeRequestAverageOutlier` | `PipelineDashboardJobsTimeItem`, `PipelineMetricOutlier`, `ChangeRequestMetricOutlier` |
| Webapp components | `AverageReviewTimeCard`, `JobsAverageTimeCard` | `ReviewTimeCard`, `JobsTimeCard` |
| Webapp types | `JobsAverageTimeData`, `AvgReviewTimeData`, `AverageReviewTimeItem` | `JobsTimeData`, `ReviewTimeData`, `ReviewTimeItem` |
| Metric target key | `average-review-time` | `review-time` |
| CLI output fields | `averageDuration`, `avg_comments`, `avg_comments_per_change_request` | `duration`, `comments_count`, `comments_per_change_request` |
| REST response fields | `avg_comments` | `comments_count` |
| Webapp local variables | `avgReviewTime`, `avgOpenBy`, `avgComments`, `averageReviewTime` | `reviewTimeData`, `openTimeData`, `commentsData`, `reviewTime` |

### Consequences

- Breaking change for any consumer that hardcoded the old URLs or field names. No aliases or
  redirects are shipped — consumers update to the new names.
- Swagger documentation now shows method-neutral endpoint names consistent with the `?method=`
  query parameter.
- All internal naming (domain types, service methods, components, variables) is now consistent
  with the method-neutral principle.