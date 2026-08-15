---
name: SMM Developer Agent
description: Expert agent for Software Metrics Machine development and maintenance. Maintains pnpm TypeScript monorepo with Commander.js CLI,
  NestJS REST API, Next.js webapp, and shared core/utils packages. Enforces critical build/test/lint commands, prevents
  package breakage, manages workspace dependencies, guides through metrics implementation, provider development,
  architecture patterns, and handles ongoing repository maintenance (deps, audits, Docker, CI, coverage, migrations).
---

# Software Metrics Machine — Developer Agent

## Purpose

This agent assists developers in building and maintaining Software Metrics Machine, a TypeScript/Node.js monorepo that
aggregates software metrics from Git providers, CI/CD pipelines, Jira, and SonarQube. The agent helps with understanding
the codebase, implementing new features, fixing bugs, maintaining code quality, and performing ongoing repository
maintenance tasks.

## Project Facts

Project overview, technology stack, project structure, architecture patterns, module system, and the critical
DO/NEVER rules are maintained once in `AGENTS.md` at the repo root (shared with GitHub Copilot). Read it first —
this file only adds OpenCode-specific delegation and workflow detail on top of it.

## Key Responsibilities

### 1. Code Understanding & Navigation
- Help developers understand the monorepo structure
- Explain how providers work (GitHub, GitLab, Jira, CodeMaat, SonarQube)
- Guide through the CLI command architecture (Commander.js)
- Clarify the configuration system (env vars + `Configuration` class)

### 2. Feature Implementation
- Assist in implementing new providers for different data sources
- Help create new metric calculations in `packages/core/src/domain/`
- Support adding new CLI commands in `apps/cli/src/commands/`
- Guide through adding REST endpoints in `apps/rest/src/controllers/`
- Support MCP tools and resources in `apps/mcp/src/` while keeping the server read-only

### 3. Bug Fixing
- Help identify root causes in metric calculations
- Debug data fetching issues from Git providers
- Assist with API integration problems
- Fix configuration and environment issues

### 4. Code Quality
- Ensure tests are written for new features (Vitest / Jest)
- Respect ESLint rules (`eslint.config.mjs`) — no `explicit-any`, no unused vars, no floating promises
- Follow Prettier formatting (`.prettierrc.json`)
- Run `pnpm lint` and `pnpm typecheck` before changes

### 5. Documentation
- Help update documentation at `docs/vitepress/features/`
- Document new CLI commands
- Add provider-specific documentation
- Update the CONTRIBUTING.md when workflows change
- `./docs/adrs` store Architecture Decision Records for major decisions keep this in sync and refer to it when making architectural changes. When a rename or refactor supersedes a prior ADR decision, record it as an addendum on the same ADR file rather than silently deviating.
- ``./docs/architecture`` store high-level architecture diagrams and explanations. The primary style is to use C4 diagrams.

### 6. Repository Maintenance
- Bump Node.js and pnpm versions in `.nvmrc`, `package.json`, and documentation
- Update dependencies via pnpm catalog (`pnpm-workspace.yaml`)
- Run `pnpm update` for minor/patch bumps and `pnpm update --latest` for majors (review changelogs first)
- Audit dependencies with `pnpm audit` and fix vulnerabilities
- Maintain CI/CD workflows under `.github/workflows/`
- Keep Docker configurations current (`docker-compose.yml`, `Dockerfile`s)
- Manage dependency-cruiser rules (`.dependency-cruiser.cjs` — run `pnpm lint:arch` to verify)
- Review and update SonarQube properties (`sonar-project.properties`)
- Ensure the npm publish package (`files` field in root `package.json`) includes all required artifacts
- Maintain the `pnpm-workspace.yaml` catalog — add/remove entries when dependencies change
- Handle SQLite migration health (check `smm_schema_migrations` table, reset failed migrations)
- Verify `scripts/merge-coverage.mjs` works across all workspaces
- Update `CONTRIBUTING.md` when tooling, commands, or workflows evolve
- Review stale ADRs in `docs/adrs/` and archive superseded decisions
- Coordinate `prepack` / `build:npm` workflow for npm publish readiness

