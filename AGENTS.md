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

- **Node.js**: `>=25.2.1` (see `.nvmrc`); **pnpm**: `>=10.0.0` (exact `10.34.1`); Monorepo via pnpm workspaces + Turborepo
- **TypeScript** 6.x (strict mode); **CLI**: Commander.js 14.x; **REST**: NestJS 10.x (Express, Swagger); **Webapp**: Next.js 16.x, React 19.x, MUI 7.x, Recharts, Tailwind CSS 4; **Docs**: VitePress
- **Vitest** 4.x for `apps/cli`, `apps/rest`, `packages/core`, `packages/utils`; **Jest** 30.x for `apps/webapp` (via `next/jest`, `clearMocks: true`)
- **ESLint** 9.x (flat config `eslint.config.mjs`) + Prettier, auto-fixed on commit via lint-staged

## Project Structure

```
├── apps/
│   ├── cli/              # CLI application (@smmachine/cli, CommonJS)
│   ├── mcp/              # MCP stdio server (@smmachine/mcp, CommonJS)
│   ├── rest/              # REST API (@smmachine/rest, NestJS)
│   └── webapp/           # Next.js dashboard (@smmachine/webapp)
├── packages/
│   ├── core/              # Domain logic, providers, aggregates (@smmachine/core)
│   └── utils/             # Shared utilities — logger, JSON, date helpers
├── docs/
│   ├── vitepress/         # VitePress documentation site
│   ├── architecture/      # Architecture docs (C4 diagrams)
│   └── adrs/               # Architecture Decision Records
├── docker-compose.yml     # SonarQube + API + webapp
└── tsup.config.ts         # CLI bundler
```

- **`packages/utils`** — Logger, JSON helpers, date formatting. Zero workspace deps.
- **`packages/core`** — Domain types, services, providers (GitHub, GitLab, CodeMaat, SonarQube, Jira), infrastructure (`Configuration`, file-system cache). Depends on `@smmachine/utils`.
- **`apps/cli`** — Commander.js CLI. Thin layer: parses options, calls services. Depends on `@smmachine/core`.
- **`apps/rest`** — NestJS REST API. Controllers call core services. Depends on `@smmachine/core`.
- **`apps/mcp`** — Local MCP stdio server. Read-only tools/resources, wires core services via `McpMetricsReader`.
- **`apps/webapp`** — Next.js 16 App Router. Fetches from REST API. MUI components + Recharts.

## Architecture

### Dependency graph

```
@packages/utils  (no workspace deps)
       ↓
@packages/core   (depends on @packages/utils)
       ↓
apps/cli  ────── apps/rest ────── apps/webapp
       └─────── apps/mcp
```

### Data Mutability Boundary (Critical)

- **CLI is the only write-capable app** for project data under `SMM_STORE_DATA_AT`.
- **REST API, webapp, and MCP server are read-only** — they must never generate snapshots, write files, or mutate caches.
- New features (including architecture generation) must implement generation/persistence in CLI commands only.

### Key patterns

- **Service Pattern** — `packages/core/src/domain/` services contain business logic, accept typed filter objects, return domain types, no I/O.
- **Repository Pattern** — "fetch" repositories call external APIs and cache results (CLI-only); "read" repositories provide a consistent interface over cached data (used by CLI and REST).
- **CLI Command Pattern** — `apps/cli/src/commands/` commands are thin: parse options into typed filters, call service methods, format output.
- **MCP Server Pattern** — Thin stdio adapter; no `MetricsOrchestrator` abstraction — compose existing core services directly inside `apps/mcp/src/metrics-reader.ts`.
- **Configuration Pattern** — All config comes from environment variables via the `Configuration` class (`packages/core/src/infrastructure/configuration.ts`).

### Module system

| Package | Module system | Notes |
|---------|--------------|-------|
| `packages/core` | CommonJS | Compiled by `tsc` to `dist/` |
| `packages/utils` | CommonJS | Compiled by `tsc` to `dist/` |
| `apps/cli` | CommonJS | Bundled by `tsup` to `dist/index.cjs` |
| `apps/mcp` | CommonJS | Bundled by `tsup` to `dist/index.cjs`; root launcher also emits `dist/mcp.cjs` |
| `apps/rest` | CommonJS | Run via `ts-node` |
| `apps/webapp` | ESM | Next.js |

## Critical Rules

### DO

- Exclude `dist/`, `build/`, `.next/`, `node_modules/`, `coverage/`, `__snapshots__/`, `.turbo/`, `*.tsbuildinfo` from searches
- Keep `packages/core` and `packages/utils` as CommonJS (no `"type": "module"`)
- Build `packages/utils` before `packages/core`, and both before any app
- Use `pnpm --filter <name>` for targeted commands, and the pnpm catalog (`pnpm-workspace.yaml`) for dependency versions
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
