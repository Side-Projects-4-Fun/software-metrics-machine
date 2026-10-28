# Software Metrics Machine

A data-driven approach to software measurement for high-performing teams.

Software Metrics Machine (SMM) collects data from your Git provider, CI/CD pipelines, Jira, and SonarQube, stores it
locally, and turns it into metrics you can explore from the CLI, a REST API, or the dashboard.

## What you can measure

- **Change requests** — volume, review times, merge patterns, comments
- **Pipelines** — success rate, execution time, DORA deployment frequency
- **Source code** — churn, coupling, entity ownership, pairing index
- **Issues** — Jira issue metrics
- **Quality** — SonarQube measures
- **Engineering Health** — aggregated view across delivery, collaboration, quality, and architecture

## Repository at a glance

SMM is a pnpm TypeScript monorepo:

- `apps/cli` — `smm` command line (the only write-capable app)
- `apps/rest` — NestJS REST API
- `apps/webapp` — Next.js dashboard
- `apps/mcp` — read-only MCP server for agent clients
- `packages/core` — domain logic, providers, repositories
- `packages/utils` — shared helpers

## Environment requirements

- Node.js 26+ (see `.nvmrc` for the exact version)
- Java, only if you plan to run source-code analysis with Code Maat

## Get started

- [Getting started](./getting-started.md) — install SMM and run a first analysis
- [Your first analysis with GitHub](./your-first-analysis-with-github.md) — end-to-end walkthrough
- [Configuration](./features/configuration.md) — every configuration key
- [Supported providers](./supported-providers.md) — GitHub, GitLab, Jira, SonarQube, Code Maat

Contributor workflows, repository structure details, and build commands live in `CONTRIBUTING.md` at the repository
root.
