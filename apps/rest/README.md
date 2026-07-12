# @smmachine/rest

NestJS REST API for Software Metrics Machine. Serves all metrics over HTTP and is consumed by the webapp dashboard.

## Data mutability boundary

The REST API is strictly read-only.

- It must serve data that was previously generated and persisted by CLI commands.
- It must not generate analysis artifacts, write files, or persist snapshots.
- Any feature that needs data generation (including architecture models) must run in CLI first.

## Supported data sources

- **GitHub**: pull requests, pipeline runs, CI/CD jobs
- **Jira**: issues, changelogs, comments
- **SonarQube**: quality measures, component tree, historical measures
- **Git / CodeMaat**: code churn, coupling, entity effort, pairing index

## Running

### Dev mode (recommended for local development)

```bash
# From the repo root
SMM_STORE_DATA_AT=./.data pnpm --filter @smmachine/rest dev
```

Server starts on `http://localhost:8000` (or `$PORT`).

### Via Docker

```bash
# From the repo root
docker compose up api
```

Uses port `8000` and mounts the current directory. See `docker-compose.yml` for full config.

### Via `smm dashboard serve`

When started through the CLI bundled mode, the REST API runs on port `3001` by default (configurable with `--rest-port`).

## Configuration

The REST API does not use per-variable env vars for credentials. It reads everything from `smm_config.json` located at the path given by `SMM_STORE_DATA_AT`.

| Variable | Required | Description |
|---|---|---|
| `SMM_STORE_DATA_AT` | yes | Path to the data directory containing `smm_config.json` |
| `PORT` | no | Port to listen on (default: 8000) |
| `NODE_ENV` | no | `development` or `production` |

See [apps/cli/README.md](../cli/README.md) for the full `smm_config.json` schema.

## API documentation

- **Swagger UI**: http://localhost:8000/api/docs
- **OpenAPI JSON**: http://localhost:8000/api-json

## Endpoints

### Pull requests
```
GET /pull-requests/summary
GET /pull-requests/through-time
GET /pull-requests/by-author
GET /pull-requests/average-review-time
GET /pull-requests/average-open-by
GET /pull-requests/average-comments
GET /pull-requests/comments-by-author
GET /pull-requests/first-comment-time
GET /pull-requests/filter-options
```

### Pipelines
```
GET /pipelines/summary
GET /pipelines/by-status
GET /pipelines/runs-duration
GET /pipelines/runs-by
GET /pipelines/jobs-summary
GET /pipelines/jobs-by-status
GET /pipelines/jobs-reruns-by-day
GET /pipelines/jobs-average-time
GET /pipelines/jobs-average-time-by-day
GET /pipelines/jobs-steps-average-time
GET /pipelines/jobs-steps-average-time-by-day
GET /dora/deployment-frequency
GET /pipelines/jobs-duration-by-workflow
GET /pipelines/workflows
GET /pipelines/statuses
GET /pipelines/conclusions
GET /pipelines/branches
GET /pipelines/events
GET /pipelines/jobs
GET /pipelines/filter-options
```

### Code
```
GET /code/pairing-index
GET /code/code-churn
GET /code/coupling
GET /code/entity-churn
GET /code/entity-effort
GET /code/entity-ownership
GET /code/authors
```

### SonarQube
```
GET /sonarqube/component-tree
GET /sonarqube/quality
GET /sonarqube/measurements
GET /sonarqube/measurements/history
GET /sonarqube/component-tree/history
```

### Configuration and projects
```
GET /configuration
GET /projects
```

### Metrics aggregates
```
GET /api/metrics/issues
GET /api/metrics/pr
GET /api/metrics/deployment
GET /api/metrics/code
GET /api/metrics/quality
GET /api/metrics/report
```

## Error responses

All errors follow a consistent format:

```json
{
  "statusCode": 400,
  "message": "Invalid date format. Expected YYYY-MM-DD",
  "error": "BadRequest",
  "timestamp": "2024-03-29T15:30:45.123Z",
  "path": "/pull-requests/summary"
}
```

| Status | Meaning |
|---|---|
| 400 | Invalid query parameters or request format |
| 404 | Resource not found |
| 500 | Server error |

## Development

```bash
# Install dependencies from repo root
pnpm install

# Run in dev mode (hot reload)
SMM_STORE_DATA_AT=./.data pnpm --filter @smmachine/rest dev

# Build
pnpm --filter @smmachine/rest build

# Test
pnpm --filter @smmachine/rest test
```
