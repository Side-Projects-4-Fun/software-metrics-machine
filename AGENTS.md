# Software Metrics Machine

TypeScript/Node.js pnpm monorepo that aggregates software metrics from Git providers, CI/CD pipelines, Jira, and
SonarQube. This file holds durable, tool-agnostic facts. Tool-specific delegation lives in `.opencode/` for OpenCode
and `.github/agents/` for GitHub Copilot. Shared role prompts live under `.agents/agent-prompts/`.

## Project Overview

- **Pull Request** (`smm prs *`) — PR volume, review times, merge patterns, comments
- **Pipeline** (`smm pipelines *`) — success rates, execution times, DORA deployment frequency
- **Code** (`smm code *`) — code churn, coupling, entity ownership, pairing index
- **Issue** (`smm jira *`) — Jira issue metrics
- **Quality** (`smm sonarqube *`) — SonarQube quality measures
- **Dashboard** (`smm dashboard serve`) — bundled REST API + Next.js webapp
- **MCP server** (`smm mcp server start`, `smm-mcp`) — read-only stdio interface for agent clients

## Technology Stack

- **Node.js**: `>=26.4.0` (`engines.node`; exact `.nvmrc` / `envvars.for.actions` = `26.12.1`); **pnpm**: `>=10.0.0` (`engines.pnpm`; `packageManager` = `pnpm@12.14.0`); Monorepo via pnpm workspaces + Turborepo
- **TypeScript** 6.x (strict mode); **CLI**: Commander.js 15.x; **REST**: NestJS 12.x (Express, Swagger); **Webapp**: Next.js 16.x, React 19.x, MUI 9.x, Recharts 3.x, Tailwind CSS 4, Cypress 15.x e2e; **Docs**: VitePress
- **Vitest** 5.x for `apps/cli`, `apps/mcp`, `apps/rest`, `packages/core`, `packages/utils`; **Jest** 30.x for `apps/webapp` unit tests (via `next/jest`, `clearMocks: true`); **bashunit** for `apps/cli/e2e`
- **ESLint** 9.x (flat config `eslint.config.mjs`) + Prettier, auto-fixed on commit via lint-staged

## Project Structure

```
├── apps/
│   ├── cli/              # @smmachine/cli — Commander.js CLI (CommonJS, bundled by tsup)
│   │   ├── src/
│   │   │   ├── commands/     # One file per command group (change-requests, pipelines, code, architecture, ...)
│   │   │   ├── factories/    # CLI-level factories (jira-factory.ts)
│   │   │   ├── formatters/   # Terminal output formatting helpers
│   │   │   ├── index.ts      # Command registration entry point
│   │   │   └── screen.ts     # Interactive screen helpers
│   │   ├── __tests__/        # Vitest unit tests
│   │   ├── e2e/              # bashunit acceptance suite (run.sh, commands/, support/)
│   │   ├── lib/bashunit/     # Vendored bashunit framework
│   │   ├── tools/            # Bundled code-maat JAR
│   │   └── fetch-codemaat.sh # Code Maat downloader shipped with the package
│   ├── mcp/              # @smmachine/mcp — read-only MCP stdio server (CommonJS, tsup)
│   │   └── src/              # server.ts, tools.ts, resources.ts, prompts.ts, metrics-reader.ts, redaction.ts, validation.ts
│   ├── rest/             # @smmachine/rest — NestJS REST API (CommonJS via ts-node/tsc)
│   │   └── src/              # controllers/, dtos/, filters/, middleware/, config/, logger/, utils/, metrics.module.ts
│   └── webapp/           # @smmachine/webapp — Next.js 16 App Router dashboard (ESM)
│       ├── app/              # Routes: dashboard/, engineering-health/, reports/, api/ (route handlers)
│       ├── components/       # Feature UI: charts/, filters/, reports/, tabs/, ui/, providers/, home/
│       ├── server/           # Server-only data layer: server/api/*.ts, app-provider-data.ts
│       ├── lib/              # Client-safe helpers (dashboard-links.ts, metrics/)
│       ├── __tests__/        # Jest tests + builders/ + utils/
│       └── cypress/          # Cypress e2e specs
├── packages/
│   ├── core/             # @smmachine/core — domain logic, providers, repositories
│   │   └── src/
│   │       ├── domain/           # Per-area slices: change-requests, pipelines, code, issues, architecture, filters, metrics, health-check
│   │       ├── providers/        # External clients + fetch repositories (github, gitlab, jira, sonarqube, codemaat, git)
│   │       ├── engineering-health/  # Metric registry, adapters, orchestrator, factory
│   │       ├── infrastructure/   # Configuration, SQLite repository + migrations, timezone, user settings
│   │       └── test/             # Shared in-memory repositories and builders
│   └── utils/            # @smmachine/utils — logger, JSON, date/duration helpers
├── docs/
│   ├── vitepress/         # VitePress documentation site
│   ├── architecture/      # Architecture docs (C4 diagrams — packages-current.c4.mmd)
│   └── adrs/               # Architecture Decision Records
├── scripts/               # merge-coverage.mjs, simulate-and-test-publish.sh, Dockerfile.publish-test
├── docker-compose.yml     # SonarQube + API + webapp
├── tsup.config.ts         # Root CLI bundle (dist/index.cjs)
├── turbo.json             # Turborepo task graph (build/test/lint/type-check)
├── pnpm-workspace.yaml    # Workspace globs + dependency catalog
└── vitest.base.config.ts  # Shared Vitest configuration
```

