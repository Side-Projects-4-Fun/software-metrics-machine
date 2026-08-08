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