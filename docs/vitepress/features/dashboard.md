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

- **Insights**: cross-domain recommendations, deployment frequency, pairing index, pipeline summary, and pull request summary.
- **Pipelines**: workflow run duration, job duration, job status, reruns, and job step analysis.
- **Pull Requests**: review time, comment activity, PR throughput, themes, and PR statistics.
- **Source Code**: churn, effort, ownership, coupling, pairing, paired commits, and Big O classification.
- **Architecture**: C4-style diagrams, elements, and relationships from generated architecture snapshots.
- **SonarQube**: quality ratings, measurements, component metrics, and historical trends.

The current tab keeps the active query-string filters when you move between dashboard sections.

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

Filters can be saved from the filter drawer. A saved view records:

- The dashboard section.
- The current pathname.
- The current filter values.
- The active repository.
- The saved view name.

Saved views are stored in browser local storage under `smm.saved-filters`. The home page shows saved views grouped by
project and dashboard section, so common slices can be reopened directly. Saved views can also be deleted from the filter
drawer.

## References and targets

The `/dashboard/references` page lists the metric targets and sources used by dashboard recommendations and target info
popovers. Sources are grouped by Code Analysis, Pipelines, Pull Requests, and SonarQube.

Many dashboard cards show an info control with the target value, explanation, and supporting sources for that metric.

## Filter URL format

Dashboard filters are represented as query-string parameters. List filters are encoded as comma-separated values.

For example:

```text
/dashboard/pipelines?startDate=2026-01-01T00:00:00%2B01:00&endDate=2026-01-31T23:59:59%2B01:00&workflowStatus=completed&timezone=Europe%2FMadrid
```

Each feature page documents the filters specific to that dashboard tab.
