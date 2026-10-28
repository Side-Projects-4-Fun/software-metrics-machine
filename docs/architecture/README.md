# Architecture

This folder documents the current architecture of the Software Metrics Machine monorepo.

## Diagram

- C4 container diagram source: `packages-current.c4.mmd`

The diagram models the main runtime containers and workspace packages:

- `@smmachine/webapp` (Next.js dashboard)
- `@smmachine/rest` (NestJS API)
- `@smmachine/cli` (CLI application)
- `@smmachine/mcp` (MCP stdio server)
- `@smmachine/core` (domain and orchestration library)
- `@smmachine/utils` (shared utility library)

## Repository Layout

```
apps/
  cli/      # Commander.js CLI: src/commands, src/factories, src/formatters, e2e/, lib/bashunit/, tools/
  mcp/      # Read-only MCP stdio server: server.ts, tools.ts, resources.ts, prompts.ts, metrics-reader.ts
  rest/     # NestJS API: main.ts, metrics.module.ts, controllers/, dtos/, filters/, middleware/, config/
  webapp/   # Next.js App Router: app/, components/, server/ (REST data layer), lib/, __tests__/, cypress/
packages/
  core/     # domain/<area>/{services,repositories,factories,infrastructure}, providers/, engineering-health/, infrastructure/
  utils/    # logger, json, date-time, duration, app-version
docs/
  adrs/           # Architecture Decision Records
  architecture/   # This folder (C4 diagrams)
  vitepress/      # Public documentation site
scripts/          # Coverage merge and publish-simulation helpers
```

Domain slices in `packages/core/src/domain/<area>/` all share the same internal layout, so a new feature area is
added by copying that layout rather than inventing a new one.

## Current Package Responsibilities

### `@smmachine/cli`

- Provides command-line workflows for metrics analysis and is the only write-capable app for `SMM_STORE_DATA_AT`.
- Uses `@smmachine/core` for domain operations.
- Uses `@smmachine/utils` for cross-cutting helpers (for example logging).
- Uses `@smmachine/mcp` for the MCP server start command.

### `@smmachine/mcp`

- Provides a read-only MCP stdio server for agent clients.
- Uses `@smmachine/core` for domain operations.
- Uses `@smmachine/utils` for shared concerns.
- Exposes tools, resources, and prompts for metrics access.

### `@smmachine/webapp`

- Provides the user-facing dashboard.
- Calls `@smmachine/rest` over HTTP/JSON through the server-only data layer in `apps/webapp/server/api/`.
- Must not import `@smmachine/core` or `@smmachine/utils` from page or server code (devDependencies for typing only).

### `@smmachine/rest`

- Exposes API endpoints for metrics and configuration.
- Delegates business logic to `@smmachine/core`.
- Uses `@smmachine/utils` for shared concerns.
- Read-only: never generates or persists project data.

### `@smmachine/core`

- Contains business/domain logic and metric orchestration.
- Integrates with external provider APIs (for example GitHub, GitLab, Jira, SonarQube).
- Hosts the Engineering Health registry (`engineering-health/registry.ts`).
- Uses `@smmachine/utils` to avoid duplicating low-level utilities.

### `@smmachine/utils`

- Holds reusable helpers shared by other packages.
- Stays dependency-light to remain broadly reusable.

## Relationship Summary

- Developer -> `@smmachine/cli`
- Developer -> `@smmachine/webapp`
- Agent Client -> `@smmachine/mcp`
- `@smmachine/webapp` -> `@smmachine/rest`
- `@smmachine/cli` -> `@smmachine/core`
- `@smmachine/cli` -> `@smmachine/utils`
- `@smmachine/cli` -> `@smmachine/mcp`
- `@smmachine/mcp` -> `@smmachine/core`
- `@smmachine/mcp` -> `@smmachine/utils`
- `@smmachine/rest` -> `@smmachine/core`
- `@smmachine/rest` -> `@smmachine/utils`
- `@smmachine/core` -> `@smmachine/utils`
- `@smmachine/core` -> external provider systems

## Keeping This Updated

When package dependencies or responsibilities change:

1. Update `packages-current.c4.mmd`.
2. Update this README summary.
3. Keep names aligned with workspace package names in `package.json` files.