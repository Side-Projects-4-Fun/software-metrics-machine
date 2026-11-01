---
outline: deep
---

# Metric catalog

Every metric type exposed by SMM has a stable, namespaced identifier owned by the core package. The same id is used
by the CLI, the REST API, the MCP server, and the dashboard, so it is safe to persist, log, or reference across
releases.

Identifiers name a **metric family** (for example `cr-review-time`), not a single number. Statistical method,
aggregation period, and scope are parameters of that family.

## Namespaces

| Prefix  | Area              |
| ------- | ----------------- |
| `cr-`   | Change requests   |
| `pl-`   | Pipelines         |
| `code-` | Source code       |
| `sq-`   | SonarQube         |
| `arch-` | Architecture      |
| `issue-`| Issues            |
| `eh`    | Engineering health (existing unprefixed ids) |

## Inspect the catalog

```bash
# Every catalogued metric
smm metrics list

# Only one namespace
smm metrics list --namespace cr

# Include internal metrics (omitted by default on public filters)
smm metrics list --visibility internal

# Machine-readable output
smm metrics list --output json
```

```text
GET /metrics
GET /metrics?namespace=eh&visibility=public
```

```text
MCP tool:     smm_list_metrics
```

## Where to see it in the dashboard

Open **References & Sources** (`/dashboard/references`, book icon in the top bar). The page reads
`GET /metrics` and shows every catalogued metric that carries a documented target, grouped by namespace. Each card
shows the stable id, the target, the description, and the external papers, reports, and books behind it.

Dashboard cards use the same catalog entries for their info popover, so a target or source is defined once in
`packages/core/src/domain/metrics/`.

## Stability

- Ids are public API. Renaming one is a breaking change; mark the entry `deprecated` and point `replacedBy` at its
  successor instead.
- Published targets and sources live in `metric-references.ts`, keyed by `CatalogMetricId`, so evidence cannot
  reference an unknown metric id.
- The CLI, REST, and MCP surfaces are checked against the catalog by coverage tests in their owning apps.
