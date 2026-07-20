# Software Metrics Machine MCP server

The MCP server exposes Software Metrics Machine data to agent clients (Copilot Chat, Claude Desktop, Cursor, and other
MCP-compatible clients) over stdio using the Model Context Protocol.

The server is **read-only** and surfaces metrics already present in the SMM data store. For data collection, continue to
use the SMM CLI.

## Capabilities

- **Tools**: projects, metric catalog, pull requests, deployment, code, issues, quality, engineering health, DORA,
  architecture snapshots/views, and full report.
- **Resources**: project list, engineering health catalog, per-project configuration (redacted), report, engineering
  health, DORA, and architecture snapshots. Resource templates are advertised through `resources/templates/list`.
- **Prompts**: ready-made prompts for sprint health review, window comparison, DORA summary, and code hotspot analysis.

## Run locally

```bash
SMM_STORE_DATA_AT=/path/to/smm-data pnpm --filter @smmachine/mcp dev
```

From the main SMM CLI, run:

```bash
SMM_STORE_DATA_AT=/path/to/smm-data smm mcp server start
```

For direct packaged MCP usage, run `smm-mcp` after building or installing the package.

## Client configuration

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

See the [MCP server documentation](https://marabesi.com/software-metrics-machine/mcp) for the full list of tools,
resources, prompts, and filters.
