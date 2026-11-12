---
outline: deep
---

<script setup>
import MetricsCatalogTable from '../.vitepress/theme/components/MetricsCatalogTable.vue'
</script>

# Metric catalog

Every metric type exposed by SMM has a stable, namespaced identifier owned by the core package. The same id is used
by the CLI, the REST API, the MCP server, and the dashboard, so it is safe to persist, log, or reference across
releases.

Identifiers name a **metric family** (for example `cr-review-time`), not a single number. Statistical method,
aggregation period, and scope are parameters of that family.

Browse the [full catalog](#full-catalog) for a description of every family, or download it as CSV.

## Namespaces

| Prefix   | Area                                         |
| -------- | -------------------------------------------- |
| `cr-`    | Change requests                              |
| `pl-`    | Pipelines                                    |
| `code-`  | Source code                                  |
| `sq-`    | SonarQube                                    |
| `arch-`  | Architecture                                 |
| `issue-` | Issues                                       |
| `eh`     | Engineering health (existing unprefixed ids) |

## Full catalog

Every metric family in the catalog, with what it measures, how it is computed (the evidence it reads, the
formula applied, and the math notation), its unit and preferred direction, and the CLI, REST, and MCP surfaces
that expose it. Use the search box or the namespace filter to narrow the list, and select **Download CSV** to
export the same data for offline analysis.

<MetricsCatalogTable />

The catalog and the CSV file are generated from `packages/core/src/domain/metrics/` with `pnpm docs:metrics`.
`pnpm docs:metrics:check` fails when the committed artifacts drift from the catalog, and the core test suite checks
the same files.

## Inspect the catalog

```bash
# Every catalogued metric
smm metrics list

# Only one namespace
smm metrics list --namespace cr

# Include internal metrics (omitted by default on public filters)
smm metrics list --visibility internal

# Machine-readable output, including evidence, formula, and notation
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

Open **References & Sources** (`/references`, via the **References** button on the home page). The page reads
`GET /metrics` and shows every catalogued metric that carries a documented target, grouped by namespace. Each card
shows the stable id, the target, the description, and the external papers, reports, and books behind it.

The summary chips at the top of the page are clickable and reveal what they count:

- **Documented metrics** — every metric that has a published target or source, linked to its card.
- **Sources** — the consolidated source index with the metrics that cite each work.
- **Catalogued metrics** — the full catalog, flagging entries that have no published reference yet.

Dashboard cards use the same catalog entries for their info popover, so a target or source is defined once in
`packages/core/src/domain/metrics/`.

## Stability

- Ids are public API. Renaming one is a breaking change; mark the entry `deprecated` and point `replacedBy` at its
  successor instead.
- Published targets and sources live in `metric-references.ts`, keyed by `CatalogMetricId`, so evidence cannot
  reference an unknown metric id.
- Every entry defines `computation.evidence` (the records and fields identified as input),
  `computation.formula` (how that input becomes the reported value), and `computation.notation` (the compact
  mathematical form). All three are exposed by the CLI, REST API, MCP server, dashboard cards, and the
  generated CSV.
- The CLI, REST, and MCP surfaces are checked against the catalog by coverage tests in their owning apps.
