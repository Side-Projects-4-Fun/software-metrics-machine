# Architecture (contributor documentation)

This folder is the starting point for contributors who need to understand how Software Metrics Machine is built. It is
internal documentation: the pages are written for people changing the code, not for people using the CLI or dashboard,
so they are deliberately **not** published on the VitePress site.

The diagrams follow the [C4 model](https://c4model.com/) and are written in Mermaid. GitHub renders them directly in
the file view, so you can read everything without extra tooling.

If you are new to the codebase, read the levels in order. Each level answers a different question:

| Level | Question it answers | Diagram |
|-------|--------------------|---------|
| 1 — System context | Who uses SMM, and which external systems does it talk to? | [level-1-system-context.md](./level-1-system-context.md) |
| 2 — Containers | Which runnable units and shared libraries exist, and who may write? | [level-2-containers.md](./level-2-containers.md) |
| 3 — Components | What is inside `@smmachine/core` and inside each application? | [level-3-components-core.md](./level-3-components-core.md), [level-3-components-apps.md](./level-3-components-apps.md) |
| Dynamic views | In which order do components call each other for the three main flows? | [dynamic-views.md](./dynamic-views.md) |
| Deployment | How does the published CLI stack differ from local development? | [deployment.md](./deployment.md) |

## Overview

Software Metrics Machine is a pnpm monorepo with four runnable units and two shared libraries:

- **`@smmachine/cli`** — the only write-capable application. It fetches provider data, generates architecture snapshots
  and computes metrics into `SMM_STORE_DATA_AT`.
- **`@smmachine/rest`** — a read-only NestJS API that serves persisted metrics, filters and configuration.
- **`@smmachine/webapp`** — a read-only Next.js dashboard that reads the REST API through `server/api/*.ts`.
- **`@smmachine/mcp`** — a read-only MCP stdio server that projects the same metrics for agent clients.
- **`@smmachine/core`** — domain slices, provider clients, the Engineering Health registry and persistence.
- **`@smmachine/utils`** — logging, JSON, date-time and duration helpers.

The dependency direction is always `utils → core → apps`, and the webapp reaches data only over HTTP. Diagrams never
cross that boundary: if a relationship is not on the diagrams, it is not part of the architecture.

## Reading paths by role

- **First week in the repo** — Level 1, Level 2, then the dynamic CLI flow. That is enough to know where a change goes.
- **Working on metrics** — Level 3 core, specifically the domain slices and the Engineering Health section, then the
  relevant adapter under `packages/core/src/engineering-health/adapters/`.
- **Working on the dashboard** — Level 3 webapp plus the dynamic dashboard flow, then the endpoints in
  `apps/webapp/server/api/`.
- **Working on a provider** — Level 3 core (provider clients and the two repository kinds) and the provider-specific
  page in `docs/vitepress/` (GitHub, GitLab, Jira, SonarQube, Code Maat).
- **Packaging and deployment** — Level 2 and the deployment diagrams, plus `CONTRIBUTING.md` for the publish workflow.

## Ground rules the diagrams encode

1. **Write boundary.** The CLI owns `SMM_STORE_DATA_AT`. The REST API, webapp and MCP server are read-only. This is not
   a convention: review and tests enforce it, and it is why provider fetching is not reachable from the API.
2. **Two kinds of repository.** Fetch repositories in `packages/core/src/providers/` call external APIs and are CLI-only;
   read repositories in `packages/core/src/domain/<area>/repositories/` serve cached data to every front door.
3. **One metric implementation.** Metric math lives in a domain service and is reused by CLI, REST, MCP and Engineering
   Health instead of being reimplemented per surface.
4. **Apps are adapters.** Command groups, controllers, MCP tools and React components translate inputs and outputs; they
   do not own business rules.

## Keeping the diagrams current

Update the diagrams in the same pull request that changes the architecture. A change that adds a package, a container,
a provider or a cross-component dependency is not complete until the relevant diagram and the table above still describe
the truth.

When you edit a diagram:

1. Edit the Markdown file for the affected level — the Mermaid source is the single source of truth.
2. Preview it by opening the file on GitHub, or paste the block into the
   [Mermaid live editor](https://mermaid.live/).
3. Keep element names aligned with workspace package names in the `package.json` files.
4. If the change supersedes an architectural decision, add an addendum to the matching record in `docs/adrs/` instead of
   silently deviating from it.

These pages are linked from the "Codebase Architecture" section of `CONTRIBUTING.md`. Do not add them to the VitePress
sidebar: the documentation site describes product usage, while this folder describes the implementation.

Related reading: `docs/adrs/` for decision records, `CONTRIBUTING.md` for the development workflow, and
`docs/architecture/metrics-catalog.md` for the metric definitions themselves.
