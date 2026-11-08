# @smmachine/rest

NestJS REST API for Software Metrics Machine. Serves all metrics over HTTP and is consumed by the webapp dashboard.

## Data mutability boundary

The REST API is strictly read-only.

- It must serve data that was previously generated and persisted by CLI commands.
- It must not generate analysis artifacts, write files, or persist snapshots.
- Any feature that needs data generation (including architecture models) must run in CLI first.

## Supported data sources

- **GitHub**: change requests, pipeline runs, CI/CD jobs
- **Jira**: issues, comments
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

The REST API does not use per-variable env vars for credentials. It reads everything from `smm_config.json` in the
resolved data directory. The data directory comes from `SMM_STORE_DATA_AT`, or from the `store_data_at` value saved in
the user settings file (`$XDG_CONFIG_HOME/smm/config.json`, falling back to `~/.config/smm/config.json`) when the env
var is unset. The environment variable always wins over the saved default.

| Variable | Required | Description |
|---|---|---|
| `SMM_STORE_DATA_AT` | no | Path to the data directory containing `smm_config.json` (optional when a default is saved via `smm project configure`) |
| `PORT` | no | Port to listen on (default: 8000) |
| `NODE_ENV` | no | `development` or `production` |

See [apps/cli/README.md](../cli/README.md) for the full `smm_config.json` schema.

## API documentation

- **Swagger UI**: http://localhost:8000/api/docs
- **OpenAPI JSON**: http://localhost:8000/api-json

## Endpoints

The authoritative endpoint list lives in the [REST API documentation](../../docs/vitepress/rest-api.md) and in the
Swagger UI at http://localhost:8000/api/docs (OpenAPI JSON at `/api-json`).

Routes are grouped by feature (`/change-requests`, `/pipelines`, `/code`, `/sonarqube`, `/architecture`, `/filters`,
`/projects`, `/metrics`). The legacy aggregate endpoints remain available under `/api/metrics/*`.

## Error responses

All errors follow a consistent format:

```json
{
  "statusCode": 400,
  "message": "Invalid date format. Expected YYYY-MM-DD",
  "error": "BadRequest",
  "timestamp": "2024-03-29T15:30:45.123Z",
  "path": "/change-requests/summary"
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