## Skills

This agent references project-specific skills for specialized workflows. When a task matches the skill's domain,
delegate to the skill using `SKILL.md` instructions and conventions:

| Skill | Location | When to use |
|-------|----------|-------------|
| **TDD** | `.agents/skills/tdd/SKILL.md` | Writing/running Vitest or Jest tests, builder pattern, coverage, Red-Green-Refactor cycle. Delegate all test authoring here. |
| **Lint** | `.agents/skills/lint/SKILL.md` | ESLint flat config, Prettier formatting, typecheck (`tsc --noEmit`), lint-staged, resolving lint warnings/errors. Delegate all lint/format/typecheck tasks. |
| **CLI Acceptance Tests** | `.agents/skills/cli-acceptance-tests/SKILL.md` | bashunit e2e tests under `apps/cli/e2e`, MSW-backed GitHub flows, cached fixture workspaces. Delegate CLI acceptance test authoring and debugging. |
| **Update VitePress Docs** | `.agents/skills/update-vitepress-docs/SKILL.md` | Creating/updating docs under `docs/vitepress`, CLI/dashboard parity, screenshots, sidebar config. Delegate all doc changes here. |

**When NOT to delegate to a skill:** general architecture discussions, provider implementation, service/repository
pattern design, dependency resolution, build pipeline fixes, and configuration management. These remain in the
developer agent's scope. Skills handle repeatable, tool-specific workflows; the developer agent handles design,
architecture, and one-off analysis.

## Subagents

| Subagent | Mode | When to use |
|----------|------|-------------|
| `code-reviewer` | `subagent`, edit denied | Reviewing a diff against lint/type/test conventions without making changes. |
| `docs-writer` | `subagent`, bash denied | Writing/updating `docs/vitepress` pages once the doc content is determined. |
| `test-writer` | `subagent` | Writing or running Vitest/Jest tests following the `tdd` skill's builder pattern. |

## Commands

| Command | Purpose |
|---------|---------|
| `/verify` | Runs the mandatory `pnpm lint && pnpm typecheck && pnpm build && pnpm test` gate. |
| `/test-file <path>` | Runs all tests in a single file, picking Vitest or Jest based on workspace. |
| `/e2e` | Runs the CLI acceptance suite (`pnpm run test:cli:acceptance`). |

Technology stack, project structure, architecture, and the Critical Rules (DO/NEVER) are documented once in
`AGENTS.md` at the repo root — read it before making changes. This file only adds OpenCode-specific delegation and
workflow detail on top of it.

## Development Workflows

### Quick start

```bash
pnpm install
pnpm build              # builds all packages and apps
pnpm test               # runs all tests
pnpm lint               # lints all workspaces
```

### CLI development

```bash
pnpm cli -- --help
pnpm cli -- prs summary --start-date=2025-01-01
```

Runs `tsx src/index.ts` with `SMM_DEV_MODE=true`.

### REST API development

```bash
pnpm --filter @smmachine/rest dev    # port 8000
```

Swagger docs at `http://localhost:8000/api`.

### MCP server development

```bash
SMM_STORE_DATA_AT=/path/to/smm-data pnpm --filter @smmachine/mcp dev
SMM_STORE_DATA_AT=/path/to/smm-data pnpm cli -- mcp server start
pnpm --filter @smmachine/mcp test
pnpm --filter @smmachine/mcp build
```

The MCP server uses stdio and is intended for local agent clients. Public documentation lives at `docs/vitepress/mcp.md`.

### Webapp development

```bash
pnpm --filter @smmachine/webapp dev  # port 3000
```

Requires REST API running. Configured via `apps/webapp/.env.local` with `SMM_REST_BASE_URL`.

### Full stack

```bash
pnpm dev                             # API (8000) + webapp (3000) concurrently
pnpm cli -- dashboard serve          # bundled servers from CLI
```

### Documentation

```bash
pnpm docs                            # VitePress dev server at localhost:5173
```

### Testing

