# Metrics Catalog

Inventory of every metric type the application provides, each with a stable unique identifier.

> **Source of truth:** `packages/core/src/domain/metrics/metric-catalog.ts` (metadata) and
> `packages/core/src/domain/metrics/metric-implementations.ts` (service bindings). This page is the
> human-readable inventory; it is being migrated to generated output. See
> [ADR 0007](../adrs/0007-metric-catalog-as-static-data.md) for the design rationale.

## Implementation status

- Phase 0 (leaf import for `MetricMethod`) and Phase 1 (static catalog + typed implementation bindings +
  catalog tests) are implemented in `packages/core/src/domain/metrics/`.
- The catalog is exported from `@smmachine/core` as `METRIC_CATALOG` and `METRIC_IMPLEMENTATIONS`.
- `CatalogMetricId` is the derived ID union. It is temporarily named `CatalogMetricId` because
  `engineering-health/types.ts` already exports a `MetricId`; the two will be unified when Engineering Health
  adopts the catalog IDs.
- Discovery surfaces are live: `smm metrics list`, `GET /metrics`, and MCP `smm_list_metrics`.
- Forward surface-coverage tests check that every catalogued CLI command, REST route, and MCP tool exists.
- Reverse surface-coverage tests require every leaf CLI command, REST route, and MCP tool to be catalogued or
  explicitly allowlisted as non-metric.
- Pending: generated docs and the webapp artifact.

## Identifier scheme

Keep the existing kebab-case style and add a domain namespace so IDs are globally unique:

```
<namespace>-<metric>        e.g. cr-review-time, pl-deployment-frequency, sq-coverage
```

Namespaces: `cr` (change requests), `pl` (pipelines), `code`, `sq` (SonarQube), `arch`, `issue`, `eh`
(engineering health).

## Discovery

```bash
smm metrics list
smm metrics list --namespace eh --output json
smm metrics list --visibility internal
```

Equivalent surfaces: `GET /metrics?namespace=eh&visibility=public` and the MCP tool `smm_list_metrics`. On
every surface, omitting `visibility` means no filter (all 86 metrics); pass `public` or `internal` to narrow.

---

## 1. Change requests (`cr-`)

| ID                      | Metric                   | What it measures                                                                                                                                  | Surface                                                                                               |
| ----------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `cr-summary`            | Change request summary   | Totals, merged/open/closed, comments/CR, unique authors & labels, first/last CR, top themes, most commented, top commenter, time-to-first-comment | CLI `change-requests summary` · `GET /change-requests/summary` · MCP `smm_get_change_request_summary` |
| `cr-metrics`            | Change request metrics   | Aggregate open days, comments, lead time, label and comment summaries                                                                             | `GET /api/metrics/change-requests` · MCP `smm_get_change_request_metrics`                             |
| `cr-throughput`         | Throughput through time  | Opened vs closed per day/week/month                                                                                                               | CLI `through-time` · REST · MCP `smm_get_change_request_through_time`                                 |
| `cr-volume-by-author`   | Volume by author         | CR count per author                                                                                                                               | CLI `by-author` · REST · MCP                                                                          |
| `cr-review-time`        | Review time              | Days from open to review, per author; `average/median/p75/p90/p95/min/max`                                                                        | CLI `review-time` · REST · MCP                                                                        |
| `cr-open-time`          | Open time                | Days open per day/week/month, per method                                                                                                          | CLI `open-time` · REST · MCP                                                                          |
| `cr-comments-per-cr`    | Comments per CR          | Comment count distribution, per method                                                                                                            | CLI `comments` · REST · MCP                                                                           |
| `cr-comments-by-author` | Comments by reviewer     | Comment volume per reviewer                                                                                                                       | REST `comments-by-author` · MCP                                                                       |
| `cr-first-comment-time` | Time to first comment    | Hours to first comment per author                                                                                                                 | REST `first-comment-time` · MCP                                                                       |
| `cr-metrics-by-week`    | Change requests by week  | Total/merged/closed/open, comments, openDays, leadTime per week                                                                                   | CLI `by-week` · MCP `smm_get_change_request_metrics_by_week`                                          |
| `cr-metrics-by-month`   | Change requests by month | Total/merged/closed/open, comments, openDays, leadTime per month                                                                                  | CLI `by-month` · MCP `smm_get_change_request_metrics_by_month`                                        |
| `cr-label-summary`      | Label distribution       | CR count per label                                                                                                                                | `getLabelSummaries` (inside summary)                                                                  |
| `cr-evaluation`         | Bottleneck signals       | `review_time`, `reviewer_workload`, `open_time`, `throughput`, `first_comment`, `comment_health`                                                  | `GET /change-requests/evaluate` · MCP                                                                 |

