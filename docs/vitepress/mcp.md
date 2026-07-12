# MCP server

Software Metrics Machine includes an MCP server so agent clients can read project metrics through the Model Context Protocol.

The server is read-only. It exposes metrics that already exist in the SMM data store and does not fetch from GitHub, GitLab, Jira, or SonarQube by itself.

## When to use it

Use the MCP server when you want an assistant or agent client to answer questions such as:

- What changed in pull request throughput this month?
- Which jobs are taking the longest?
- What files have the highest churn?
- What does the complete metrics report say for a project?

For data collection, continue to use the CLI commands such as `smm prs fetch`, `smm pipelines fetch`, `smm jira fetch`, and the SonarQube commands.

## Start the server

The server reads the same configuration as the CLI and REST API. Set `SMM_STORE_DATA_AT` to the directory that contains `smm_config.json`.

Start the server with the globally installed `smm` command:

```bash
SMM_STORE_DATA_AT=/path/to/smm-data smm mcp server start
```

The server uses stdio transport, which is the expected mode for local MCP clients.

## Client configuration

Most MCP clients accept a command plus environment variables. Configure the client to run the globally installed `smm` command:

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

VS Code can run MCP servers from either a workspace configuration or a user profile configuration. Use a workspace configuration when the SMM data directory belongs to one project, and use a user profile configuration when you want the same server available across several workspaces.

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

If you prefer a user-level setup, open the Command Palette and run `MCP: Open User Configuration`, then add the same `software-metrics-machine` server entry there.

### 3. Start and trust the server

Open the Command Palette and run `MCP: List Servers`. Select `software-metrics-machine`, start it, and confirm that you trust the server when VS Code asks.

VS Code discovers the SMM tools after the server starts. The available tools include `smm_list_projects`, `smm_get_pr_metrics`, `smm_get_deployment_metrics`, `smm_get_code_metrics`, `smm_get_issue_metrics`, `smm_get_quality_metrics`, and `smm_get_full_report`.

### 4. Ask Copilot Chat to use SMM

Open Chat in Agent mode and ask questions that refer to SMM metrics. For example:

```text
Use Software Metrics Machine to list the configured projects.
```

```text
Use Software Metrics Machine to summarize pull request metrics for owner/repo between 2025-01-01 and 2025-01-31.
```

```text
Use Software Metrics Machine to produce a full metrics report for owner/repo.
```

### 5. Troubleshoot

If the server does not start, run `MCP: List Servers`, select `software-metrics-machine`, and choose `Show Output`. SMM writes MCP startup and request logs there.

Common checks:

- `smm --help` works from the same shell environment VS Code uses.
- `SMM_STORE_DATA_AT` points to a directory, not the `smm_config.json` file itself.
- The configured directory contains `smm_config.json`.
- The selected project name matches a `github_repository` value in `smm_config.json`.

For more details on VS Code MCP configuration, see the [VS Code MCP server documentation](https://code.visualstudio.com/docs/agent-customization/mcp-servers).

## Tools

The MCP server exposes these tools:

| Tool | Description |
| ---- | ----------- |
| `smm_list_projects` | Lists configured projects from `smm_config.json`. |
| `smm_get_pr_metrics` | Reads pull request metrics. |
| `smm_get_deployment_metrics` | Reads pipeline and deployment metrics. |
| `smm_get_code_metrics` | Reads code churn, coupling, and pairing metrics. |
| `smm_get_issue_metrics` | Reads Jira issue metrics. |
| `smm_get_quality_metrics` | Reads SonarQube quality metrics. |
| `smm_get_full_report` | Reads a combined project report. |

Metric tools accept:

```json
{
  "project": "owner/repo",
  "startDate": "2025-01-01",
  "endDate": "2025-01-31",
  "timezone": "Europe/Madrid"
}
```

All fields are optional. When `project` is omitted, the server uses the default active project from the configuration repository.

## Resources

The MCP server exposes these resources:

| Resource | Description |
| -------- | ----------- |
| `smm://projects` | Project list with repository and provider names. |
| `smm://project/{name}/configuration` | Redacted project configuration. |
| `smm://project/{name}/report` | Complete project report. |

Configuration resources redact token-like fields before returning data to the MCP client.

## Logging

The MCP server has two logging layers:

### Transport logging

The server writes transport-level logs (startup, JSON-RPC requests, errors, shutdown) using the SMM Logger. The level
is controlled by the `DEBUG` environment variable:

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
`<REPO>_LOGGING_LEVEL` env var, or fall back to `CRITICAL`. These logs can also write to the log file if
`store_logs` is enabled in the project's `smm_config.json`.

```{tip}
Transport logs are independent of `smm_config.json` because the server may not have a project loaded at the
time startup messages are written. Domain service logs always use the project's log level settings.
```

## Security notes

The MCP server is intended for local use with trusted project data. It does not expose write tools, fetch tools, or commands that mutate `smm_config.json`.

Do not put raw tokens in prompts or agent instructions. Store provider tokens in `smm_config.json` or project-specific environment variables as described in the configuration documentation.