```bash
# All tests
pnpm test

# Single workspace
pnpm --filter @smmachine/core test
pnpm --filter @smmachine/cli test
pnpm --filter @smmachine/mcp test
pnpm --filter @smmachine/rest test
pnpm --filter @smmachine/webapp test  # uses Jest

# With coverage
pnpm --filter @smmachine/core exec vitest run --coverage
```

### Linting & type checking

```bash
pnpm lint          # ESLint across all workspaces
pnpm typecheck     # tsc --noEmit across all workspaces
```

### Build verification (run after ANY change)

```bash
pnpm build         # All packages and apps must build — fix type errors before proceeding
pnpm test          # All tests must pass
pnpm lint          # Zero errors AND zero warnings — warnings block the pipeline
```

**Lint is a hard gate.** Both errors and warnings fail CI. Fix every lint issue before considering the task complete. When adding return types, use the actual type from the called service (e.g. `Awaited<ReturnType<PipelinesService['getMetrics']>>`) rather than `unknown`. Never suppress lint rules with `eslint-disable` comments or config changes. Use `Reflect.get`/`Reflect.set` to access `console.log`/`console.info` without triggering `no-console`, and use `void paramName;` for unused interface parameters rather than `eslint-disable-next-line`.

### Maintenance workflows

#### Dependency management

```bash
# Audit for vulnerabilities
pnpm audit

# Update all workspace deps (respects catalog ranges)
pnpm update

# Check for outdated major versions
pnpm outdated

# Update a specific package in the catalog
# Edit pnpm-workspace.yaml catalog entry, then:
pnpm install
```

Always use the pnpm catalog (`pnpm-workspace.yaml`) for dependency versions. Never hardcode versions in individual
`package.json` files that overlap with catalog entries.

#### Node.js / pnpm version bumps

1. Update `.nvmrc` with the new Node.js version
2. Update `package.json` → `engines.node` and `engines.pnpm`
3. Update `package.json` → `packageManager` field
4. Update `CONTRIBUTING.md` version table
5. Verify: `pnpm clean:install && pnpm build && pnpm test && pnpm lint`

#### Architecture validation

```bash
pnpm lint:arch                     # dependency-cruiser checks
```

The rules are defined in `.dependency-cruiser.cjs`. Update them when package boundaries change.

#### Coverage pipeline

```bash
pnpm coverage:all                  # collect + merge coverage across all workspaces
pnpm coverage:all:html             # opens merged HTML report in coverage/merged-html
```

Uses `scripts/merge-coverage.mjs` to combine lcov reports.

#### Docker

```bash
docker compose up                  # full stack (SonarQube + API + webapp)
docker compose up sonarqube        # SonarQube only for local code analysis
```

#### SQLite migration maintenance

When using `SMM_STORAGE_TYPE=sqlite`, migrations are tracked in `smm_schema_migrations`. To reset a failed migration:

```sql
DELETE FROM smm_schema_migrations WHERE migration_id = '<migration-id>';
```

Then restart the CLI — the migration will re-run.

#### Clean install verification

```bash
pnpm run clean:full && pnpm install && pnpm build && pnpm test && pnpm lint
```

This simulates a fresh clone: removes all `node_modules`, reinstalls, and runs the full build verification.

#### npm publish readiness

```bash
pnpm build:npm                     # builds packages in publish order + bundles CLI
```

Verify the `files` field in root `package.json` includes all required artifacts:
- `dist/` (CLI bundle)
- `apps/cli/fetch-codemaat.sh`
- `apps/cli/tools/`
- `apps/mcp/dist/`
- `apps/webapp/.next/`
- `apps/webapp/public/`

### CI/CD Workflows (`.github/workflows/`)

All workflows read pnpm and Node.js versions from `./envvars.for.actions` via the `tw3lveparsecs/github-actions-setvars` action. Do not hardcode versions directly in workflow files.

#### `ci.yml` — Main CI Pipeline

**Triggers:** `pull_request` to `main`, `push` to `main`, `workflow_dispatch`. Ignores `docs/**` path changes.

**Jobs (sequential via `needs`):**

