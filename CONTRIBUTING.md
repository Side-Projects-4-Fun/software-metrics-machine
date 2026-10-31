# Contributing to Software Metrics Machine

Thanks for contributing. This repository is a **pnpm TypeScript monorepo** with applications in `apps/*` and shared libraries in `packages/*`.

## Table of Contents

- [Requirements](#requirements)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Development Workflows](#development-workflows)
- [Codebase Architecture](#codebase-architecture)
- [Testing](#testing)
- [Linting and Formatting](#linting-and-formatting)
- [Docker](#docker)
- [Pull Request Process](#pull-request-process)
- [Contribution Guidelines](#contribution-guidelines)
- [Troubleshooting](#troubleshooting)
  - [SQLite data queries](#sqlite-data-queries)
- [License](#license)

## Requirements

| Tool    | Version    | Notes                          |
|---------|------------|--------------------------------|
| Node.js | `>=26.4.0` | Exact: `26.12.1` — see `.nvmrc`, use `nvm use` |
| pnpm    | `>=10.0.0` | Exact: `12.14.0` (`packageManager`) |
| Git     | any        |                                |

Optional:

- **Docker / Docker Compose** — for local SonarQube analysis or running the full stack in containers
- **Java** — only for Code Maat source-code analysis (the JAR is bundled in `apps/cli/tools/`)

### Quick environment check

```bash
node --version   # should be >=26.4.0
pnpm --version   # should be >=10.0.0
nvm use          # if using nvm, reads .nvmrc
```

## Project Structure

```
├── apps/
│   ├── cli/              # Commander.js CLI (@smmachine/cli)
│   │   ├── src/          # index.ts, commands/, factories/, formatters/, screen.ts
│   │   ├── __tests__/    # Vitest unit tests
│   │   ├── e2e/          # bashunit acceptance suite
│   │   ├── lib/bashunit/ # Vendored bashunit runner
│   │   └── tools/        # Bundled code-maat JAR
│   ├── mcp/              # Read-only MCP stdio server (@smmachine/mcp)
│   ├── rest/             # REST API (@smmachine/rest, NestJS)
│   │   └── src/          # controllers/, dtos/, filters/, middleware/, config/, logger/, utils/
│   └── webapp/           # Next.js dashboard (@smmachine/webapp)
│       ├── app/          # App Router routes (dashboard/, engineering-health/, reports/, api/)
│       ├── components/   # Feature UI (charts/, filters/, reports/, tabs/, ui/, providers/)
│       ├── server/       # Server-only data layer (server/api/*.ts)
│       ├── lib/          # Client-safe helpers
│       ├── __tests__/    # Jest tests + builders/ + utils/
│       └── cypress/      # Cypress e2e specs
├── packages/
│   ├── core/             # Domain logic, providers, repositories (@smmachine/core)
│   │   └── src/          # domain/, providers/, engineering-health/, infrastructure/, test/
│   └── utils/            # Shared utilities — logging, JSON, date helpers (@smmachine/utils)
├── docs/
│   ├── adrs/             # Architecture Decision Records
│   ├── architecture/     # Architecture documentation (C4 diagrams)
│   └── vitepress/        # VitePress documentation site
├── scripts/              # merge-coverage.mjs, simulate-and-test-publish.sh
├── docker-compose.yml    # SonarQube + API + webapp containers
├── tsup.config.ts        # CLI bundler config
├── turbo.json            # Turborepo task runner config
├── pnpm-workspace.yaml   # Workspace definitions and dependency catalog
└── vitest.base.config.ts # Shared Vitest configuration
```

Each `packages/core/src/domain/<area>/` slice keeps the same layout: `services/`, `repositories/`, `factories/`,
`infrastructure/`, and `__tests__/`.

### Package responsibilities

- **`packages/utils`** — Logger, date formatting, JSON utilities. Zero dependencies on other workspace packages.
- **`packages/core`** — Domain types and per-area slices (change requests, pipelines, code, issues, architecture, filters, metrics), providers (GitHub, GitLab, Jira, SonarQube, CodeMaat, git), engineering-health registry, infrastructure (configuration, SQLite/JSON repositories, migrations, timezone). Depends on `@smmachine/utils`.
- **`apps/cli`** — Commander.js CLI. Depends on `@smmachine/core`, `@smmachine/mcp`, and `@smmachine/utils`.
- **`apps/rest`** — NestJS REST API. Depends on `@smmachine/core` and `@smmachine/utils`.
- **`apps/mcp`** — Read-only MCP stdio server exposing tools, resources, and prompts. Depends on `@smmachine/core`.
- **`apps/webapp`** — Next.js 16 dashboard with MUI 9 and Tailwind. Reads from the REST API through `server/api/*.ts`. `@smmachine/core`/`@smmachine/utils` are devDependencies for typing only — never import them from page code.

### Data mutability boundary (critical)

SMM enforces a strict write boundary across applications:

- **CLI is the only write-capable application** for project data and generated artifacts in `SMM_STORE_DATA_AT`.
- **REST API is read-only** and must only serve previously generated/persisted data.
- **Webapp is read-only** and must only consume REST responses.
- **MCP server is read-only** and exposes tools/resources over stdio without writing files or caches.

When implementing features (for example architecture generation), generation and persistence must happen in CLI commands. REST, webapp, and MCP must not create files, trigger generation jobs, or mutate caches as side effects.

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/Side-Projects-4-Fun/software-metrics-machine
cd software-metrics-machine
pnpm install
```

pnpm installs all workspace packages and links cross-dependencies automatically.

### 2. Build packages (required before running anything)

```bash
# Build all workspace packages and apps
pnpm build
```

> **Important:** `packages/core` and `packages/utils` must be built before any app can use them. The root `turbo.json` handles this automatically via `dependsOn: ["^build"]`.

### 3. Verify it works

```bash
# Run all tests
pnpm test

# Run the CLI (after build)
node dist/index.cjs --help
```

## Configuration

### Environment variables

Configuration is stored in `smm_config.json` inside the resolved data directory. The data directory comes from
`SMM_STORE_DATA_AT`, or from the `store_data_at` value saved in the user settings file
(`$XDG_CONFIG_HOME/smm/config.json`, falling back to `~/.config/smm/config.json`) when the env var is unset. Loading is
handled by the `Configuration` class in `packages/core/src/infrastructure/configuration.ts` together with the resolution
in `user-settings.ts`. Run `smm project configure` once to save a default data directory.

Most configuration lives in `smm_config.json`; see `docs/vitepress/features/configuration.md` for the full schema and the
project-specific `<REPO>_` environment variable overrides. The only global environment variable for configuration loading
is `SMM_STORE_DATA_AT`. Generic variables such as `GITHUB_TOKEN`, `JIRA_TOKEN`, `SMM_TIMEZONE`, or
`GIT_REPOSITORY_PATH` are not used.

| Variable                 | Required | Description                                      |
|--------------------------|----------|--------------------------------------------------|
| `SMM_STORE_DATA_AT`      | No       | Path to the data directory (optional when a default is saved via `smm project configure`) |
| `SMM_DEV_MODE`           | No       | Set to `true` during CLI dev to use local scripts |

### Webapp environment

```bash
# apps/webapp/.env.local
SMM_REST_BASE_URL=http://localhost:8000
```

### Internal configuration (`config.internal`)

The `Configuration` object has an `internal` property for **developer-only settings** that control internal behavior like storage backend selection. This is separate from user-facing environment variables.

```typescript
// packages/core/src/infrastructure/configuration.ts
export type StorageType = 'json' | 'sqlite';

export interface InternalConfiguration {
  storageType: StorageType;  // 'json' (default) | 'sqlite'
}

export interface IConfiguration {
  // ... user-facing properties ...
  internal?: InternalConfiguration;
}
```

**Why it exists:** Some settings (like which storage backend to use) are implementation details that developers may need to switch, but shouldn't be exposed as user-facing configuration in `smm_config.json`.

**How it's used:**

The `RepositoryFactory` reads `config.internal?.storageType` to decide which repository implementation to create:

```typescript
// packages/core/src/infrastructure/repository-factory.ts
static create<T>(filePath: string, logger: Logger, config: Configuration): IRepository<T> {
  const storageType = config.internal?.storageType ?? 'json';
  switch (storageType) {
    case 'json':
      return new JsonFileSystemRepository<T>(filePath, logger);
    // Future: case 'sqlite':
    //   return new SqliteRepository<T>(filePath, logger);
    default:
      throw new Error(`Unknown storage type: ${storageType}`);
  }
}
```

**How to set it:**

In tests or factories, set `internal` on the configuration object:

```typescript
const config = {
  // ... other config ...
  internal: { storageType: 'json' },
};
```

Or use the `TestConfigurationBuilder`:

```typescript
const config = new TestConfigurationBuilder()
  .withGetPathFromGitProvider('/tmp')
  .withStorageType('json')
  .build();
```

**How to extend:**

To add a new internal setting:

1. Add the property to `InternalConfiguration` in `packages/core/src/infrastructure/configuration.ts`
2. Set a default in the `Configuration` class constructor
3. Access it via `config.internal.yourSetting` where needed

```typescript
export interface InternalConfiguration {
  storageType: StorageType;
  cacheStrategy: 'aggressive' | 'conservative';  // new setting
}

// In Configuration class:
internal: InternalConfiguration = {
  storageType: 'json',
  cacheStrategy: 'aggressive',
};
```

**CLI usage:**

The CLI reads `SMM_STORAGE_TYPE` from the environment and applies it to the configuration. For other internal settings, you can set them via environment variables and wire them through the configuration repository:

```bash
SMM_STORAGE_TYPE=sqlite pnpm cli -- prs summary
```

## Development Workflows

### CLI development

```bash
# Fast dev mode with tsx (no build step)
pnpm cli -- --help
pnpm cli -- prs summary

# Pass additional options
pnpm cli -- prs summary --start-date=2025-01-01 --output=json
```

The `pnpm cli` command runs `tsx src/index.ts` from `apps/cli` with `SMM_DEV_MODE=true`.

### REST API development

```bash
# Start the API on port 8000
pnpm --filter @smmachine/rest dev
```

This runs NestJS via `ts-node`. The API serves Swagger docs at `http://localhost:8000/api`.

### Webapp development

```bash
# Start the Next.js dashboard on port 3000
pnpm --filter @smmachine/webapp dev
```

Requires the REST API to be running. The webapp reads `SMM_REST_BASE_URL` from `apps/webapp/.env.local`.

### MCP server development

```bash
# Run the stdio server directly
SMM_STORE_DATA_AT=/path/to/smm-data pnpm --filter @smmachine/mcp dev

# Or via the CLI
SMM_STORE_DATA_AT=/path/to/smm-data pnpm cli -- mcp server start
```

### Running the full stack

```bash
# Starts both webapp (3000) and REST API (8000) concurrently
pnpm dev
```

### Dashboard (bundled)

```bash
# Start both bundled REST and webapp servers from the CLI
pnpm cli -- dashboard serve
```

### Acceptance and e2e suites

```bash
# bashunit CLI acceptance suite (apps/cli/e2e)
pnpm run test:cli:acceptance

# Cypress webapp e2e (boots the app with MSW-backed REST responses)
pnpm --filter @smmachine/webapp cy:run
```

The Cypress journeys run in CI as the `Webapp Cypress Journeys` job. Install scripts are skipped on install, so a
fresh clone needs the binary once:

```bash
pnpm --filter @smmachine/webapp exec cypress install
```

### Documentation

```bash
# Start VitePress dev server
pnpm docs
```

Docs are served at `http://localhost:5173` by default.

### Targeted workspace commands

```bash
pnpm --filter @smmachine/core build
pnpm --filter @smmachine/cli test
pnpm --filter @smmachine/rest lint
pnpm --filter @smmachine/webapp build
```

### Common workflows

**Adding a new CLI command:**
1. Add domain logic to `packages/core/src/domain/` (service + types)
2. Add CLI command to `apps/cli/src/commands/`
3. Register it in `apps/cli/src/index.ts`
4. Add REST endpoint to `apps/rest/src/controllers/` (if needed)
5. Update VitePress docs in `docs/vitepress/features/`
6. Build and test: `pnpm build && pnpm test`

**Adding a new provider (e.g., a new git platform):**
1. Create provider client in `packages/core/src/providers/<provider>/`
2. Implement the fetch repository interface
3. Wire it into the owning domain slice factory (`packages/core/src/domain/<area>/factories/`) or `packages/core/src/infrastructure/repository-factory.ts`
4. Add configuration handling in `Configuration` class

**Adding a new Engineering Health metric:**
1. Add the adapter in `packages/core/src/engineering-health/adapters/`
2. Register it in `packages/core/src/engineering-health/registry.ts`
3. Expose it through the CLI/REST endpoints if needed

## Codebase Architecture

### Dependency graph

```
@packages/utils  (no deps)
       ↓
@packages/core   (depends on @smmachine/utils)
       ↓
apps/cli   apps/mcp   apps/rest
                          ↑ (HTTP/JSON)
                      apps/webapp
```

`apps/cli` also depends on `@smmachine/mcp` so `smm mcp server start` can boot the server. `apps/webapp` talks to the
REST API over HTTP and has no runtime workspace dependency on `@smmachine/core`.

### Key patterns

- **Services** (`packages/core/src/domain/<area>/services/`) — Business logic, no I/O. Accept typed filters and return domain types.
- **Repositories** (`packages/core/src/providers/` for fetch, `packages/core/src/domain/<area>/repositories/` for read) — Data access and caching. Fetch repositories call external APIs; read repositories serve cached data.
- **Factories** (`packages/core/src/domain/<area>/factories/`, `packages/core/src/engineering-health/factory.ts`, `packages/core/src/infrastructure/repository-factory.ts`) — Wire configuration and create repository/service instances.
- **Commands** (`apps/cli/src/commands/`) — Commander.js command definitions. Thin layer that parses options and calls services.
- **Webapp server layer** (`apps/webapp/server/api/*.ts`) — The only place that calls the REST API.

### Module system

The monorepo uses a mix of module systems:

| Package     | Type     |
|-------------|----------|
| `apps/cli`  | CommonJS (bundled by tsup for Node.js distribution) |
| `apps/mcp`  | CommonJS (bundled by tsup) |
| `apps/rest` | CommonJS (tsc for production, ts-node for dev) |
| `apps/webapp` | ESM (Next.js) |
| `packages/core` | CommonJS |
| `packages/utils` | CommonJS |

## Testing

### Test framework

- **Vitest** (`^5.0.5`) — used by `apps/cli`, `apps/mcp`, `apps/rest`, `packages/core`, `packages/utils`
- **Jest** (30.x) — used by `apps/webapp` (via `next/jest`)
- **bashunit** — CLI acceptance tests in `apps/cli/e2e`
- **Cypress** (16.x) — webapp e2e journeys in `apps/webapp/cypress`, with MSW running against the Next.js server

### Running tests

```bash
# All workspaces
pnpm test

# Single workspace
pnpm --filter @smmachine/core test
pnpm --filter @smmachine/cli test
pnpm --filter @smmachine/mcp test

# With coverage
pnpm --filter @smmachine/core test:coverage

# Watch mode
pnpm --filter @smmachine/core exec vitest --watch
```

### Test conventions

- Test files live in `__tests__/` directories within each workspace; `packages/core` colocates them per domain slice and provider
- File pattern: `*.test.ts`
- Vitest globals are enabled (`describe`, `it`, `expect` available without import)
- Shared Vitest config lives in `vitest.base.config.ts`

### Writing tests

```typescript
// Example test structure
describe('PRsService', () => {
  it('calculates average open days correctly', async () => {
    // ...
  });
});
```

## Linting and Formatting

### ESLint

```bash
# All workspaces
pnpm lint

# Single workspace
pnpm --filter @smmachine/cli lint
```

Key rules (from `eslint.config.mjs`):
- `@typescript-eslint/no-explicit-any`: error
- `@typescript-eslint/no-unused-vars`: error (prefix with `_` to ignore)
- `prettier/prettier`: error
- `no-console`: warn (only `console.warn` and `console.error` allowed)
- `@typescript-eslint/no-floating-promises`: error

### Prettier

```bash
# Check formatting
pnpm exec prettier --check .

# Fix formatting
pnpm exec prettier --write .

# Stage + fix (via lint-staged, runs automatically on commit)
```

Configuration (`.prettierrc.json`):

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

### Pre-commit checks

Lint-staged runs automatically on commit via `.lintstagedrc.json`:
- `*.{ts,tsx}` → `eslint --fix` + `prettier --write`
- `*.{json,md}` → `prettier --write`

## Docker

The project includes Docker support for running services locally.

### docker-compose.yml

```bash
# Start full stack (SonarQube + API + webapp)
docker compose up

# Start only SonarQube (for local code analysis)
docker compose up sonarqube
```

Services:
- **SonarQube** — port 9000, `sonarqube:10-community`
- **API** — port 8000, `node:25-slim`
- **Webapp** — port 3000, `node:25-slim`

### CLI command for SonarQube analysis

```bash
# Run local SonarQube analysis via Docker
smm sonarqube analysis run
```

## Pull Request Process

### Checklist before opening

1. Branch is rebased or up to date with `main`.
2. Run `pnpm test` — all tests pass.
3. Run `pnpm lint` — no errors (warnings are acceptable).
4. Run `pnpm build` — builds successfully.
5. Relevant documentation is updated (`docs/vitepress/`).
6. New CLI commands are documented in `docs/vitepress/features/`.

### Pre-submission sanity check

```bash
pnpm test
pnpm run clean:full && pnpm install && pnpm run build
```

> `clean:full` removes all `node_modules` and performs a clean install. Use it to verify your changes work in a fresh environment.

### PR description template

```
## What changed
[Describe the changes in 1-2 sentences]

## Why it changed
[Motivation, bug reference, or feature request link]

## How it was validated
[Test output, manual verification steps, screenshots]
```

### Review process

Maintainers will review your PR and may request changes. Please:

- Address feedback with follow-up commits (no need to squash).
- Keep discussions focused on the code.
- Respond to reviews in a timely manner.

### After merge

Your changes will be included in the next release. The package is published to npm as `@smmachine/launcher`.

## Contribution Guidelines

- Keep changes focused and scoped to a single feature or fix.
- Add or update tests for behavior changes.
- Update docs when public behavior, commands, or architecture changes.
- Preserve existing project conventions and folder boundaries.
- Follow the existing module system (CommonJS for CLI/core/utils, ESM for webapp).
- Do not add new runtime dependencies without discussion.
- Use the pnpm catalog (`pnpm-workspace.yaml`) for dependency versions instead of hardcoding them.

### What not to do

- Do not commit secrets, tokens, or `.env` files.
- Do not add files to the npm package without updating `package.json` `files` field.
- Do not change the module system of existing packages (CJS ↔ ESM) without discussion.
- Do not introduce new build tools without a clear rationale.

## Troubleshooting

### Build failures after pulling changes

```bash
pnpm install                    # Update lockfile if dependencies changed
pnpm build                      # Full rebuild
```

### "Cannot find module @smmachine/core"

The workspace packages need to be built first:

```bash
pnpm --filter @smmachine/utils build
pnpm --filter @smmachine/core build
```

### ESLint errors on code you didn't change

```bash
pnpm run lint -- --fix                      # Re-run lint
```

### Tests failing due to missing test data

Some tests require cached data in `SMM_STORE_DATA_AT`. Set it to a directory with pre-fetched data, or run the corresponding fetch commands first:

```bash
SMM_STORE_DATA_AT=./.data smm prs fetch
SMM_STORE_DATA_AT=./.data smm pipelines fetch
```

### pnpm version mismatch

```bash
corepack enable
corepack prepare pnpm@12.14.0 --activate
```

### SQLite data queries

When using the SQLite storage backend (`SMM_STORAGE_TYPE=sqlite`), you can open the database directly with any SQLite client (e.g. `sqlite3 smm.sqlite`) to inspect or fix data issues. The database file lives in `SMM_STORE_DATA_AT`.

**List all tables**

```sql
SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;
```

**Check which migrations have been applied**

```sql
SELECT * FROM smm_schema_migrations ORDER BY applied_at;
```

**Inspect namespaces and record counts per table**

```sql
-- Generic / singleton records
SELECT namespace, COUNT(*) AS count FROM repository_records GROUP BY namespace ORDER BY namespace;

-- Change requests (pull requests / merge requests)
SELECT namespace, COUNT(*) AS count FROM change_requests GROUP BY namespace ORDER BY namespace;

-- Change request comments
SELECT namespace, COUNT(*) AS count FROM change_request_comments GROUP BY namespace ORDER BY namespace;

-- Commits
SELECT namespace, COUNT(*) AS count FROM commits GROUP BY namespace ORDER BY namespace;

-- Pipeline runs
SELECT namespace, COUNT(*) AS count FROM pipeline_runs GROUP BY namespace ORDER BY namespace;

-- Pipeline jobs
SELECT namespace, COUNT(*) AS count FROM pipeline_jobs GROUP BY namespace ORDER BY namespace;
```

**Check the most recent records stored for a namespace**

```sql
-- Replace '<your-namespace>' with the namespace value shown above
SELECT id, state, created_at, merged_at, stored_at
FROM change_requests
WHERE namespace = '<your-namespace>'
ORDER BY stored_at DESC
LIMIT 20;

SELECT hash, author, timestamp, stored_at
FROM commits
WHERE namespace = '<your-namespace>'
ORDER BY stored_at DESC
LIMIT 20;
```

**Find duplicate or stale records**

```sql
-- Duplicate change requests by number within a namespace
SELECT namespace, number, COUNT(*) AS cnt
FROM change_requests
GROUP BY namespace, number
HAVING cnt > 1;

-- Pipeline runs with no conclusion (still in progress / stuck)
SELECT namespace, id, status, conclusion, run_started_at, stored_at
FROM pipeline_runs
WHERE conclusion IS NULL OR conclusion = ''
ORDER BY run_started_at DESC;
```

**Delete all records for a specific namespace (reset and re-fetch)**

```sql
-- Run the appropriate DELETE for the data type you want to reset:
DELETE FROM repository_records          WHERE namespace = '<your-namespace>';
DELETE FROM change_requests             WHERE namespace = '<your-namespace>';
DELETE FROM change_request_comments     WHERE namespace = '<your-namespace>';
DELETE FROM commits                     WHERE namespace = '<your-namespace>';
DELETE FROM pipeline_runs               WHERE namespace = '<your-namespace>';
DELETE FROM pipeline_jobs               WHERE namespace = '<your-namespace>';
```

After deleting, re-run the relevant CLI fetch command to repopulate:

```bash
SMM_STORE_DATA_AT=./.data smm prs fetch
SMM_STORE_DATA_AT=./.data smm pipelines fetch
```

**Inspect CodeMaat tables**

```sql
SELECT COUNT(*), MIN(fetched_at), MAX(fetched_at) FROM codemaat_code_churn;
SELECT COUNT(*), MIN(fetched_at), MAX(fetched_at) FROM codemaat_author_churn;
SELECT COUNT(*), MIN(fetched_at), MAX(fetched_at) FROM codemaat_entity_churn;
SELECT COUNT(*), MIN(fetched_at), MAX(fetched_at) FROM codemaat_file_coupling;
SELECT COUNT(*), MIN(fetched_at), MAX(fetched_at) FROM codemaat_layered_coupling;
SELECT COUNT(*), MIN(fetched_at), MAX(fetched_at) FROM codemaat_age;
SELECT COUNT(*), MIN(fetched_at), MAX(fetched_at) FROM codemaat_entity_effort;
SELECT COUNT(*), MIN(fetched_at), MAX(fetched_at) FROM codemaat_entity_ownership;
```

**Inspect SonarQube tables**

```sql
SELECT namespace, COUNT(*) AS count, MIN(fetched_at), MAX(fetched_at)
FROM sonarqube_measures GROUP BY namespace;

SELECT namespace, COUNT(*) AS count, MIN(fetched_at), MAX(fetched_at)
FROM sonarqube_component_tree GROUP BY namespace;

SELECT namespace, COUNT(*) AS count, MIN(fetched_at), MAX(fetched_at)
FROM sonarqube_historical_measures GROUP BY namespace;
```

**Reset a failed migration (use with caution)**

If a migration was partially applied and left the schema in a broken state, remove its entry so it runs again on the next startup:

```sql
DELETE FROM smm_schema_migrations WHERE migration_id = '<migration-id>';
```

## License

MIT — by contributing, you agree your contributions are licensed under the repository license. See [LICENSE](LICENSE).