## 2. Pipelines (`pl-`)

| ID                             | Metric                       | What it measures                                                                                                 | Surface                                                             |
| ------------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `pl-summary`                   | Run summary                  | Total/in-progress/queued/successful/failed/cancelled/skipped/timed-out, success rate, duration (`value`), method | CLI `pipelines summary` · REST · MCP                                |
| `pl-status-counts`             | Runs by status               | Run count per conclusion                                                                                         | CLI `by-status`                                                     |
| `pl-job-status-counts`         | Jobs by status               | Job count per status                                                                                             | CLI `jobs-by-status` · REST                                         |
| `pl-run-duration`              | Run duration                 | Min/max/avg duration per workflow                                                                                | CLI `runs-duration` · REST                                          |
| `pl-runs-over-time`            | Runs over time               | Runs per period per workflow                                                                                     | CLI `runs-by` · REST                                                |
| `pl-jobs-summary`              | Job summary                  | Success/failure/rerun counts and rates per job                                                                   | CLI `jobs-summary` · REST                                           |
| `pl-job-duration`              | Job execution time           | Duration per job, per method                                                                                     | CLI `jobs-time-execution` · REST                                    |
| `pl-job-duration-by-day`       | Job time by day              | Daily job duration series                                                                                        | REST `jobs-time-execution-by-day`                                   |
| `pl-job-steps-duration`        | Step execution time          | Duration per pipeline step                                                                                       | CLI `jobs-steps-time` · REST                                        |
| `pl-job-steps-duration-by-day` | Step time by day             | Daily step duration series                                                                                       | REST `jobs-steps-time-by-day`                                       |
| `pl-reruns-by-day`             | Reruns by day                | Rerun count per day                                                                                              | REST `jobs-reruns-by-day`                                           |
| `pl-jobs-duration-by-workflow` | Duration matrix              | Job duration grouped by workflow                                                                                 | REST `jobs-duration-by-workflow`                                    |
| `pl-deployment-frequency`      | Deployment frequency (DORA)  | Deployments per day/week/month                                                                                   | CLI `deployment-frequency` · `GET /dora/deployment-frequency` · MCP |
| `pl-lead-time`                 | Lead time for changes (DORA) | Time from commit to deploy, minutes                                                                              | CLI `lead-time`                                                     |
| `pl-evaluation`                | Pipeline signals             | `duration_top_job`, `stability_worst_job`, `rerun_analysis`, `slowest_workflow`, `job_overview`                  | `GET /pipelines/evaluate` · MCP                                     |

## 3. Code (`code-`)

| ID                      | Metric            | What it measures                                                                                                                                                                                     | Surface                                                |
| ----------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `code-big-o`            | Big O complexity  | Per-file classification (`O(1)`…`O(n^3+)`), score, `needsHelp`                                                                                                                                       | CLI `big-o` · REST `/code/big-o` · MCP                 |
| `code-summary`          | Code summary      | Pairing insights overview                                                                                                                                                                            | CLI `code summary`                                     |
| `code-churn`            | Code churn        | Commits, lines added/deleted, total churn                                                                                                                                                            | CLI `churn` · REST `/code/code-churn` · MCP            |
| `code-author-churn`     | Churn by author   | Added/deleted/commits per author                                                                                                                                                                     | CLI `churn` (`--authors`)                              |
| `code-coupling`         | File coupling     | Coupling degree and average revisions                                                                                                                                                                | CLI `coupling` · REST · MCP                            |
| `code-layered-coupling` | Layered coupling  | Architectural-layer coupling                                                                                                                                                                         | REST `/code/layered-coupling` · MCP                    |
| `code-entity-churn`     | Entity churn      | Added/deleted/commits per entity                                                                                                                                                                     | CLI `entity-churn` · REST · MCP                        |
| `code-entity-effort`    | Entity effort     | `total-revs` per entity                                                                                                                                                                              | CLI `entity-effort` · REST · MCP                       |
| `code-entity-ownership` | Entity ownership  | Added/deleted per author per entity                                                                                                                                                                  | CLI `entity-ownership` · REST · MCP                    |
| `code-pairing-index`    | Pairing index     | % paired commits, paired commit count, top pairs                                                                                                                                                     | CLI `pairing-index` · REST `/code/pairing-index` · MCP |
| `code-crap`             | CRAP score        | Complexity × coverage risk per file                                                                                                                                                                  | Code evaluation payload                                |
| `code-*-history`        | Historical series | `code-churn-history`, `code-coupling-history`, `code-layered-coupling-history`, `code-entity-churn-history`, `code-entity-effort-history`, `code-entity-ownership-history`                           | REST `/history` routes · MCP                           |
| `code-evaluation`       | Code signals      | `churn_hotspot`, `churn_trend`, `coupling_top`, `coupling_burst`, `ownership_concentration`, `ownership_unknown`, `complexity_hotspot`, `complexity_big_o`, `pairing_index`, `pairing_concentration` | `GET /code/evaluate` · MCP                             |