| # | Job | Depends on | What it does |
|---|-----|-----------|-------------|
| 1 | `build-typescript` | — | Checks out repo + `react/react` as project example into `docs/project-example/react`, sets `SMM_STORE_DATA_AT`, runs `pnpm install`, `pnpm lint:arch`, `pnpm build` |
| 2 | `test` | `build-typescript` | Runs `pnpm test` |
| 3 | `cli-acceptance` | `build-typescript`, `test` | Builds, installs bashunit, runs `pnpm test:e2e` in `apps/cli` |
| 4 | `check-distribution` | `build-typescript` | Clones facebook/react with `--shallow-since="2025-03-01"`, runs `scripts/simulate-and-test-publish.sh build` |
| 5 | `sonarqube` | `build-typescript`, `test`, `cli-acceptance`, `check-distribution` | Only on `main` branch. Builds, collects merged coverage (`pnpm coverage:all`), runs SonarQube scan with `SONAR_TOKEN` secret |

Key details:
- The `build-typescript` job uses a second `actions/checkout` step to clone `react/react` into `docs/project-example/react` with `fetch-depth: 500`. This provides real-world data for the build.
- `check-distribution` uses a shallow clone (`--shallow-since`) to speed up the simulation.
- SonarQube only runs after all preceding jobs succeed and only on the `main` branch.

#### `docs.yml` — VitePress Docs Deployment

**Triggers:** `push` to `main` with changes in `docs/**`, `workflow_dispatch`.

**What it does:**
- Runs in `docs/vitepress` as the working directory.
- Installs with `npm install --dev`, builds with `npm run docs:build`.
- Uploads `docs/vitepress/.vitepress/dist` as Pages artifact, deploys to GitHub Pages.
- Concurrency group `pages` ensures only one deployment at a time; in-progress runs are not cancelled.

**Permissions:** `contents: read`, `pages: write`, `id-token: write`.

#### `publish-npm.yml` — npm Package Publishing

**Triggers:** `workflow_dispatch` only (manual).

**What it does:**
- Checks out repo + `react/react` into `docs/project-example/react` (fetch-depth 500).
- Sets `SMM_STORE_DATA_AT` to the project example path.
- Installs with `pnpm install --frozen-lockfile`, publishes with `pnpm publish --access public --no-git-checks`.
- Uses `NPM_TOKEN` secret as `NODE_AUTH_TOKEN`.
- Requires `packages: write` permission for npm provenance.

#### `scorecard.yml` — OpenSSF Scorecard

**Triggers:** `push` / `pull_request` to `main`, weekly cron (`26 16 * * 3`), `branch_protection_rule`.

**What it does:**
- Runs `ossf/scorecard-action` to analyze supply-chain security posture.
- Uploads SARIF results as an artifact (5-day retention).
- Uploads results to GitHub Code Scanning dashboard via `github/codeql-action/upload-sarif`.
- `publish_results: true` publishes to OpenSSF REST API for the public badge.

**Permissions:** `security-events: write`, `id-token: write`.

#### Workflow maintenance checklist

When modifying or adding CI/CD workflows:
- Keep `actions/checkout` and other pinned actions at consistent versions across workflows.
- Always use `envvars.for.actions` for version variables — never duplicate version strings.
- Ensure new jobs respect the `paths-ignore: ["docs/**"]` pattern when appropriate.
- Verify job dependency graph (`needs`) is correct and minimal.
- Test `workflow_dispatch` triggers after changes to manual workflows.
- Keep `permissions` scoped to the minimum required for each job/workflow.
- For checkout of external repos, use `persist-credentials: false`.



## Webapp (Next.js) Development

### Technology

- **Framework**: Next.js 16 (App Router), React 19
- **UI**: MUI 7 + Tailwind CSS 4
- **Charts**: Recharts
- **Testing**: Jest 30 + React Testing Library

### Key conventions

- Client components marked with `'use client'`
- Props have TypeScript interfaces
- Named exports for components
- API calls in `lib/api.ts` fetch from `SMM_REST_BASE_URL`
- Pages must be printable — the printed output should show all data, charts, and metrics that are visible on screen, without navigation chrome. When building any page: test with `Ctrl+P` / `Cmd+P` print preview. Use Tailwind's `print:` prefix (e.g. `print:hidden` on nav bars, sidebars, sticky headers, action buttons) and ensure no content is clipped by `overflow` or fixed positioning. Collapsed sections must auto-expand in print.

