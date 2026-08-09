---
outline: deep
---

# Dashboard

The dashboard is the main web interface for exploring Software Metrics Machine data. Start it with:

```bash
smm dashboard serve
```

Then open `http://localhost:3000`. The `/dashboard` route opens the Insights tab by default.

## Sections

The dashboard is split into these tabs:

- **Insights**: cross-domain recommendations, deployment frequency, pairing index, pipeline summary, and change request summary.
- **Engineering Health**: leadership report for delivery, quality, collaboration, and architecture signals.
- **Pipelines**: workflow run duration, job duration, job status, reruns, and job step analysis.
- **Change Requests**: review time, comment activity, change request throughput, themes, and change request statistics.
- **Source Code**: churn, effort, ownership, coupling, pairing, paired commits, and Big O classification.
- **Architecture**: C4-style diagrams, elements, and relationships from generated architecture snapshots.
- **SonarQube**: quality ratings, measurements, component metrics, and historical trends.

The current tab keeps the active query-string filters when you move between dashboard sections.

See [Engineering Health](./engineering-health.md) for the report page that combines these signals into scorecards,
trend analysis, deployment-target delivery views, and printable report references.

## Navigation and utilities

The dashboard frame includes:

- A project drawer for switching between configured repositories.
- A filter drawer for the active dashboard section.
- A light/dark theme toggle.
- A print action for the current dashboard page.
- A shortcut to the Software Metrics Machine repository.
- A shortcut to the References & Sources page.

When you select another project, the dashboard stores it in the `smm_active_project` cookie and clears stale filter query
parameters from the current URL.

## Date and timezone filters

The dashboard provides shared date controls for the metrics that are filtered by time. The date picker supports:

- Presets: Today, Yesterday, Last 7 days, Last 30 days, This month, and Last month.
- Calendar range selection.
- Absolute start and end date-time inputs.
- Clear, Cancel, and Apply actions.

The dashboard serializes selected dates into the URL as `startDate` and `endDate`. For time-based dashboard requests, it
also sends the browser timezone as the `timezone` query parameter so date-only filtering and time grouping match the
person using the dashboard.

The timezone is detected in the browser with `Intl.DateTimeFormat().resolvedOptions().timeZone` and should be an IANA
timezone identifier, for example `Europe/Madrid`, `America/New_York`, or `UTC`. Users do not normally need to configure
this manually in the dashboard. When sharing a dashboard URL with clients, keep the `timezone` parameter in the URL if
you want everyone opening the link to see the same date boundaries and grouped periods.

If the dashboard request does not include a valid `timezone`, the API falls back to the active project's configured
`timezone`, then to `UTC`.

## Saved views

Filters can be saved from the filter drawer. The **Save Filter** button opens a dialog where you name the current filter
state. The saved view records the dashboard section, pathname, current filter values, active repository, and a timestamp.

Saved views are stored per-project alongside your metrics data in `saved-filters.json`. Both the dashboard and the CLI
read from the same file, so filters saved in one surface are available in the other.

:::tabs key:cli
== Dashboard

The filter drawer shows the **Save Filter** and **Delete Filter** buttons above the filter controls. When a saved view's
filter values match the current URL parameters, the saved view is shown as selected in the filter dropdown.

The home page shows saved views grouped by project and dashboard section so common slices can be reopened directly.

== CLI

List saved filters, optionally filtered by section:

```bash
smm filters list
smm filters list --section pipelines
```

Save a filter with the options you want to reuse:

```bash
smm filters save "Q3 main branch" \
  --section pipelines \
  --start-date 2026-07-01 \
  --end-date 2026-09-30 \
  --workflow-selector ci.yml \
  --weekends exclude
```

The `--section` option is required. Available sections are `insights`, `pipelines`, `change-requests`,
`source-code`, `engineering-health`, `architecture`, and `sonarqube`.

Show and delete saved filters:

```bash
smm filters show "Q3 main branch"
smm filters delete "Q3 main branch"
```

Output as JSON when scripting:

```bash
smm filters list --output json
```
:::

### Applying saved filters to metric commands

Use the `--filter` flag on metric commands to apply a saved filter's values automatically.
Explicit command-line flags override the saved filter.

```bash
smm pipelines summary --filter "Q3 main branch"
smm pipelines runs-by --filter "Q3 main branch" --period month
smm change-requests summary --filter "Team Alpha reviews"
```

The filter section must match the command that uses it. A filter saved under `pipelines` is applied
to `smm pipelines ...` commands, a `change-requests` filter to `smm change-requests ...` commands, and so on.

## References and targets

The `/dashboard/references` page lists the metric targets and sources used by dashboard recommendations and target info
popovers. Sources are grouped by Code Analysis, Pipelines, Change Requests, and SonarQube.

Many dashboard cards show an info control with the target value, explanation, and supporting sources for that metric.

## Filter URL format

Dashboard filters are represented as query-string parameters. List filters are encoded as comma-separated values.

For example:

```text
/dashboard/pipelines?startDate=2026-01-01T00:00:00%2B01:00&endDate=2026-01-31T23:59:59%2B01:00&workflowStatus=completed&timezone=Europe%2FMadrid
```

Each feature page documents the filters specific to that dashboard tab.