## 4. Quality / SonarQube (`sq-`)

| ID                          | Metric                 | What it measures                                                                                                                                      | Surface                                        |
| --------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `sq-coverage`               | Coverage               | Line coverage %                                                                                                                                       | `fetch-measures` · REST `/sonarqube/quality`   |
| `sq-maintainability-rating` | Maintainability        | `sqale_rating` (1–5)                                                                                                                                  | measures                                       |
| `sq-reliability-rating`     | Reliability            | Reliability rating                                                                                                                                    | evaluation                                     |
| `sq-security-rating`        | Security               | Security rating                                                                                                                                       | evaluation                                     |
| `sq-complexity`             | Complexity             | Total cyclomatic complexity                                                                                                                           | measures                                       |
| `sq-cognitive-complexity`   | Cognitive complexity   | Per-component cognitive complexity                                                                                                                    | component tree                                 |
| `sq-duplication-density`    | Duplication            | `duplicated_lines_density` %                                                                                                                          | measures                                       |
| `sq-ncloc`                  | Size                   | Non-commenting lines of code                                                                                                                          | measures / tree                                |
| `sq-code-smells`            | Code smells            | Code smell count                                                                                                                                      | measures                                       |
| `sq-bugs`                   | Bugs                   | Bug count                                                                                                                                             | measures                                       |
| `sq-component-tree`         | Component tree         | Per-component metric rows                                                                                                                             | `fetch-component-tree` · REST                  |
| `sq-component-tree-history` | Component tree history | Timestamped component tree entries                                                                                                                    | REST `/sonarqube/component-tree/history` · MCP |
| `sq-measurements`           | Raw measurements       | Raw SonarQube measure set                                                                                                                             | REST `/sonarqube/measurements` · MCP           |
| `sq-measurements-history`   | Historical measures    | Time series per metric                                                                                                                                | `fetch-historical-measures` · REST             |
| `sq-evaluation`             | Quality signals        | `reliability_rating`, `security_rating`, `maintainability_rating`, `duplication_density`, `coverage_health`, `complexity_outlier`, `coverage_outlier` | `GET /sonarqube/evaluate` · MCP                |

## 5. Architecture (`arch-`)

| ID                              | Metric                   | What it measures                                                     | Surface                                        |
| ------------------------------- | ------------------------ | -------------------------------------------------------------------- | ---------------------------------------------- |
| `arch-snapshot`                 | Snapshot                 | Persisted architecture snapshot metadata                             | CLI `architecture generate` / `list-snapshots` |
| `arch-summary`                  | Architecture summary     | Containers, edges, avg confidence, orphan nodes, most-connected, hub | `GET /architecture/summary` · MCP              |
| `arch-view`                     | C4 view                  | Context/container/component/code nodes + edges                       | CLI `export` · `GET /architecture/view` · MCP  |
| `arch-container-count`          | Container count          | Number of containers                                                 | evaluation signal                              |
| `arch-dependency-concentration` | Dependency concentration | Edge concentration                                                   | evaluation signal                              |
| `arch-hub-dependency`           | Hub dependency           | Most-depended-on node                                                | evaluation signal                              |
| `arch-orphan-nodes`             | Orphan nodes             | Nodes with no edges                                                  | evaluation signal                              |
| `arch-confidence-health`        | Confidence health        | Average relationship confidence                                      | evaluation signal                              |
| `arch-evaluation`               | Architecture signals     | All of the above                                                     | `GET /architecture/evaluate` · MCP             |

