# Dynamic views

Static diagrams show what exists; dynamic diagrams show the order of calls. These three flows cover every way to use
SMM: fetch and analyse from the CLI, read the dashboard, and read through MCP.

## Flow 1 — CLI fetches data and computes a metric

```mermaid
C4Dynamic
  title CLI — fetch provider data, persist it, compute a metric

  Person(developer, "Developer")
  Container(cliCommand, "CLI command", "Commander.js")
  Container(configRepo, "ConfigurationRepository", "@smmachine/core")
  Container(providerClient, "Provider client", "@smmachine/core")
  System_Ext(providerApi, "Provider API", "GitHub, GitLab, Jira or SonarQube")
  ContainerDb(store, "SMM data folder", "JSON / SQLite")
  Container(service, "Domain service", "@smmachine/core")
  Container(formatter, "Formatter", "@smmachine/cli")

  RelIndex(1, developer, cliCommand, "Runs smm change-requests fetch or smm pipelines summary", "shell")
  RelIndex(2, cliCommand, configRepo, "Resolves the project configuration", "function call")
  RelIndex(3, cliCommand, providerClient, "Fetches provider data", "function call")
  RelIndex(4, providerClient, providerApi, "Requests pull requests, pipelines, issues or measures", "HTTPS REST")
  RelIndex(5, providerClient, store, "Persists the normalised payload", "IRepository write")
  RelIndex(6, cliCommand, service, "Computes metrics from persisted data", "function call")
  RelIndex(7, service, store, "Reads the cached payloads", "IRepository read")
  RelIndex(8, cliCommand, formatter, "Formats the result", "function call")
  RelIndex(9, formatter, developer, "Prints a table or JSON", "stdout")

  UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

The order matters: **fetch writes, computation reads**. That is why a second command can re-run the analysis without
touching the provider API, and why `--refresh` options exist on fetch commands.

## Flow 2 — Dashboard read path

```mermaid
C4Dynamic
  title Dashboard — read a metric page

  Person(teamMember, "Team member")
  Container(route, "Next.js route", "React Server Component")
  Container(serverApi, "server/api client", "@smmachine/webapp")
  Container(restController, "REST controller", "@smmachine/rest")
  Container(service, "Domain service", "@smmachine/core")
  ContainerDb(store, "SMM data folder", "SQLite / JSON")
  Container(chart, "Chart component", "React, Recharts")

  RelIndex(1, teamMember, route, "Opens /dashboard/pipelines with filters", "HTTPS")
  RelIndex(2, route, serverApi, "Calls the typed fetch helper", "server function")
  RelIndex(3, serverApi, restController, "GET /pipelines/dashboard", "HTTP/JSON")
  RelIndex(4, restController, service, "Delegates to the read service", "function call")
  RelIndex(5, service, store, "Reads persisted metrics", "IRepository read")
  RelIndex(6, restController, serverApi, "Returns JSON", "HTTP/JSON")
  RelIndex(7, route, chart, "Renders with the response", "React props")
  RelIndex(8, chart, teamMember, "Shows tables and charts", "browser")

  UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

No provider is called during a dashboard request. A slow or rate-limited provider never blocks the UI, but it also
means the dashboard only shows data that was fetched by the CLI before.

## Flow 3 — MCP read path

```mermaid
C4Dynamic
  title MCP — agent asks for a metric

  Person(agentClient, "AI agent client")
  Container(server, "MCP server", "@smmachine/mcp")
  Container(registration, "registration.ts", "zod schemas")
  Container(reader, "McpMetricsReader", "@smmachine/mcp")
  Container(service, "Domain service", "@smmachine/core")
  ContainerDb(store, "SMM data folder", "SQLite / JSON")
  Container(redaction, "redaction.ts", "@smmachine/mcp")

  RelIndex(1, agentClient, server, "Calls a tool such as smm_get_deployment_metrics", "stdio / MCP")
  RelIndex(2, server, registration, "Validates arguments", "zod")
  RelIndex(3, registration, reader, "Dispatches the handler", "function call")
  RelIndex(4, reader, service, "Calls read services", "function call")
  RelIndex(5, service, store, "Reads persisted metrics", "IRepository read")
  RelIndex(6, reader, redaction, "Strips secrets and credentials", "function call")
  RelIndex(7, server, agentClient, "Returns JSON content", "stdio / MCP")

  UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

Next: [Deployment](./deployment.md).