Each `packages/core/src/domain/<area>/` slice follows the same layout: `services/`, `repositories/`, `factories/`,
`infrastructure/`, and `__tests__/`.

- **`packages/utils`** — Logger, JSON helpers, date/duration formatting. Zero workspace deps.
- **`packages/core`** — Domain types, services, providers (GitHub, GitLab, CodeMaat, SonarQube, Jira), engineering-health registry, infrastructure (`Configuration`, SQLite + JSON repositories). Depends on `@smmachine/utils`.
- **`apps/cli`** — Commander.js CLI. Thin layer: parses options, calls services, formats output. Depends on `@smmachine/core`, `@smmachine/mcp`, and `@smmachine/utils`.
- **`apps/rest`** — NestJS REST API. Controllers call core services. Depends on `@smmachine/core` and `@smmachine/utils`.
- **`apps/mcp`** — Local MCP stdio server. Read-only tools/resources, wires core services via `McpMetricsReader`. Depends on `@smmachine/core` and `@smmachine/utils`.
- **`apps/webapp`** — Next.js 16 App Router. Reads from the REST API through `server/api.ts`; MUI + Tailwind components, Recharts charts. `@smmachine/core`/`@smmachine/utils` are **devDependencies for typing only** — never import them from page or server code (enforced by `apps/webapp/__tests__/server-code-boundary.test.ts`).

## Architecture

### Dependency graph

```
@packages/utils  (no workspace deps)
       ↓
@packages/core   (depends on @packages/utils)
       ↓
apps/cli   apps/mcp   apps/rest
                          ↑ (HTTP/JSON)
                      apps/webapp
```

`apps/cli` also depends on `@smmachine/mcp` so `smm mcp server start` can boot the server. `apps/webapp` reaches the
REST API over HTTP — it has no runtime workspace dependency on `@smmachine/core`.

### Data Mutability Boundary (Critical)

- **CLI is the only write-capable app** for project data under `SMM_STORE_DATA_AT`.
- **REST API, webapp, and MCP server are read-only** — they must never generate snapshots, write files, or mutate caches.
- New features (including architecture generation) must implement generation/persistence in CLI commands only.

### Key patterns

- **Service Pattern** — `packages/core/src/domain/<area>/services/` contain business logic, accept typed filter objects, return domain types, no I/O.
- **Repository Pattern** — `packages/core/src/providers/` holds "fetch" repositories that call external APIs and cache results (CLI-only); `packages/core/src/domain/<area>/repositories/` holds "read" repositories over cached data (used by CLI and REST).
- **Factory Pattern** — per-domain factories (`packages/core/src/domain/<area>/factories/`, `packages/core/src/engineering-health/factory.ts`, `packages/core/src/infrastructure/repository-factory.ts`) wire configuration to repositories and services.
- **CLI Command Pattern** — `apps/cli/src/commands/` commands are thin: parse options into typed filters, call service methods, format output.
- **Webapp Server Layer** — `apps/webapp/server/api/*.ts` is the only place that talks to the REST API; pages and components consume it through server components and route handlers.
- **MCP Server Pattern** — Thin stdio adapter; no `MetricsOrchestrator` abstraction — compose existing core services directly inside `apps/mcp/src/metrics-reader.ts`.
- **Configuration Pattern** — All config comes from environment variables via the `Configuration` class (`packages/core/src/infrastructure/configuration.ts`).

