# ADR 0005: Metrics Beyond Average — Command Redesign and Statistical Expansion

Date: 2026-07-27

Status: Proposed

## Context

The CLI currently has "average" baked into subcommand names:

| Current Command | Domain |
|---|---|
| `smm prs average-review-time` | Pull requests |
| `smm prs average-open` | Pull requests |
| `smm prs average-comments` | Pull requests |
| `smm pipelines jobs-steps-average-time` | Pipelines |

This naming limits us to only ever computing the arithmetic mean. The underlying services already compute other statistics in *some* places (`summary` already outputs median for time-to-first-comment), but those richer statistics are not available as top-level commands or configurable metric choices.

Internally, all metric computation flows through a single function (`averageMetricSamples` in `packages/core/src/domain/metric-samples.ts:55`) and the `cleanMetricSamples` pipeline (weekend filtering + IQR outlier detection), producing a single scalar. To expose other statistics, this pipeline needs to be generalized.

## Decision

### Part 1: Rename commands — "metric" is the method, not the command name

Replace the "average-" prefix in CLI subcommands with a `--method` option that selects the statistical aggregation:

**Before:**
```
smm prs average-review-time --top 10
smm prs average-open --aggregate-by week
smm prs average-comments
smm pipelines jobs-steps-average-time --job build
```

**After:**
```
smm prs review-time --method average --top 10
smm prs open-time --method average --aggregate-by week
smm prs comments --method average
smm pipelines jobs-steps-time --method average --job build
```

`--method` accepts: `average`, `median`, `p75`, `p90`, `p95`, `min`, `max`.

The default `--method` is `average` to preserve backward compatibility for users who rely on numeric output parsing. The old subcommand names (e.g. `average-review-time`) are kept as **deprecated aliases** for one release cycle, emitting a warning that they will be removed.

### Part 2: Reason for new metrics

The following statistical measures each provide distinct value for software engineering insights:

| Metric | Value for Software Metrics |
|---|---|
| **Median (p50)** | The typical experience. Not skewed by a single PR that sat open for 6 months. For metrics like review time, median answers "what does a normal PR look like?" — this is the single most important addition. |
| **p75 / p90** | Represents the "bad case" experience. "90% of PRs are reviewed within X days" is the standard SLA formulation used by engineering organizations (DORA, Accelerate). If average is 3 days but p90 is 14 days, there's a long-tail problem. |
| **p95** | Outlier boundary. Used in SRE-style monitoring (the "95th percentile latency" pattern). Shows the worst acceptable case, excluding true anomalies. |
| **Min / Max** | Range awareness. Already partially surfaced in `summary` output. Useful on its own to understand the full spread of durations. |

These are all computable from the existing `MetricSample[]` arrays — no provider changes, no schema migrations, no new fetch logic. The data is already in memory after filtering.

### Part 3: Implementation architecture

**Core layer** (`packages/core/src/domain/metric-samples.ts`):

Add a `computeMetricSamples(method, samples)` function alongside the existing `averageMetricSamples`:

```typescript
export type MetricMethod = 'average' | 'median' | 'p75' | 'p90' | 'p95' | 'min' | 'max';

export function computeMetricSamples<TItem>(
  samples: Array<MetricSample<TItem>>,
  method: MetricMethod
): number {
  if (samples.length === 0) return 0;
  const values = samples.map(s => s.value).sort((a, b) => a - b);

  switch (method) {
    case 'average': return values.reduce((a, b) => a + b, 0) / values.length;
    case 'median':  return percentile(values, 0.50);
    case 'p75':     return percentile(values, 0.75);
    case 'p90':     return percentile(values, 0.90);
    case 'p95':     return percentile(values, 0.95);
    case 'min':     return values[0];
    case 'max':     return values[values.length - 1];
  }
}
```

The `percentile` function already exists at `metric-samples.ts:137` (used internally by IQR outlier detection). The `MetricMethod` type becomes a first-class concept passed through the service layer.

**Service layer** (each service method):

Every method that currently calls `averageMetricSamples(cleaned.samples)` instead accepts a `method?: MetricMethod` parameter (defaulting to `'average'`) and calls `computeMetricSamples(cleaned.samples, method)`.

Affected methods:

| Service | Method | File |
|---|---|---|
| `PRsService.getAverageReviewTime()` | → renamed `getReviewTime()` | `prs-service.ts:371` |
| `PRsService.getAverageOpenBy()` | → renamed `getOpenTimeBy()` | `prs-service.ts:409` |
| `PRsService.getMetrics()` | `averageComments`, `averageOpenDays` → `metrics.method` | `prs-service.ts:96` |
| `PRsService.getMetricsByMonth()` | same fields | `prs-service.ts:477` |
| `PRsService.getMetricsByWeek()` | same fields | `prs-service.ts` |
| `PRsService.getFirstCommentTime()` | `avg_hours` → `method`-driven | `prs-service.ts:667` |
| `PRsService.calculateFirstCommentTimeSummary()` | already has median inline — refactored to use `computeMetricSamples` | `prs-service.ts:620` |
| `PipelinesService.getMetrics()` | `averageDurationMinutes` | `pipelines-service.ts:93` |
| `PipelinesService.getJobMetrics()` | per-job averages | `pipelines-service.ts:336` |
| `PipelinesService.getJobStepsAverageTime()` | per-step averages | `pipelines-service.ts:423` |

**CLI layer** (`apps/cli/src/commands/prs.ts`, `pipelines.ts`):

- Rename subcommands and add `--method <method>` option
- Keep old names as hidden aliases with deprecation warnings
- Forward `options.method` through `buildPRFilters`/`buildPipelineFilters` to services

### Part 4: Engineering Health metrics impact

The `Metric.calculate()` output already produces a `MetricValue` with a single `value` field. The current `compare()` method only uses that single value. No changes needed to the engineering health framework — individual metrics continue to produce a single representative number. The `method` parameter can be configured at the adapter level (e.g., `ReviewTimeMetric` uses median by default, configurable per project).

### Part 5: Output format changes

JSON output should include the `method` used:

```json
{
  "method": "p90",
  "results": [
    { "author": "alice", "value": 2.3, "unit": "days" }
  ]
}
```

Text output should prefix the method name:

```
=== p90 Review Time by Author ===
alice: 2.30 days
```

## Consequences

### Positive

- Users gain median, p75, p90, p95, min, max for all duration/count metrics with zero new data requirements.
- Command names become cleaner (`review-time` vs `average-review-time`).
- The existing `percentile` function is reused — no new algorithm needs to be introduced.
- Engineering organizations can report SLAs in standard form ("90th percentile review time: 2 days").
- Backward compatible: old command names work as aliases with deprecation notice.

### Negative

- Breaking change for scripts that parse CLI output. Mitigated by keeping old command names as aliases for one release and defaulting `--method` to `average`.
- Service method signatures and return types change — cascading type updates across core and CLI.
- The `PRsService.getMetrics()` return type (`PRsMetrics`) gains an additional `method` field, requiring updates to all consumers.

### Neutral

- Output field names like `avg_days`, `avg_hours`, `averageDurationMinutes` will remain as-is for one release cycle, then can be renamed to `value` or `metric_value` in a follow-up ADR.
- The engineering health framework continues to use a single scalar `value` — the method choice is opaque to the comparison/recommendation logic.

## Alternatives Considered

1. **Add new subcommands (e.g., `median-review-time`).**

   Explodes the command surface. Adding 6 methods × 4 commands = 24 new subcommand names. Worse UX, harder to discover, and clutters help output.

2. **Make `--method` a global option on each command group.**

   Cleaner than per-subcommand but more complex to implement in Commander.js. Each subcommand would need to read from its parent. Rejected for now; can be revisited if users find per-subcommand too verbose.

3. **Create a dedicated `smm metrics` top-level group.**

   Would require restructuring all domain commands under a single parent. Too disruptive for the scope of this change. The current domain-grouped layout (`smm prs`, `smm pipelines`) is well-established.

4. **Do nothing and only expose these via the dashboard/webapp.**

   CLI is a first-class access path in SMM. Statistical depth should not be gated behind the web UI.

## Work Estimate

| Work Item | Effort |
|---|---|
| Add `computeMetricSamples()` and `MetricMethod` type to core | Small |
| Refactor service methods to accept `method` parameter | Medium (7-8 methods across 2 services) |
| Rename CLI subcommands + add `--method` option | Medium |
| Add deprecated aliases with warnings | Small |
| Update CLI unit tests (vitest) | Medium (existing tests cover all affected commands) |
| Update e2e tests (bash) | Medium (16+ test references to average commands) |
| Update engineering health adapters (optional `method` config) | Small |
| Update docs/vitepress CLI reference pages | Small |
| **Total** | **~4-5 days** |

## Notes

This ADR does NOT propose:

- Changing how data is fetched or stored. Providers and repositories are untouched.
- Adding new metric types (standard deviation, variance, mode). These can be added later by extending `MetricMethod`.
- Changing the engineering health comparison/evaluation logic. The `value` scalar remains singular — which method produces it is a configuration detail.
- Renaming output fields (`avg_days` → `value`). Deferred to a follow-up ADR for a clean cutover after aliases are removed.
