# Metrics Catalog

Inventory of every metric type the application currently provides, with a proposed stable unique identifier
for each one.

## Current state

- Only **Engineering Health** has real metric identifiers today — the `EngineeringHealthMetricId` union in
  `packages/core/src/engineering-health/types.ts` (14 IDs).
- Every other domain is addressable only by its **CLI subcommand / REST route / MCP tool name**. There is no
  shared catalog, and some names already collide (`coupling`, `coverage`, `complexity` each mean different
  things in different domains).

## Proposed identifier scheme

Keep the existing kebab-case style and add a domain namespace so IDs are globally unique:

```
<namespace>-<metric>        e.g. cr-review-time, pl-deployment-frequency, sq-coverage
```

Namespaces: `cr` (change requests), `pl` (pipelines), `code`, `sq` (SonarQube), `arch`, `issue`, `eh`
(engineering health).

---

## 1. Change requests (`cr-`)

| ID                      | Metric                  | What it measures                                                                                                                                  | Surface                                                                                               |
| ----------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `cr-summary`            | Change request summary  | Totals, merged/open/closed, comments/CR, unique authors & labels, first/last CR, top themes, most commented, top commenter, time-to-first-comment | CLI `change-requests summary` · `GET /change-requests/summary` · MCP `smm_get_change_request_summary` |
| `cr-throughput`         | Throughput through time | Opened vs closed per day/week/month                                                                                                               | CLI `through-time` · REST · MCP `smm_get_change_request_through_time`                                 |
| `cr-volume-by-author`   | Volume by author        | CR count per author                                                                                                                               | CLI `by-author` · REST · MCP                                                                          |
| `cr-review-time`        | Review time             | Days from open to review, per author; `average/median/p75/p90/p95/min/max`                                                                        | CLI `review-time` · REST · MCP                                                                        |
| `cr-open-time`          | Open time               | Days open per day/week/month, per method                                                                                                          | CLI `open-time` · REST · MCP                                                                          |
| `cr-comments-per-cr`    | Comments per CR         | Comment count distribution, per method                                                                                                            | CLI `comments` · REST · MCP                                                                           |
| `cr-comments-by-author` | Comments by reviewer    | Comment volume per reviewer                                                                                                                       | REST `comments-by-author` · MCP                                                                       |
| `cr-first-comment-time` | Time to first comment   | Hours to first comment per author                                                                                                                 | REST `first-comment-time` · MCP                                                                       |
| `cr-period-metrics`     | Period metrics          | Total/merged/closed/open, comments, openDays, leadTime per week/month                                                                             | CLI `by-week` / `by-month` · MCP                                                                      |
| `cr-label-summary`      | Label distribution      | CR count per label                                                                                                                                | `getLabelSummaries` (inside summary)                                                                  |
| `cr-evaluation`         | Bottleneck signals      | `review_time`, `reviewer_workload`, `open_time`, `throughput`, `first_comment`, `comment_health`                                                  | `GET /change-requests/evaluate` · MCP                                                                 |

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
| `code-author-churn`     | Churn by author   | Added/deleted/commits per author                                                                                                                                                                     | CLI `churn --authors`                                  |
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

| ID                          | Metric               | What it measures                                                                                                                                      | Surface                                      |
| --------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `sq-coverage`               | Coverage             | Line coverage %                                                                                                                                       | `fetch-measures` · REST `/sonarqube/quality` |
| `sq-maintainability-rating` | Maintainability      | `sqale_rating` (1–5)                                                                                                                                  | measures                                     |
| `sq-reliability-rating`     | Reliability          | Reliability rating                                                                                                                                    | evaluation                                   |
| `sq-security-rating`        | Security             | Security rating                                                                                                                                       | evaluation                                   |
| `sq-complexity`             | Complexity           | Total cyclomatic complexity                                                                                                                           | measures                                     |
| `sq-cognitive-complexity`   | Cognitive complexity | Per-component cognitive complexity                                                                                                                    | component tree                               |
| `sq-duplication-density`    | Duplication          | `duplicated_lines_density` %                                                                                                                          | measures                                     |
| `sq-ncloc`                  | Size                 | Non-commenting lines of code                                                                                                                          | measures / tree                              |
| `sq-code-smells`            | Code smells          | Code smell count                                                                                                                                      | measures                                     |
| `sq-bugs`                   | Bugs                 | Bug count                                                                                                                                             | measures                                     |
| `sq-component-tree`         | Component tree       | Per-component metric rows                                                                                                                             | `fetch-component-tree` · REST                |
| `sq-measurements-history`   | Historical measures  | Time series per metric                                                                                                                                | `fetch-historical-measures` · REST           |
| `sq-evaluation`             | Quality signals      | `reliability_rating`, `security_rating`, `maintainability_rating`, `duplication_density`, `coverage_health`, `complexity_outlier`, `coverage_outlier` | `GET /sonarqube/evaluate` · MCP              |

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

| ID                | Metric        | What it measures                                    | Surface                     |
| ----------------- | ------------- | --------------------------------------------------- | --------------------------- |
| `issue-total`     | Issue count   | Total issues (+ raw issue list) for a window/status | MCP `smm_get_issue_metrics` |
| `issue-list`      | Issue records | Raw issue rows                                      | MCP · cache                 |
| `issue-changelog` | Changelog     | Issue status transitions                            | CLI `jira fetch-changelog`  |
| `issue-comments`  | Comments      | Issue comments                                      | CLI `jira fetch-comments`   |

> Note: Jira currently has **no derived analytics** — only fetch + count. Any real issue metric (lead time,
> cycle time, WIP) would be net-new.

## 7. Engineering health (`eh-`, already implemented)

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

**Totals:** ~85 distinct metric types across 7 namespaces, of which only 14 have stable IDs today.

## Suggested implementation

1. Add `packages/core/src/domain/metrics/metric-catalog.ts` with a `MetricId` union for all ~85 IDs plus a
   `METRIC_CATALOG` record (`id`, `namespace`, `label`, `unit`, `direction`, `source`, `surfaces`).
2. Re-export from `packages/core/src/domain/metrics/index.ts` and `@smmachine/core`.
3. Keep the 14 engineering-health IDs as canonical values; add namespaced aliases (`eh-coverage`) only if full
   uniformity is desired.
4. Add `smm metrics list [--namespace] [--json]` and `GET /metrics` so the catalog is discoverable, and have
   MCP `smm_list_engineering_health_metrics` read from it.
5. Guard uniqueness with a registry test (no duplicate IDs, every CLI command and REST route maps to a
   catalog entry).

## Open decisions

1. **Granularity** — one ID per command/endpoint (the ~85 above), or also one ID per output field (~250)?
2. **Existing EH IDs** — keep them unprefixed (`coverage`, `coupling`) or migrate to `eh-coverage` /
   `eh-coupling` with aliases?
