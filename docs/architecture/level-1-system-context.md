# Level 1 — System context

The system context is the "one diagram for the whole product" view. It answers three questions before any code is
read:

1. Who uses SMM?
2. What is SMM responsible for?
3. Which external systems does it depend on?

```mermaid
C4Context
  title Level 1 — Software Metrics Machine system context

  Person(developer, "Developer / platform engineer", "Runs smm commands to fetch provider data, generate snapshots and compute metrics")
  Person(teamMember, "Team member", "Reads metrics, reports and dashboards in the browser")
  Person(agentClient, "AI agent client", "Consumes metrics, resources and prompts over MCP")

  System(smm, "Software Metrics Machine", "Fetches software metrics from external providers, caches them locally and computes change-request, pipeline, code, issue and quality metrics")

  System_Ext(gitHost, "Git hosting and CI/CD", "GitHub and GitLab: pull requests, reviews, workflows and jobs")
  System_Ext(issueTracker, "Issue tracker", "Jira: issues, status transitions and delivery data")
  System_Ext(qualityPlatform, "Code quality platform", "SonarQube: measures and component tree")
  System_Ext(gitClone, "Local git clone", "Commit history, file churn and authorship analysed with git and Code Maat")
  System_Ext(dataStore, "SMM data folder", "SMM_STORE_DATA_AT: one folder per project holding smm_config.json, cached payloads, snapshots and smm.sqlite")

  Rel(developer, smm, "Fetches data, generates snapshots, runs analyses", "CLI")
  Rel(teamMember, smm, "Explores dashboards and reports", "Browser")
  Rel(agentClient, smm, "Requests metrics through tools and resources", "stdio / MCP")

  Rel(smm, gitHost, "Fetches pull requests, pipelines and commits", "HTTPS REST")
  Rel(smm, issueTracker, "Fetches issues", "HTTPS REST")
  Rel(smm, qualityPlatform, "Fetches quality measures", "HTTPS REST")
  Rel(smm, gitClone, "Reads commit history and churn", "git / filesystem")
  Rel(smm, dataStore, "Caches provider payloads and reads metrics", "JSON / SQLite")

  UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

## What to notice

- **Three entry points, one product.** The CLI, the dashboard and the MCP server are different front doors to the same
  metric model. A metric is implemented once in `packages/core` and surfaced by every front door.
- **Everything external is a provider.** GitHub, GitLab, Jira, SonarQube, the local git clone and Code Maat are
  interchangeable data sources behind a provider client. Adding a data source never changes the metric definitions.
- **The data folder is part of the contract.** SMM is local-first: fetched payloads and computed metrics are stored
  under `SMM_STORE_DATA_AT`, so dashboards and agent clients can read results without calling third-party APIs again.
- **Only one component writes.** Write access to the data folder is reserved for the CLI. The REST API, webapp and MCP
  server only read what was already fetched or generated. The rule is documented under "Data mutability boundary" in
  `AGENTS.md` and `CONTRIBUTING.md`.

Next: [Level 2 — Containers](./level-2-containers.md).
