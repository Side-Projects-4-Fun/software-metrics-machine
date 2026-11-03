---
outline: deep
---

# Features

Software Metrics Machine (SMM) offers multiple ways to analyze and visualize engineering metrics.

![Dashboard Overview](/dashboard/dashboard.png)

The dashboard provides the following features:

- **Data Visualization**: View your data in various formats such as tables, charts, and graphs.
- **Filtering and Sorting**: Filter by date, timezone, provider-specific fields, authors, labels, paths, branches, and events.
- **Saved Views**: Save frequently used filters per project and dashboard section.
- **Project Switching**: Move between configured repositories from the project drawer.
- **Cross-domain Insights**: Change requests, pipelines, source code, and SonarQube.
- **Engineering Health Report**: leadership scorecards across delivery, quality, collaboration, and architecture in the dashboard or CLI.
- **References and Targets**: Review the sources used to define metric targets and recommendations.

See [Dashboard](./features/dashboard.md) for the shared dashboard behavior.

## CLI

For CLI access, run:

```bash
smm
```

Main command groups:

- `smm change-requests`
- `smm pipelines`
- `smm code`
- `smm architecture`
- `smm jira`
- `smm sonarqube`
- `smm engineering-health`
- `smm metrics`
- `smm filters`
- `smm dashboard`
- `smm tools`
- `smm health-check`
- `smm mcp`
- `smm project`

## REST API

SMM provides a REST API for integrations and automation.

Start REST API with:

```bash
smm dashboard serve
```

Swagger docs are available at `http://localhost:8000/api/docs` when the API runs in development. With
`smm dashboard serve` the REST API defaults to port `3001` (override with `--rest-port`).

See [REST API](./rest-api.md) for endpoint overview.

## Explore

Each feature has its own page:

- [Insights](./features/insights.md)
- [Dashboard](./features/dashboard.md)
- [Engineering Health](./features/engineering-health.md)
- [Metric catalog](./features/metric-catalog.md)
- [Source Code](./features/code.md)
- [Architecture](./features/architecture.md)
- [Change Requests](./features/change-requests.md)
- [Pipelines](./features/pipelines.md)
- [Configuration](./features/configuration.md)
- [SonarQube](./sonarqube.md)