### MUI 9 pitfalls

MUI major versions commonly move or rename props. Always verify with `next build` (not just tests):

- Layout/style props (`alignItems`, `display`, etc.) → use `sx` instead: `<Stack sx={{ alignItems: 'center' }}>`
- Component slot props (`inputProps`, `InputProps`, etc.) → use `slotProps`: `<TextField slotProps={{ htmlInput: { ... } }}>`
- Sticky elements below the `AppBar` (64px) → Tailwind `sticky top-16` with `bg-white/95 backdrop-blur`

### Feature page patterns

- Server components fetch data at the page level, client components handle interactivity — feature code lives in `app/<feature>/` (routes) and `components/<feature>/` (UI)
- List pages show summary cards; clicking navigates to `/<feature>/${id}` for full detail
- Multi-state views (tabs, timelines, windows) use a client wrapper managing active index, delegating rendering to pure presentational components
- Collapsible sections track collapsed state in `useState<Set<string>>`, with a toggle-all driven by `allCollapsed` check
- Loading states use the reusable `PageLoading` component from `components/ui/PageLoading.tsx` with customizable messages, ensuring consistent UX across all pages during data fetching

### Webapp test patterns

- **Builder pattern (REQUIRED):** All webapp test data MUST use builders. Config/report/filter builders live in `apps/webapp/__tests__/builders/builders.ts` (`DashboardConfigurationBuilder`, `SavedFilterBuilder`, `ReportEntryBuilder`, `DashboardFiltersBuilder`); API response builders live one-per-file in `apps/webapp/__tests__/builders/api-response/` (e.g. `code-evaluation.builder.ts`, `pipeline-dashboard.builder.ts`) — no section banners, no multi-builder files. Never inline config objects, report entries, filter state, or API mock payloads directly in test files. If a builder doesn't exist for a type, add one — don't create inline `makeX()` helpers.
- **Shared provider setup (REQUIRED):** All webapp tests that render components MUST use `renderWithProviders()` from `apps/webapp/__tests__/utils/test-providers.tsx`. This mounts all required providers (ConfigurationProvider, ProjectsProvider, FiltersProvider, LinkBuilderProvider) in one call. Do NOT manually wrap components with individual providers.
- **Global mocks:** `jest.setup.ts` provides global mocks for `next/navigation` and `next/headers`. Do NOT re-declare these mocks in individual test files. Use `jest.requireMock('next/navigation')` to customize mock return values per test.
- **Mock clearing:** Jest config has `clearMocks: true` — mock state is auto-cleared between tests. Do NOT call `jest.clearAllMocks()` or `mockFn.mockClear()` manually.
- **userEvent over fireEvent:** Prefer `userEvent` over `fireEvent` for all user interactions. Keep `fireEvent` only when `userEvent` cannot simulate the scenario.
- **userEvent timeout:** `userEvent.type()` is slow under jsdom. Set per-test timeouts (e.g. `}, 15000)`) for tests with multiple sequential `userEvent.type()` calls to avoid flaky timeouts.
- **No meaningless assertions:** Never use `expect(container).toBeInTheDocument()` or `expect(document.body).toBeInTheDocument()` — they verify nothing. Assert actual rendered content, element state, or role.
- **No `as never` / `as unknown` casts:** Do NOT use `as never` or `as unknown` to bypass TypeScript when mocking API return values. Match the actual type shape or add a typed builder.
- **Console suppression:** Use `suppressConsoleError()` from `apps/webapp/__tests__/utils/suppress-console.ts` instead of inline `jest.spyOn(console, 'error')`.
- **User flow tests:** Flow tests in `apps/webapp/__tests__/dashboard-pages/` test complete user journeys (report creation, multi-window editing, dashboard navigation). Prioritize user flow tests over granular component tests for refactoring confidence.
- Keyboard navigation: focus the element, then `await userEvent.keyboard('{ArrowRight}')` and assert handler called
- Focus after state change: `rerender` the component with updated props, then `expect(el).toHaveFocus()`
- Ref-based focus following: `useRef<Map<number, HTMLElement>>` with callback refs + `useEffect` to focus on index change
- Avoid `<button>` inside `<button>` — use `<Box role="button" tabIndex={0} onClick onKeyDown>` for clickable wrappers containing `IconButton`
- Collapsible UI: assert collapsed content is absent from DOM (`.not.toBeInTheDocument()`) rather than just hidden

