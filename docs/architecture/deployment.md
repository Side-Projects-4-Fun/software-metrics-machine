# Deployment

Two deployment shapes matter day to day: the **published CLI** (what users install) and the **local development
stack** (`pnpm dev` or `docker compose`).

## Published CLI

```mermaid
C4Deployment
  title Deployment — published smm CLI on a developer workstation

  Deployment_Node(workstation, "Developer workstation", "macOS, Linux or Windows with Node.js") {
    Container(cli, "smm CLI", "Node.js, bundled dist/index.cjs", "Runs fetch, analysis, report and dashboard commands")
    Container(mcpServer, "MCP server process", "Node.js, stdio", "Started by smm mcp server start for local agent clients")
    ContainerDb(store, "SMM data folder", "JSON and smm.sqlite", "Resolved from SMM_STORE_DATA_AT")
    ContainerDb(gitClone, "Project git clone", "Filesystem", "Read for commit history and churn")
  }

  System_Ext(providerApis, "Provider APIs", "GitHub, GitLab, Jira, SonarQube")
  Person(browser, "Team member", "Browser")

  Rel(cli, store, "Writes caches and snapshots", "filesystem / SQLite")
  Rel(cli, gitClone, "Reads git history", "git")
  Rel(cli, providerApis, "Fetches provider data", "HTTPS REST")
  Rel(cli, mcpServer, "Spawns", "child process")
  Rel(mcpServer, store, "Reads persisted metrics", "read-only")
  Rel(browser, cli, "Opens the dashboard served by smm dashboard serve", "HTTPS")
```

`smm dashboard serve` starts two child processes from the published bundle: the REST API on port `3001` and the
Next.js server on port `3000`. The webapp receives `SMM_REST_BASE_URL=http://<host>:3001`, so no extra configuration is
needed.

## Local development stack

```mermaid
C4Deployment
  title Deployment — local development stack

  Deployment_Node(host, "Developer machine", "pnpm + Docker") {
    Deployment_Node(pnpm, "pnpm dev", "Node.js processes") {
      Container(restDev, "REST API", "ts-node, port 8000", "Serves metrics and configuration from the project data folder")
      Container(webappDev, "Webapp", "next dev, port 3000", "Reads SMM_REST_BASE_URL http://localhost:8000")
    }

    Deployment_Node(compose, "docker compose", "Containers") {
      Container(apiContainer, "api", "node:25-slim, port 8000", "Runs pnpm --filter @smmachine/rest dev with SMM_STORE_DATA_AT=/workspace/.data")
      Container(webappContainer, "webapp", "node:25-slim, port 3000", "Runs pnpm --filter @smmachine/webapp dev")
      Container(sonarqube, "sonarqube", "sonarqube:10-community, port 9000", "Local code quality server used by the sonarqube commands")
    }

    ContainerDb(store, "SMM data folder", "JSON and smm.sqlite", "Shared by CLI and REST API")
  }

  Person(teamMember, "Developer", "Browser and shell")

  Rel(teamMember, webappDev, "Opens http://localhost:3000", "HTTPS")
  Rel(webappDev, restDev, "Reads metrics", "HTTP/JSON")
  Rel(restDev, store, "Reads persisted metrics", "read-only")
  Rel(teamMember, webappContainer, "Opens http://localhost:3000", "HTTPS")
  Rel(webappContainer, apiContainer, "Reads metrics", "HTTP/JSON")
  Rel(apiContainer, store, "Reads persisted metrics", "read-only")
  Rel(sonarqube, store, "Reports analysed measures to", "HTTPS API")
```

Both stacks are read-only: they serve whatever the CLI persisted under `SMM_STORE_DATA_AT`. For a full local run,
execute the CLI commands first (`smm project configure`, `smm change-requests fetch`, `smm pipelines fetch`,
`smm architecture generate`), then start the stack.

Back to the architecture index: see `README.md` in this folder.
