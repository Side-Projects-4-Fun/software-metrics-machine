---
outline: deep
---

# Features

Software Metrics Machine (SMM) offers multiple ways to analyze and visualize engineering metrics.

## Dashboard

To see the dashboard, you first need to start it with the following command:

```bash
smm dashboard serve
```

The command will hang the terminal and start a local server on port 3000.

### Accessing the Dashboard

The dashboard, is available under the local url `http://localhost:3000` in your web browser.

![Dashboard Overview](/dashboard/dashboard.png)

The dashboard provides the following features:

- **Data Visualization**: View your data in various formats such as tables, charts, and graphs.
- **Filtering and Sorting**: Filter by date, timezone, provider-specific fields, authors, labels, paths, branches, and events.
- **Saved Views**: Save frequently used filters per project and dashboard section.
- **Project Switching**: Move between configured repositories from the project drawer.
- **Cross-domain Insights**: PRs, pipelines, source code, and SonarQube.
- **References and Targets**: Review the sources used to define metric targets and recommendations.

See [Dashboard](./features/dashboard.md) for the shared dashboard behavior.

## CLI

For CLI access, run:

```bash
smm
```

Main command groups:

- `smm prs`
- `smm pipelines`
- `smm code`
- `smm architecture`
- `smm jira`
- `smm sonarqube`
- `smm dashboard`
- `smm tools`
- `smm health-check`

## REST API

SMM provides a REST API for integrations and automation.

Start REST API with:

```bash
smm dashboard serve
```

Swagger docs are available at `http://localhost:3000/api/docs` by default.

See [REST API](./rest-api.md) for endpoint overview.

## Explore

Each feature has its own page:

- [Insights](./features/insights.md)
- [Dashboard](./features/dashboard.md)
- [Source Code](./features/code.md)
- [Architecture](./features/architecture.md)
- [Pull Requests](./features/prs.md)
- [Pipelines](./features/pipelines.md)
- [Configuration](./features/configuration.md)
- [SonarQube](./sonarqube.md)
