---
outline: deep
---

# MCP server

Software Metrics Machine includes a Model Context Protocol (MCP) server so agent clients (Copilot Chat, Claude Desktop,
Cursor, and other MCP-compatible clients) can read engineering metrics through a standard protocol.

The server is **read-only**. It exposes metrics that already exist in the SMM data store and does not fetch from
GitHub, GitLab, Jira, or SonarQube by itself. For data collection, continue to use the CLI commands such as
`smm prs fetch`, `smm pipelines fetch`, `smm jira fetch`, and the SonarQube commands.

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

## Tools

The MCP server exposes these tools:

| Tool | Description |
| ---- | ----------- |
| `smm_list_projects` | Lists configured projects from `smm_config.json`. |
| `smm_list_engineering_health_metrics` | Lists the available engineering health metric ids, categories, and labels. |
| `smm_get_pr_metrics` | Reads pull request metrics (throughput, review time, authors, outliers). |
| `smm_get_deployment_metrics` | Reads pipeline and deployment metrics (durations, success rate, deployment frequency, jobs). |
| `smm_get_code_metrics` | Reads code churn, coupling, and pairing metrics. Supports author and file pattern filters. |
| `smm_get_issue_metrics` | Reads Jira issue metrics. Supports an optional status filter. |
| `smm_get_quality_metrics` | Reads SonarQube quality metrics. |
| `smm_get_engineering_health` | Evaluates engineering health metrics with values, trends, targets, and recommendations. |
| `smm_get_dora_metrics` | Reads DORA and pipeline metrics with rich filters (workflow, branch, status, conclusion, event, cleaning). |
| `smm_list_architecture_snapshots` | Lists architecture snapshots previously generated for a project. |
| `smm_get_architecture_view` | Reads a C4 architecture view (context, container, component, or code) for a project. |
| `smm_get_full_report` | Reads a combined project report (PRs, deployment, code, issues, quality). |

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
  "prLabels": "feature,backend",
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
  "outlierMode": "flag"
}
```

### Architecture view filters

`smm_get_architecture_view` accepts:

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

The server also advertises these resource templates through `resources/templates/list`:

| Template | Description |
| -------- | ----------- |
| `smm://project/{project}/engineering-health` | Engineering health evaluation for a project. |
| `smm://project/{project}/dora` | DORA metrics for a project. |
| `smm://project/{project}/architecture/snapshots` | Architecture snapshots for a project. |

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

The MCP server has two logging layers.

### Transport logging

The server writes transport-level logs (startup, JSON-RPC requests, errors, shutdown) using the SMM Logger. The level is
controlled by the `DEBUG` environment variable:

- `DEBUG=true` — all transport messages visible (INFO level)
- No `DEBUG` — transport logs suppressed (CRITICAL level)

These logs appear in the MCP client output panel (e.g. VS Code MCP Output view).

```bash
DEBUG=true smm mcp server start
```

Or in your MCP client configuration:

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

### Domain service logging

Metric readers and data access services use the SMM Logger and respect the project's configured `log_level`,
`<REPO>_LOGGING_LEVEL` env var, or fall back to `CRITICAL`. These logs can also write to the log file if `store_logs` is
enabled in the project's `smm_config.json`.

```{tip}
Transport logs are independent of `smm_config.json` because the server may not have a project loaded at the time startup
messages are written. Domain service logs always use the project's log level settings.
```

## Security notes

The MCP server is intended for local use with trusted project data. It does not expose write tools, fetch tools, or
commands that mutate `smm_config.json`.

Do not put raw tokens in prompts or agent instructions. Store provider tokens in `smm_config.json` or project-specific
environment variables as described in the configuration documentation.