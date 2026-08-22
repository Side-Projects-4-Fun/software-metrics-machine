---
outline: deep
---

# MCP server

Software Metrics Machine includes a Model Context Protocol (MCP) server so agent clients (Copilot Chat, Claude Desktop,
Cursor, and other MCP-compatible clients) can read engineering metrics through a standard protocol.

The server is **read-only**. It exposes metrics that already exist in the SMM data store and does not fetch from
GitHub, GitLab, Jira, or SonarQube by itself. For data collection, continue to use the CLI commands such as
`smm change-requests fetch`, `smm pipelines fetch`, `smm jira fetch`, and the SonarQube commands.

## When to use it

Use the MCP server when you want an assistant or agent client to answer questions such as:

- How is the team doing this sprint according to engineering health?
- Did deployment frequency and failure rate improve compared with last month?
- Which files have the highest churn and strongest coupling?
- What does the complete metrics report say for a project?
- What does the latest architecture snapshot show at the container level?

## Start the server

The server reads the same configuration as the CLI and REST API. Set `SMM_STORE_DATA_AT` to the directory that contains
`smm_config.json`.

Start the server with the globally installed `smm` command:

```bash
SMM_STORE_DATA_AT=/path/to/smm-data smm mcp server start
```

The server uses stdio transport, which is the expected mode for local MCP clients.

Alternatively, run the MCP package directly:

```bash
SMM_STORE_DATA_AT=/path/to/smm-data smm-mcp
```

## Client configuration

Most MCP clients accept a command plus environment variables. Configure the client to run the globally installed `smm`
command:

```json
{
  "mcpServers": {
    "software-metrics-machine": {
      "command": "smm",
      "args": ["mcp", "server", "start"],
      "env": {
        "SMM_STORE_DATA_AT": "/path/to/smm-data"
      }
    }
  }
}
```

## Configure VS Code

VS Code can run MCP servers from either a workspace configuration or a user profile configuration. Use a workspace
configuration when the SMM data directory belongs to one project, and use a user profile configuration when you want the
same server available across several workspaces.

### 1. Install SMM globally

Make sure the `smm` command is available in your terminal:

```bash
smm --help
```

### 2. Create the VS Code MCP configuration

In the workspace where you want to use SMM metrics, create `.vscode/mcp.json`:

```json
{
  "servers": {
    "software-metrics-machine": {
      "type": "stdio",
      "command": "smm",
      "args": ["mcp", "server", "start"],
      "env": {
        "SMM_STORE_DATA_AT": "/path/to/smm-data"
      }
    }
  }
}
```

Replace `/path/to/smm-data` with the directory that contains `smm_config.json`.

If you prefer a user-level setup, open the Command Palette and run `MCP: Open User Configuration`, then add the same
`software-metrics-machine` server entry there.

### 3. Start and trust the server

Open the Command Palette and run `MCP: List Servers`. Select `software-metrics-machine`, start it, and confirm that you
trust the server when VS Code asks.

VS Code discovers the SMM tools after the server starts.

### 4. Ask Copilot Chat to use SMM

Open Chat in Agent mode and ask questions that refer to SMM metrics. For example:

```text
Use Software Metrics Machine to list the configured projects.
```

```text
Use Software Metrics Machine to evaluate engineering health for owner/repo between 2026-07-01 and 2026-07-31,
compared with 2026-06-01 to 2026-06-30.
```

```text
Use Software Metrics Machine to produce a full metrics report for owner/repo.
```

```text
Use Software Metrics Machine to report DORA metrics for the deploy workflow on the main branch.
```

### 5. Troubleshoot

If the server does not start, run `MCP: List Servers`, select `software-metrics-machine`, and choose `Show Output`. SMM
writes MCP startup and request logs there.

Common checks:

- `smm --help` works from the same shell environment VS Code uses.
- `SMM_STORE_DATA_AT` points to a directory, not the `smm_config.json` file itself.
- The configured directory contains `smm_config.json`.
- The selected project name matches a `github_repository` value in `smm_config.json`.

