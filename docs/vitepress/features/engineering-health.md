---
outline: deep
---

# Engineering Health

Engineering Health evaluates delivery, quality, collaboration, and architecture metrics as one leadership-oriented
report. Use it from the dashboard when you want a readable report, or from the CLI when you want terminal output, JSON,
or automation-friendly checks.

## Dashboard

Start the dashboard with:

```bash
smm dashboard serve
```

Then open:

```text
http://localhost:3000/dashboard/engineering-health
```

The dashboard page is designed to be read in the browser and exported with the dashboard print action.

## CLI

Use the CLI when you want to run the same engineering health evaluation from a terminal or a recurring automation job.

```bash
smm engineering-health evaluate \
    --start-date 2026-07-01 \
    --end-date 2026-07-31 \
    --compare-start-date 2026-06-01 \
    --compare-end-date 2026-06-30
```

The default text output prints a compact summary for each evaluated metric:

```text
=== Engineering Health ===

Generated at: 2026-07-19T12:00:00.000Z
Evaluations: 8

Metric: pipeline-duration (delivery)
Deployment target: Frontend App
Value: 15.00 minutes
Trend: Metric degraded by 5.00 minutes.
Target: Average pipeline duration below ten minutes.
Recommendation: Metric is outside target and needs attention.
```

Use JSON output when another tool needs to consume the result:

```bash
smm engineering-health evaluate \
    --category delivery \
    --start-date 2026-07-01 \
    --end-date 2026-07-31 \
    --compare-start-date 2026-06-01 \
    --compare-end-date 2026-06-30 \
    --output json
```

Common CLI examples:

```bash
# Review delivery health for the current sprint against the previous sprint
smm engineering-health evaluate \
    --category delivery \
    --start-date 2026-07-01 \
    --end-date 2026-07-14 \
    --compare-start-date 2026-06-17 \
    --compare-end-date 2026-06-30 \
    --period week

# Review a focused quality and collaboration slice
smm engineering-health evaluate \
    --metric coverage,duplication,complexity,review-time,pair-programming \
    --start-date 2026-07-01 \
    --end-date 2026-07-31 \
    --compare-start-date 2026-06-01 \
    --compare-end-date 2026-06-30 \
    --weekends exclude \
    --outlier-mode flag

# Review pull-request-backed collaboration metrics for a label slice
smm engineering-health evaluate \
    --category collaboration \
    --pr-labels feature,backend \
    --start-date 2026-07-01 \
    --end-date 2026-07-31 \
    --compare-start-date 2026-06-01 \
    --compare-end-date 2026-06-30
```

