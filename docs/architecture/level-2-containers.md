# Level 2 — Containers

The container diagram zooms into the monorepo and shows the deployable/runnable units plus the two shared libraries.
It is the most useful diagram when you are deciding **where** a change belongs.

```mermaid
C4Container
  title Level 2 — Containers in the Software Metrics Machine monorepo

  Person(developer, "Developer / platform engineer")
  Person(teamMember, "Team member")
  Person(agentClient, "AI agent client")

  System_Ext(gitHost, "Git hosting and CI/CD", "GitHub, GitLab")
  System_Ext(issueTracker, "Issue tracker", "Jira")
  System_Ext(qualityPlatform, "Code quality platform", "SonarQube")
  System_Ext(gitClone, "Local git clone", "Repository checked out on disk")

  System_Boundary(smm, "software-metrics-machine monorepo") {
    Container(cli, "@smmachine/cli", "TypeScript, Commander.js, bundled with tsup", "Only write-capable app: fetches provider data, generates architecture snapshots, computes metrics and prints them")
    Container(rest, "@smmachine/rest", "NestJS, Express, Swagger", "Read-only REST API for metrics, filters, configuration, evaluations and the metric catalog")
    Container(webapp, "@smmachine/webapp", "Next.js App Router, React, MUI, Recharts", "Read-only dashboard: server components read the REST API, the browser renders charts and reports")
    Container(mcp, "@smmachine/mcp", "TypeScript, MCP stdio server", "Read-only MCP tools, resources and prompts for agent clients")
    Container(core, "@smmachine/core", "TypeScript library, CommonJS", "Domain slices, provider clients, engineering-health registry, configuration and persistence")
    Container(utils, "@smmachine/utils", "TypeScript library, CommonJS", "Logging, JSON, date-time, duration and application-version helpers")
    ContainerDb(store, "SMM data folder", "JSON files and SQLite (smm.sqlite)", "Per-project provider payloads, architecture snapshots, saved filters and project configuration")
  }

  Rel(developer, cli, "Runs commands", "shell")
  Rel(teamMember, webapp, "Uses the dashboard", "HTTPS")
  Rel(agentClient, mcp, "Calls tools and resources", "stdio / MCP")

  Rel(webapp, rest, "Reads metrics and configuration", "HTTP/JSON")
  Rel(cli, core, "Calls domain services and providers", "workspace package")
  Rel(cli, mcp, "Starts the MCP server", "workspace package")
  Rel(rest, core, "Calls read services and repositories", "workspace package")
  Rel(mcp, core, "Calls read services and repositories", "workspace package")
  Rel(cli, utils, "Uses shared helpers", "workspace package")
  Rel(rest, utils, "Uses shared helpers", "workspace package")
  Rel(mcp, utils, "Uses shared helpers", "workspace package")
  Rel(core, utils, "Uses shared helpers", "workspace package")

  Rel(cli, store, "Writes caches, snapshots and configuration", "filesystem / SQLite")
  Rel(rest, store, "Reads persisted metrics", "read-only")
  Rel(mcp, store, "Reads persisted metrics", "read-only")

  Rel(core, gitHost, "Fetches pull requests, pipelines and commits", "HTTPS REST")
  Rel(core, issueTracker, "Fetches issues", "HTTPS REST")
  Rel(core, qualityPlatform, "Fetches quality measures", "HTTPS REST")
  Rel(core, gitClone, "Reads git history", "git / filesystem")

  UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

## Container responsibilities

| Container | Module system | Runtime | Writes to `SMM_STORE_DATA_AT`? |
|-----------|---------------|---------|--------------------------------|
| `@smmachine/cli` (`apps/cli`) | CommonJS, bundled by tsup | Local shell | Yes — the only writer |
| `@smmachine/rest` (`apps/rest`) | CommonJS, NestJS | HTTP server | No |
| `@smmachine/webapp` (`apps/webapp`) | ESM, Next.js | HTTP server | No (it only talks HTTP to REST) |
| `@smmachine/mcp` (`apps/mcp`) | CommonJS, tsup | stdio server | No |
| `@smmachine/core` (`packages/core`) | CommonJS library | In-process | Only through repositories when invoked by the CLI |
| `@smmachine/utils` (`packages/utils`) | CommonJS library | In-process | No |

## What to notice

- **`apps/*` are adapters, `packages/*` hold the logic.** Command groups, controllers, MCP tools and React components are
  thin translation layers. Metric math lives in `packages/core`.
- **The webapp never imports `@smmachine/core`.** It reaches the data through `apps/webapp/server/api/*.ts`, which
  calls the REST API at `SMM_REST_BASE_URL`. This keeps the dashboard deployable on its own and enforces the read-only
  boundary.
- **The CLI also depends on `@smmachine/mcp`** so `smm mcp server start` can boot the server without a separate
  package.
- **`smm dashboard serve` bundles the stack.** The published CLI spawns the bundled REST API (default port `3001`) and
  the Next.js server (default port `3000`), wiring `SMM_REST_BASE_URL` for the webapp.

Next: [Level 3 — Core components](./level-3-components-core.md) and
[Level 3 — Application components](./level-3-components-apps.md).