For more details on VS Code MCP configuration, see the
[VS Code MCP server documentation](https://code.visualstudio.com/docs/agent-customization/mcp-servers).

## Capabilities

The server advertises the following MCP capabilities during `initialize`:

| Capability | Methods supported |
| ---------- | ----------------- |
| Tools | `tools/list`, `tools/call` |
| Resources | `resources/list`, `resources/templates/list`, `resources/read` |
| Prompts | `prompts/list`, `prompts/get` |
| Logging | `logging/setLevel` |

## Tools

The MCP server exposes these tools:

| Tool | Description |
| ---- | ----------- |
| `smm_list_projects` | Lists configured projects from `smm_config.json`. |
| `smm_list_engineering_health_metrics` | Lists the available engineering health metric ids, categories, and labels. |
| `smm_get_change_request_metrics` | Reads change request metrics (throughput, review time, authors, outliers). |
| `smm_get_deployment_metrics` | Reads pipeline and deployment metrics (durations, success rate, deployment frequency, jobs). |
| `smm_get_code_metrics` | Reads code churn, coupling, and pairing metrics. Supports author and file pattern filters. |
| `smm_get_issue_metrics` | Reads Jira issue metrics. Supports an optional status filter. |
| `smm_get_quality_metrics` | Reads SonarQube quality metrics. |
| `smm_get_engineering_health` | Evaluates engineering health metrics with values, trends, targets, and recommendations. |
| `smm_get_dora_metrics` | Reads DORA and pipeline metrics with rich filters (workflow, branch, status, conclusion, event, cleaning). |
| `smm_list_architecture_snapshots` | Lists architecture snapshots previously generated for a project. |
| `smm_get_architecture_view` | Reads a C4 architecture view (context, container, component, or code) for a project. |
| `smm_get_full_report` | Reads a combined project report (change requests, deployment, code, issues, quality). |
| `smm_evaluate_change_requests` | Evaluates change request health signals (review bottlenecks, throughput, collaboration) and produces severity-graded recommendations. |
| `smm_evaluate_pipelines` | Evaluates pipeline health signals (duration, stability, throughput) and produces severity-graded recommendations. |
| `smm_evaluate_code` | Evaluates code health signals (churn, coupling, ownership, complexity, collaboration) and produces severity-graded recommendations. |
| `smm_evaluate_quality` | Evaluates SonarQube quality signals (ratings, complexity, coverage, duplication) and produces severity-graded recommendations. |
| `smm_evaluate_architecture` | Evaluates architecture health signals (container count, dependency concentration, orphan nodes, confidence) and produces severity-graded recommendations. |
| `smm_list_big_o_files` | Lists source files with their Big-O complexity classification (O(1), O(log n), O(n), O(n log n), O(n^2), O(n^3+)). Supports search and file pattern filters. |
| `smm_analyze_big_o_file` | Analyzes a specific source file for Big-O complexity, returning line-by-line classifications with reasons. |
| `smm_health_check` | Generates a health report on dataset freshness, gaps, missing fields, and item counts across all data providers. |
| `smm_get_version` | Returns the Software Metrics Machine version and server name. |
| `smm_get_configuration` | Returns the redacted project configuration (tokens and secrets are masked). |
| `smm_list_change_request_filter_options` | Lists available change request filter values (authors, labels, commenters). |
| `smm_list_pipeline_filter_options` | Lists available pipeline filter values (workflows, statuses, conclusions, branches, events, jobs). |
| `smm_list_code_authors` | Lists all code authors available in the CodeMaat data. |
| `smm_get_change_request_summary` | Detailed change request summary (totals, labels, top commenter, themes, first/last/most-commented, time to first comment). |
| `smm_get_change_request_through_time` | Change requests opened and closed through time, aggregated by day/week/month. |
| `smm_get_change_request_by_author` | Change request counts grouped by author, with optional top-N limit. |
| `smm_get_change_request_review_time` | Review time (days) by author with selectable statistical method and outlier handling. |
| `smm_get_change_request_open_time` | Open time (days) aggregated by day/week/month with selectable statistical method. |
| `smm_get_change_request_comments` | Comments per change request (overall or by-period when `aggregateBy` is set). |
| `smm_get_change_request_comments_by_author` | Comment counts grouped by author, with optional top-N limit. |
| `smm_get_change_request_first_comment_time` | Time to first comment (hours) by author with selectable statistical method. |
| `smm_get_change_request_metrics_by_month` | Change request metrics (comments, review time, open time) grouped by month. |
| `smm_get_change_request_metrics_by_week` | Change request metrics (comments, review time, open time) grouped by week. |
| `smm_get_pipeline_dashboard` | Full pipeline dashboard (summary, runs duration, runs by, jobs time, jobs summary, job steps time, jobs duration by workflow). |
| `smm_get_code_pairing_index` | Detailed pairing index (percentage, total/paired commits, top pairs, latest paired commits). |
| `smm_get_code_churn` | Code churn metrics (added/deleted/commits per period). |
| `smm_get_code_churn_history` | Timestamped code churn history entries. |
| `smm_get_code_coupling` | File coupling relationships with optional pattern/top filters. |
| `smm_get_code_coupling_history` | Timestamped file coupling history entries. |
| `smm_get_code_layered_coupling` | Layered file coupling relationships with optional pattern/top filters. |
| `smm_get_code_layered_coupling_history` | Timestamped layered file coupling history entries. |
| `smm_get_code_entity_churn` | Entity-level churn metrics with optional pattern/top filters. |
| `smm_get_code_entity_churn_history` | Timestamped entity-level churn history entries. |
| `smm_get_code_entity_effort` | Entity-level effort metrics with optional pattern/top filters. |
| `smm_get_code_entity_effort_history` | Timestamped entity-level effort history entries. |
| `smm_get_code_entity_ownership` | Entity ownership by developers with optional pattern/authors/top filters. |
| `smm_get_code_entity_ownership_history` | Timestamped entity ownership history entries. |
| `smm_get_sonarqube_component_tree` | SonarQube component tree with metrics, optional component/depth/metrics/pattern filters. |
| `smm_get_sonarqube_component_tree_history` | Timestamped SonarQube component tree history entries. |
| `smm_get_sonarqube_measurements` | All SonarQube measurements (latest snapshot). |
| `smm_get_sonarqube_measurements_history` | Timestamped SonarQube measurement history entries. |
| `smm_get_architecture_summary` | Architecture snapshot metadata (snapshot id, generated at, branch, commit count, view counts) for the latest or a specific snapshot. |
| `smm_export_architecture_view` | Exports an architecture view (context, container, component, code) as JSON plus a Mermaid diagram string. |
| `smm_list_saved_filters` | Lists saved filters and reports (read-only), optionally filtered by dashboard section. |
| `smm_get_saved_filter` | Looks up a single saved filter by name or id, returning the full filter entry. |

### Shared metric filters

Most metric tools accept a common set of filters:

```json
{
  "project": "owner/repo",
  "startDate": "2026-07-01",
  "endDate": "2026-07-31",
  "timezone": "Europe/Madrid"
}
```

All fields are optional. When `project` is omitted, the server uses the default active project from the configuration
repository.

### Code metrics filters

`smm_get_code_metrics` adds:

```json
{
  "authors": "alice,bob",
  "includePatterns": "src/**",
  "ignorePatterns": "**/*.spec.ts"
}
```

`includePatterns` and `ignorePatterns` are comma or newline separated file patterns (globs). They scope the **file coupling** result within `smm_get_code_metrics`. Code churn is a date-aggregated time series and is not filtered by path; for path-scoped entity-level churn use `smm_get_code_entity_churn` with the same pattern filters.

### Change request detailed filters

`smm_get_change_request_summary`, `smm_get_change_request_through_time`, `smm_get_change_request_by_author`,
`smm_get_change_request_review_time`, `smm_get_change_request_open_time`, `smm_get_change_request_comments`,
`smm_get_change_request_comments_by_author`, and `smm_get_change_request_first_comment_time` accept:

```json
{
  "project": "owner/repo",
  "startDate": "2026-07-01",
  "endDate": "2026-07-31",
  "timezone": "Europe/Madrid",
  "authors": "alice,bob",
  "excludeAuthors": "carol",
  "excludeCommenters": "dave",
  "labels": "bug,urgent",
  "status": "open",
  "aggregateBy": "week",
  "top": 10,
  "method": "median",
  "weekends": "exclude",
  "outlierMode": "flag",
  "rawFilters": "status=draft,author=john",
  "filter": "my-saved-filter"
}
```

`method` is one of `average`, `median`, `p75`, `p90`, `p95`, `min`, `max` (defaults to `average`).
`aggregateBy` is one of `day`, `week`, `month` (used by through-time and open-time).
`status` is the change request state (`open`, `closed`, `merged`, `draft`).
`top` limits the number of authors/rows returned (defaults to `10`).
`rawFilters` is a raw provider filter string passed through to the Git provider (e.g. `status=draft,author=john`).
`filter` is a saved filter name or id. When set, missing filter fields are filled from the saved filter.

### Pipeline dashboard filters

`smm_get_pipeline_dashboard` accepts:

```json
{
  "project": "owner/repo",
  "startDate": "2026-07-01",
  "endDate": "2026-07-31",
  "timezone": "Europe/Madrid",
  "workflowPath": ".github/workflows/ci.yml",
  "status": "completed",
  "conclusion": "success",
  "branch": "main",
  "jobName": "build",
  "jobConclusion": "success",
  "event": "push",
  "method": "p95",
  "weekends": "exclude",
  "outlierMode": "flag",
  "rawFilters": "status=success,branch=main",
  "filter": "ci-main",
  "period": "week"
}
```

`rawFilters` is a raw provider filter string passed through to the Git provider.
`filter` is a saved filter name or id. When set, missing filter fields are filled from the saved filter.
`period` is one of `day`, `week`, `month` and aggregates the `runs_by` time series into the requested period. Defaults to `day` (raw per-day).

### Code entity filters

`smm_get_code_coupling`, `smm_get_code_layered_coupling`, `smm_get_code_entity_churn`,
`smm_get_code_entity_effort`, and `smm_get_code_entity_ownership` (plus their `*_history` variants) accept:

```json
{
  "project": "owner/repo",
  "timezone": "Europe/Madrid",
  "ignorePatterns": "**/*.spec.ts",
  "includePatterns": "src/**",
  "top": 15,
  "authors": "alice",
  "minCoupling": 50,
  "entity": "src/index",
  "startDate": "2026-07-01",
  "endDate": "2026-07-31"
}
```

`minCoupling` filters coupling relationships below this degree threshold (0–100). Used by `smm_get_code_coupling` only.
`entity` is a substring filter — only entities whose path contains this string are returned. Used by `smm_get_code_entity_ownership` only.

### Code history filters

`smm_get_code_pairing_index`, `smm_get_code_churn`, and `smm_get_code_churn_history` accept:

```json
{
  "project": "owner/repo",
  "timezone": "Europe/Madrid",
  "startDate": "2026-01-01",
  "endDate": "2026-07-31",
  "authors": "alice,bob",
  "minShared": 3
}
```

`authors` on `smm_get_code_churn` switches to per-author churn (returns `{ authorChurn: [...] }` instead of the date-aggregated time series).
`minShared` on `smm_get_code_pairing_index` sets the minimum shared commits for pair inclusion (defaults to 0).

### SonarQube component tree filters

`smm_get_sonarqube_component_tree` and `smm_get_sonarqube_component_tree_history` accept:

```json
{
  "project": "owner/repo",
  "component": "acme:widgets",
  "depth": -1,
  "metrics": "complexity,coverage",
  "ignoreFiles": "*.spec.ts",
  "includeFiles": "src/**",
  "removeFolders": true
}
```

`smm_get_sonarqube_measurements` and `smm_get_sonarqube_measurements_history` accept only `project`.

### Architecture summary and export

`smm_get_architecture_summary` and `smm_export_architecture_view` accept the same filters as
`smm_get_architecture_view` (project, level, snapshotId, includePatterns, ignorePatterns). The export tool
returns both the JSON view and a Mermaid `flowchart LR` diagram string.

### Saved filters

`smm_list_saved_filters` accepts:

```json
{
  "project": "owner/repo",
  "section": "pipelines"
}
```

`section` is one of `insights`, `pipelines`, `change-requests`, `source-code`, `engineering-health`, `architecture`,
`sonarqube`. When set, only saved filters in that section are returned. When omitted, all saved filters and reports
are returned.

`smm_get_saved_filter` accepts:

```json
{
  "project": "owner/repo",
  "name": "CI Main"
}
```

`name` is required and can be either a saved filter name or id. Returns the full filter entry including section,
filters, and repository, or `null` if not found.

### Issue metrics filters

`smm_get_issue_metrics` adds:

```json
{
  "status": "Done"
}
```

### Engineering health filters

`smm_get_engineering_health` mirrors the CLI flags documented in
[Engineering Health](./features/engineering-health.md#filters-and-cli-options):

```json
{
  "project": "owner/repo",
  "metric": "deployment-frequency,lead-time",
  "category": "delivery",
  "startDate": "2026-07-01",
  "endDate": "2026-07-31",
  "compareStartDate": "2026-06-01",
  "compareEndDate": "2026-06-30",
  "changeRequestLabels": "feature,backend",
  "period": "week",
  "weekends": "exclude",
  "outlierMode": "flag"
}
```

Use `metric` or `category` to narrow the evaluation. When both are omitted, all metrics are evaluated. Use
`compareStartDate` and `compareEndDate` to produce trend deltas against a previous window.

Discover available metric ids with `smm_list_engineering_health_metrics`.

### DORA metrics filters

`smm_get_dora_metrics` accepts:

```json
{
  "project": "owner/repo",
  "startDate": "2026-07-01",
  "endDate": "2026-07-31",
  "workflowPath": ".github/workflows/deploy.yml",
  "status": "completed",
  "conclusion": "success",
  "branch": "main",
  "jobName": "deploy",
  "event": "push",
  "weekends": "exclude",
  "outlierMode": "flag",
  "rawFilters": "branch=main",
  "filter": "deploy-filter",
  "period": "day"
}
```

`rawFilters` is a raw provider filter string passed through to the Git provider.
`filter` is a saved filter name or id. When set, missing filter fields are filled from the saved filter.
`period` is one of `day`, `week`, `month` and controls the DORA rating: `day` (Elite), `week` (High), `month` (Medium). Defaults to `week`.

### Architecture view filters

`smm_get_architecture_view` and `smm_evaluate_architecture` accept:

```json
{
  "project": "owner/repo",
  "level": "container",
  "snapshotId": "owner-repo-2026-07-19t10-00-00-000z",
  "includePatterns": "apps/**",
  "ignorePatterns": "**/*.spec.ts"
}
```

`level` is one of `context`, `container`, `component`, or `code` and defaults to `container`. When `snapshotId` is
omitted, the latest snapshot is used.

### Evaluation filters

`smm_evaluate_change_requests` and `smm_evaluate_pipelines` accept the shared metric filters
(`project`, `startDate`, `endDate`, `timezone`). `smm_evaluate_code` also accepts `authors` and file pattern filters
(`includePatterns`, `ignorePatterns`) matching `smm_get_code_metrics` — the patterns scope entity churn, file coupling,
entity effort, and entity ownership. `smm_evaluate_quality` accepts only `project` since it evaluates the latest SonarQube
snapshot. `smm_evaluate_architecture` accepts the architecture view filters above.

### Big-O filters

`smm_list_big_o_files` accepts:

```json
{
  "project": "owner/repo",
  "search": "sort",
  "ignorePatterns": "**/*.spec.ts",
  "includePatterns": "src/**",
  "limit": 50
}
```

`smm_analyze_big_o_file` requires a `filePath` and optionally accepts `project`:

```json
{
  "project": "owner/repo",
  "filePath": "src/algorithms/sort.ts"
}
```

### Health check filters

`smm_health_check` accepts:

```json
{
  "project": "owner/repo",
  "providerFilter": "github",
  "maxGapDays": 14
}
```

`providerFilter` defaults to `all` and `maxGapDays` defaults to `30`.

## Resources

The MCP server exposes these static resources:

| Resource | Description |
| -------- | ----------- |
| `smm://projects` | Project list with repository and provider names. |
| `smm://engineering-health/metrics` | Engineering health metric catalog. |
| `smm://project/{name}/configuration` | Redacted project configuration. |
| `smm://project/{name}/report` | Complete project report. |
| `smm://project/{name}/engineering-health` | Engineering health evaluation for the project. |
| `smm://project/{name}/dora` | DORA and pipeline metrics for the project. |
| `smm://project/{name}/architecture/snapshots` | Architecture snapshots stored for the project. |
| `smm://project/{name}/evaluation/change-requests` | Change request health evaluation for the project. |
| `smm://project/{name}/evaluation/pipelines` | Pipeline health evaluation for the project. |
| `smm://project/{name}/evaluation/code` | Code health evaluation for the project. |
| `smm://project/{name}/evaluation/quality` | SonarQube quality evaluation for the project. |
| `smm://project/{name}/evaluation/architecture` | Architecture health evaluation for the project. |
| `smm://project/{name}/big-o` | Big-O complexity classification for source files. |
| `smm://project/{name}/health-check` | Dataset health report for the project. |
| `smm://project/{name}/architecture/summary` | Architecture snapshot metadata for the latest snapshot. |
| `smm://project/{name}/pipeline-dashboard` | Full pipeline dashboard for the project. |
| `smm://project/{name}/saved-filters` | Saved filters and reports for the project. |
| `smm://project/{name}/sonarqube/measurements` | Latest SonarQube measurements for the project. |
| `smm://project/{name}/sonarqube/measurements/history` | Timestamped SonarQube measurement entries for the project. |
| `smm://project/{name}/sonarqube/component-tree` | SonarQube component tree with metrics for the project. |
| `smm://project/{name}/sonarqube/component-tree/history` | Timestamped SonarQube component tree entries for the project. |

The server also advertises these resource templates through `resources/templates/list`:

| Template | Description |
| -------- | ----------- |
| `smm://project/{project}/engineering-health` | Engineering health evaluation for a project. |
| `smm://project/{project}/dora` | DORA metrics for a project. |
| `smm://project/{project}/architecture/snapshots` | Architecture snapshots for a project. |
| `smm://project/{project}/evaluation/change-requests` | Change request health evaluation for a project. |
| `smm://project/{project}/evaluation/pipelines` | Pipeline health evaluation for a project. |
| `smm://project/{project}/evaluation/code` | Code health evaluation for a project. |
| `smm://project/{project}/evaluation/quality` | SonarQube quality evaluation for a project. |
| `smm://project/{project}/evaluation/architecture` | Architecture health evaluation for a project. |
| `smm://project/{project}/big-o` | Big-O complexity classification for a project. |
| `smm://project/{project}/health-check` | Dataset health report for a project. |
| `smm://project/{project}/architecture/summary` | Architecture snapshot metadata for a project. |
| `smm://project/{project}/pipeline-dashboard` | Full pipeline dashboard for a project. |
| `smm://project/{project}/saved-filters` | Saved filters and reports for a project. |
| `smm://project/{project}/sonarqube/measurements` | Latest SonarQube measurements for a project. |
| `smm://project/{project}/sonarqube/measurements/history` | Timestamped SonarQube measurement entries for a project. |
| `smm://project/{project}/sonarqube/component-tree` | SonarQube component tree with metrics for a project. |
| `smm://project/{project}/sonarqube/component-tree/history` | Timestamped SonarQube component tree entries for a project. |

Configuration resources redact token-like fields before returning data to the MCP client.

## Prompts

The server ships with ready-made prompts that guide an agent through common SMM workflows. Clients can list them with
`prompts/list` and retrieve one with `prompts/get`.

| Prompt | Description |
| ------ | ----------- |
| `smm_sprint_health_review` | Review engineering health for the current sprint and highlight metrics that need attention. |
| `smm_compare_windows` | Compare engineering health between two time windows and summarise what improved or regressed. |
| `smm_dora_summary` | Summarise DORA metrics for a project, including deployment frequency and failure rate. |
| `smm_code_hotspots` | Identify code hotspots (high churn and high coupling files) and pair-programming gaps. |

Example `prompts/get` request:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "prompts/get",
  "params": {
    "name": "smm_compare_windows",
    "arguments": {
      "project": "owner/repo",
      "startDate": "2026-07-01",
      "endDate": "2026-07-31",
      "compareStartDate": "2026-06-01",
      "compareEndDate": "2026-06-30"
    }
  }
}
```

## Logging

The MCP server uses stdout as the JSON-RPC transport channel, so all log output is redirected to **stderr**. This keeps
the logs visible in the MCP client output panel (e.g. VS Code MCP Output view) without corrupting the protocol.

By default the server is quiet (matching the rest of the SMM CLI). Enable logging with the shared `--debug` flag so you
can see what the server is doing behind the scenes while it serves requests:

| Source | Behavior |
| ------ | -------- |
| _none_ | Quiet (CRITICAL level) — matches the default for all `smm` commands. |
| `smm --debug` | Enables transport and operation logs at DEBUG level (startup, request lifecycle, tool/resource call timing, sub-query steps). Reuses the same `--debug` flag available to all other `smm` commands. |
| `DEBUG=true` | Same as `--debug`, used when running the server standalone via `smm-mcp` (e.g. an MCP client `env` block where there is no CLI flag). |

```bash
# Default: quiet (no operation logs)
SMM_STORE_DATA_AT=/path/to/smm-data smm mcp server start

# Verbose: reuse the shared CLI --debug flag (no env var needed)
SMM_STORE_DATA_AT=/path/to/smm-data smm --debug mcp server start
```

When configuring an MCP client (Copilot Chat, Claude Desktop, etc.) that launches the server through an `env` block
rather than the `smm` CLI, use the `DEBUG` env var instead since there is no CLI flag in that path:

```json
{
  "mcpServers": {
    "software-metrics-machine": {
      "command": "smm",
      "args": ["mcp", "server", "start"],
      "env": {
        "SMM_STORE_DATA_AT": "/path/to/smm-data",
        "DEBUG": "true"
      }
    }
  }
}
```

### Transport logging

Transport-level logs cover startup, JSON-RPC request lifecycle, tool/resource call timing, errors, and shutdown. They
are tagged with the `SmmMcpServer` logger name. Example output:

```text
[INFO] [SmmMcpServer] Received request: tools/call
[INFO] [SmmMcpServer] Running tool: smm_get_engineering_health
[INFO] [SmmMcpServer] Completed tool: smm_get_engineering_health in 1234ms
```

### Operation logging

Operation logs (`SmmMcpOperation`, `SmmMcpTool`, `SmmMcpResource`, `SmmMcpPrompt`) trace the behind-the-scenes work
performed for each MCP request, including which sub-queries are executed and how long they take. They are visible at
DEBUG level. Example output with `DEBUG=true`:

```text
[DEBUG] [SmmMcpTool] smm_list_projects: loading project list from smm_config.json
[DEBUG] [SmmMcpTool] smm_list_projects: found 2 projects
[DEBUG] [SmmMcpOperation] Started getEngineeringHealthEvaluation (project, category, ...)
[DEBUG] [SmmMcpOperation] getEngineeringHealthEvaluation: evaluating orchestrator (metricCount=2)
[DEBUG] [SmmMcpOperation] Completed getEngineeringHealthEvaluation (durationMs=1180)
[DEBUG] [SmmMcpResource] Reading resource smm://project/owner/repo/dora
```

### Domain service logging

Metric readers and data access services use the SMM Logger and respect the project's configured `log_level`,
`<REPO>_LOGGING_LEVEL` env var, or fall back to `CRITICAL`. These logs can also write to the log file if `store_logs` is
enabled in the project's `smm_config.json`.

### Client-controlled logging

MCP clients can dynamically change the server's log level at runtime by sending a `logging/setLevel` notification.
Accepted levels are `debug`, `info`, and `critical`:

```json
{
  "jsonrpc": "2.0",
  "method": "logging/setLevel",
  "params": {
    "level": "debug"
  }
}
```

This is equivalent to starting the server with `--debug` (for `debug`) or running in quiet mode (for `critical`).
The `info` level enables transport and request lifecycle logs without the detailed operation traces.

```{tip}
Transport and operation logs are independent of `smm_config.json` because the server may not have a project loaded at the
time startup messages are written. Domain service logs always use the project's log level settings.
```

## Security notes

The MCP server is intended for local use with trusted project data. It does not expose write tools, fetch tools, or
commands that mutate `smm_config.json`.

Do not put raw tokens in prompts or agent instructions. Store provider tokens in `smm_config.json` or project-specific
environment variables as described in the configuration documentation.