## 6. Issues / Jira (`issue-`)

| ID            | Metric        | What it measures                 | Surface                     |
| ------------- | ------------- | -------------------------------- | --------------------------- |
| `issue-total` | Issue count   | Total issues for a window/status | MCP `smm_get_issue_metrics` |
| `issue-list`  | Issue records | Raw issue rows backing the count | internal                    |

> Note: Jira `fetch-changelog` and `fetch-comments` are data-fetch operations, not metrics, and are not in
> the catalog. Jira currently has **no derived analytics** — only fetch + count. Any real issue metric (lead
> time, cycle time, WIP) would be net-new.

## 7. Engineering health (namespace `eh`, IDs intentionally unprefixed)

| Existing ID              | Category      | Unit               | Direction        | Target     |
| ------------------------ | ------------- | ------------------ | ---------------- | ---------- |
| `deployment-frequency`   | delivery      | deployments/period | higher is better | ≥ 1        |
| `lead-time`              | delivery      | minutes            | lower is better  | < 1440     |
| `pipeline-duration`      | delivery      | minutes            | lower is better  | < 10       |
| `failure-rate`           | delivery      | %                  | lower is better  | < 15       |
| `complexity`             | quality       | score              | lower is better  | < 1000     |
| `duplication`            | quality       | %                  | lower is better  | < 5        |
| `coverage`               | quality       | %                  | higher is better | ≥ 80       |
| `review-time`            | collaboration | days               | lower is better  | < 1        |
| `review-participation`   | collaboration | reviewers          | higher is better | ≥ 3        |
| `pair-programming`       | collaboration | %                  | higher is better | ≥ 30       |
| `knowledge-distribution` | collaboration | %                  | higher is better | ≥ 60       |
| `coupling`               | architecture  | degree             | lower is better  | < 10       |
| `ownership`              | architecture  | %                  | lower is better  | < 40       |
| `components`             | architecture  | components         | neutral          | trend only |

---

## Collisions worth fixing while adding IDs

| Name               | Meaning A                                       | Meaning B                                                        |
| ------------------ | ----------------------------------------------- | ---------------------------------------------------------------- |
| `coupling`         | EH architecture (avg coupling degree, CodeMaat) | `code-coupling` (file coupling pairs)                            |
| `coverage`         | EH quality (SonarQube %)                        | `sq-coverage` (raw measure) — same source, different aggregation |
| `complexity`       | EH quality (SonarQube total)                    | `sq-complexity`, `code-big-o` (per-file)                         |
| `lead-time`        | EH delivery                                     | `pl-lead-time` (same computation, different exposure)            |
| `pair-programming` | EH collaboration                                | `code-pairing-index` (same pairing service)                      |

**Totals:** 86 metric types across 7 namespaces. All 86 have stable IDs in the code catalog today.

## Implementation notes

1. `packages/core/src/domain/metrics/metric-catalog.ts` holds the metadata and derives `CatalogMetricId`.
2. `metric-implementations.ts` maps each ID to a service/method pair. `Record<CatalogMetricId, ...>` plus a
   type-level key equality assertion make a missing or orphan binding a compile error.
3. The 14 engineering-health IDs stay unprefixed; the catalog marks their namespace as `eh`.
4. Tests cover kebab-case IDs, namespace prefixes, public/internal surface rules, required fields, and
   catalog/implementation key equality.
5. Pending: `smm metrics list`, `GET /metrics`, CLI/REST/MCP surface-coverage tests, and generated docs/webapp
   artifacts.

## Resolved decisions

1. **Granularity** — one ID per queryable metric family, not per output field. Method, period, and scope are
   parameters and never part of the ID.
2. **Existing EH IDs** — keep them unprefixed (`coverage`, `coupling`). Namespace metadata disambiguates them
   from `sq-coverage` and `code-coupling`, so no migration is needed.