The CLI uses the active project configuration and the configured project timezone. The dashboard uses the browser
timezone query parameter, as described in [Dashboard](./dashboard.md#date-and-timezone-filters).

## What the page shows

The page is organized as a report:

- **Engineering Health Overview**: generation time, current period, comparison period, and the comparison guide.
- **Executive Summary**: risk distribution, target compliance, strongest degradation, and strongest improvement.
- **Scorecard**: metrics grouped by category first, then sorted by risk level and movement.
- **Delivery scorecards**: delivery metrics are grouped by deployment target before they are sorted by risk and movement.
- **Trend and Driver Analysis**: strongest degrading and improving signals for the selected window.
- **Data Confidence and References**: comparison coverage, sample-size coverage, trend-chart coverage, and reference access.
- **Metric appendix**: compact per-metric rows with current value, delta, trend, sample size, comparison summary, target,
  recommendation, and charts.
- **Report References**: the sources cited by the report.

## How to use it

Use Engineering Health when you want a concise review of engineering signals across multiple domains instead of reading
each dashboard tab separately.

Typical workflow:

1. Select the repository from the project drawer.
2. Pick the current date range.
3. Pick a comparison range when you want period-over-period movement.
4. Choose the period granularity: day, week, biweekly, month, or quarter.
5. Filter by category or metric when the report needs to focus on one area.
6. Use PR labels when you want collaboration metrics to reflect a specific slice of work.
7. Print the page when you need to share the report as a PDF.

The page keeps the same layout for dashboard viewing and PDF export. The dashboard print action prints the page users
see, including category colors, scorecards, compact metric appendix rows, and references.

## Filters and CLI options

Engineering Health uses the shared dashboard date and timezone behavior documented in [Dashboard](./dashboard.md).

Important filters include:

| Dashboard filter | CLI option | Backend query parameter | Purpose |
| ---- | --- | --- | --- |
| Current date range | `--start-date`, `--end-date` | `start_date`, `end_date` | Defines the period being evaluated. |
| Comparison date range | `--compare-start-date`, `--compare-end-date` | `compare_start_date`, `compare_end_date` | Defines the baseline period used for movement and trend. |
| Period | `--period` | `period` | Groups evolution by period. The CLI supports `day`, `week`, and `month`. |
| Weekends | `--weekends` | `weekends` | Controls whether weekend data is included, excluded, or isolated. |
| Outlier mode | `--outlier-mode` | `outlier_mode` | Includes, flags, or excludes outliers where supported by the metric. |
| Category | `--category` | `category` | Limits the report to delivery, quality, collaboration, or architecture. |
| Metric | `--metric` | `metric` | Limits the report to one or more comma-separated metric ids. |
| PR labels | `--pr-labels` | `pr_labels` | Filters pull-request-backed collaboration metrics by labels. |
| Raw filters | `--raw-filters` | `raw_filters` | Sends advanced provider-specific filters where supported. See [Raw filters](#raw-filters) below for usage. |
| Output format | `--output` | Not applicable | Prints `text` or `json` output from the CLI. |

## Raw filters

The `--raw-filters` option allows you to pass provider-specific filters that are not available through the standard CLI options. This is particularly useful when you need to filter by fields that are specific to your data provider (GitHub, GitLab, etc.).

### Format

Raw filters use a `key=value` format and support two separators:

1. **Pipe separator (`|`)**: Use this when you want to clearly separate multiple filters

```bash
--raw-filters "status=success|branch=main|conclusion=success"
```

2. **Smart comma separator (`,`)**: Commas are treated as separators only when followed by a `key=` pattern

```bash
--raw-filters "status=success,branch=main,conclusion=success"
```

The smart comma separator allows you to use commas within values without breaking the filter parsing:

```bash
--raw-filters "title=feat: add new feature|author.login=john, jane"
```

### Provider-specific examples

#### GitHub workflows

When working with GitHub workflows and pipelines, you can filter by:

```bash
# Filter by workflow status and branch
smm engineering-health evaluate \
    --category delivery \
    --start-date 2026-07-01 \
    --end-date 2026-07-31 \
    --compare-start-date 2026-06-01 \
    --compare-end-date 2026-06-30 \
    --raw-filters "status=completed|branch=main"

# Filter by workflow name and conclusion
smm engineering-health evaluate \
    --category delivery \
    --start-date 2026-07-01 \
    --end-date 2026-07-31 \
    --raw-filters "name=deploy,conclusion=success"

# Multiple filters for specific workflow runs
smm engineering-health evaluate \
    --category delivery \
    --start-date 2026-07-01 \
    --end-date 2026-07-31 \
    --raw-filters "status=success|name=ci-cd|event=push"
```

#### GitHub pull requests

For collaboration metrics backed by pull requests:

```bash
# Filter by PR author
smm engineering-health evaluate \
    --category collaboration \
    --start-date 2026-07-01 \
    --end-date 2026-07-31 \
    --raw-filters "author.login=alice|author.login=bob"

# Filter by PR title pattern
smm engineering-health evaluate \
    --category collaboration \
    --start-date 2026-07-01 \
    --end-date 2026-07-31 \
    --raw-filters "title=feat:|title=fix:"

# Combine multiple PR filters
smm engineering-health evaluate \
    --category collaboration \
    --start-date 2026-07-01 \
    --end-date 2026-07-31 \
    --raw-filters "state=open|author.login=alice|draft=false"
```

#### GitLab

GitLab uses similar filter keys but with GitLab-specific field names:

```bash
# Filter by GitLab pipeline status
smm engineering-health evaluate \
    --category delivery \
    --start-date 2026-07-01 \
    --end-date 2026-07-31 \
    --raw-filters "status=success|source=main"

# Filter GitLab merge requests
smm engineering-health evaluate \
    --category collaboration \
    --start-date 2026-07-01 \
    --end-date 2026-07-31 \
    --raw-filters "state=opened|author.username=alice"
```

### Important notes

- **Provider-specific**: The available filter keys depend on your data provider (GitHub, GitLab, etc.). Check the provider's documentation for available fields.
- **Case sensitivity**: Filter keys and values are case-sensitive and must match the provider's API exactly.
- **Boolean values**: Use lowercase `true`/`false` for boolean fields.
- **Date filtering**: For date ranges, use the standard `--start-date` and `--end-date` options instead of raw filters.
- **Field availability**: Not all fields are available for all metrics. Some filters may only apply to specific metric types (delivery vs. collaboration).

### Common use cases

```bash
# Focus on production deployments only
smm engineering-health evaluate \
    --category delivery \
    --start-date 2026-07-01 \
    --end-date 2026-07-31 \
    --raw-filters "name=deploy,environment=production"

# Exclude draft PRs from collaboration metrics
smm engineering-health evaluate \
    --category collaboration \
    --start-date 2026-07-01 \
    --end-date 2026-07-31 \
    --raw-filters "draft=false"

# Focus on main branch metrics
smm engineering-health evaluate \
    --category delivery \
    --start-date 2026-07-01 \
    --end-date 2026-07-31 \
    --raw-filters "branch=main|branch=master"

# Filter by specific team members
smm engineering-health evaluate \
    --category collaboration \
    --start-date 2026-07-01 \
    --end-date 2026-07-31 \
    --raw-filters "author.login=alice|author.login=bob|author.login=charlie"
```

## Reading the scorecard

The scorecard is grouped to make the report easier to scan:

- Categories are shown in the order Delivery, Quality, Collaboration, and Architecture.
- Delivery is split by deployment target so independent systems are not mixed together.
- Each category or deployment target is sorted by risk first: critical, watch, then good.
- Metrics with the largest movement appear first when risk levels are equal.

Use the scorecard as the first place to identify what needs attention. Use the metric appendix for the evidence behind
each scorecard item.

## Reading comparisons

The current date range is compared against the comparison date range. For example, if the current period is June 1 to
June 30 and the comparison period is May 1 to May 31, the report compares June against May.

The trend labels mean:

- **Improving**: the metric moved in the preferred direction.
- **Degrading**: the metric moved away from the target direction.
- **Stable**: the movement is present but not large enough to be called improving or degrading.
- **Unknown**: the page does not have enough information to compute a comparison.

## References

Metric targets and source material are available from the report itself and from the
[References page](./dashboard.md#references-and-targets). Inline citations point to the same reference list shown at the
end of the Engineering Health report.