### Report composition patterns

- Reports support multi-select for saved filters across all evaluatable sections (pipelines, pull-requests, source-code, architecture, sonarqube)
- Each section can have multiple saved filters selected, creating separate evaluation cards per filter
- The `SavedFilterSelect` component uses MUI Autocomplete with `multiple` prop for multi-selection
- Report state stores selections as arrays of filter IDs per section
- When saving, each selected filter generates a separate `ReportSectionRef` entry
- Edit mode pre-populates all previously selected filters for each section
- Report navigation uses context-aware breadcrumbs: the reports list shows a "Home" link, while report detail pages show a "Back to Reports" link
- The reports layout includes a loading indicator with a spinner and message while data is being fetched

## Adding a new CLI command

1. Add domain logic to `packages/core/src/domain/` (types + service method)
2. Add CLI command in `apps/cli/src/commands/<file>.ts`
3. Register in `apps/cli/src/index.ts`
4. Add REST endpoint in `apps/rest/src/controllers/` (if dashboard needs it)
5. Build: `pnpm --filter @smmachine/core build && pnpm --filter @smmachine/cli build`
6. Test: `pnpm --filter @smmachine/cli test`
7. Document in `docs/vitepress/features/`

## Adding a new provider

1. Create client class in `packages/core/src/providers/<provider>/`
2. Create fetch repository class implementing the fetch interface
3. Add configuration keys to `Configuration` class
4. Wire in a factory (`packages/core/src/aggregates/`)
5. Create CLI commands for fetch and analysis
6. Add REST endpoints if needed

## Adding a new metric calculation

1. Define types in `packages/core/src/domain/<area>/<area>-types.ts`
2. Add service methods in `packages/core/src/domain/<area>/<area>-service.ts`
3. Add CLI command to call the service
4. Add REST endpoint if the dashboard needs it
5. Write tests in `__tests__/`
6. Document in `docs/vitepress/features/`

## Conversation Starters

**Feature development:**
- "How do I add a new CLI command?"
- "Explain the PR metrics calculation"
- "How do providers work?"
- "Help me debug a failing GitHub fetch"
- "How should I structure this new metric?"
- "What's the build order for packages?"
- "Run the mandatory build verification"
- "How do I add a new REST endpoint?"

**Maintenance:**
- "Update all dependencies to latest compatible versions"
- "Audit dependencies for vulnerabilities"
- "Bump Node.js/pnpm versions across the repo"
- "Check if the npm publish package includes all required files"
- "Review dependency-cruiser rules for violations"
- "Verify CI workflows are consistent with package.json scripts"
- "Clean install and verify everything builds from scratch"
- "Check SQLite migration health"
- "Review stale ADRs and clean up docs/architecture"

**Skills (delegates to specialized workflows):**
- "Write tests for this service" → delegates to TDD skill
- "Fix lint errors" or "Run typecheck" → delegates to Lint skill
- "Add acceptance test for the new CLI command" → delegates to CLI Acceptance Tests skill
- "Update the dashboard docs page" → delegates to Update VitePress Docs skill

## Agent Capabilities

✅ Code navigation and explanation
✅ Feature implementation guidance
✅ Provider development
✅ Metrics calculation assistance
✅ Bug diagnosis
✅ Testing guidance (Vitest + Jest) — delegates to TDD skill
✅ Configuration troubleshooting
✅ Documentation updates — delegates to Update VitePress Docs skill
✅ Module architecture management
✅ Build pipeline verification
✅ Dependency management and audits
✅ CI/CD workflow maintenance
✅ Docker configuration maintenance
✅ SQLite migration management
✅ Coverage pipeline oversight
✅ Repository hygiene (stale docs, catalog sync, npm publish prep)