### Module system

| Package | Module system | Notes |
|---------|--------------|-------|
| `packages/core` | CommonJS | Compiled by `tsc` to `dist/` |
| `packages/utils` | CommonJS | Compiled by `tsc` to `dist/` |
| `apps/cli` | CommonJS | Bundled by `tsup` to `dist/index.cjs` |
| `apps/mcp` | CommonJS | Bundled by `tsup` to `dist/index.cjs` (binary `dist/bin.cjs`) |
| `apps/rest` | CommonJS | `tsc` build for production, `ts-node` for dev |
| `apps/webapp` | ESM | Next.js |

The root `tsup.config.ts` bundles the published launcher: `dist/index.cjs` (CLI), `dist/rest/main.cjs` (API), and
`dist/webapp/server.cjs` (Next.js standalone server) so `smm dashboard serve` can run the full stack from one package.

## Critical Rules

### DO

- Exclude `dist/`, `build/`, `.next/`, `node_modules/`, `coverage/`, `__snapshots__/`, `.turbo/`, `*.tsbuildinfo` from searches
- Keep `packages/core` and `packages/utils` as CommonJS (no `"type": "module"`)
- Build `packages/utils` before `packages/core`, and both before any app
- Use `pnpm --filter <name>` for targeted commands, and the pnpm catalog (`pnpm-workspace.yaml`) for dependency versions
- Keep package families on one major in the catalog — `vitest` and `@vitest/coverage-v8` must both be `^5.0.5`; a mismatch pulls a duplicate Vitest toolchain into the lockfile
- Prefix unused vars with `_`; if `eslint-config-next` ignores `argsIgnorePattern`, use `void paramName;` instead
- Write tests first for new features and bug fixes (TDD); a regression fix always starts with a failing test that reproduces it
- Run the mandatory build verification after any change: `pnpm lint && pnpm typecheck && pnpm build && pnpm test`
- All functions require explicit return types — derive from the called service (`Awaited<ReturnType<PipelinesService['getMetrics']>>`) rather than `unknown`, `any`, or `void`
- Keep MCP tools read-only, redact token/credential-like fields from MCP resources
- Renaming is a feature, not a blocker — rename atomically across all layers in one change, no deprecated aliases or compatibility shims; record it as an ADR addendum
- Use the repo's `tmp/` folder for temporary files, never `/tmp`
- Webapp tests: use builders (`apps/webapp/__tests__/builders/`), `renderWithProviders()`, and `userEvent`

### NEVER DO

- Use comments instead of tests to reinforce behavior
- Add `"type": "module"` to `packages/core` or `packages/utils`
- Import from `src/` or `dist/` paths directly — always use the package name (`@smmachine/core`)
- Commit secrets, tokens, or `.env` files
- Add runtime dependencies without using the pnpm catalog
- Add or restore a `MetricsOrchestrator` abstraction
- Add write paths in REST controllers, webapp code, or MCP tools without an explicit architecture discussion
- Disable or weaken ESLint rules (`eslint-disable`, config changes) — fix the underlying issue instead
- Use `unknown` as a return type when the real type is knowable; use `as unknown`/`as never` casts to bypass TypeScript
- Use loops, conditionals, filters, or maps inside test bodies — tests must be explicit and self-contained
- Leave lint warnings or errors unresolved — `pnpm lint` must be zero errors and zero warnings

## Quick Start

```bash
pnpm install
pnpm build              # builds all packages and apps
pnpm test               # runs all tests
pnpm lint               # lints all workspaces
```

Full workflow details (CLI/REST/MCP/webapp dev servers, maintenance tasks, dependency bumps, coverage, Docker) are in
`.opencode/agents/developer-agent.md`.
