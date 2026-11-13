---
outline: deep
---

# REST API

This page documents the active REST API surface in SMM.

> Note: Swagger UI is the authoritative source for the full schema and examples.
> Default path: `http://localhost:<port>/api/docs`.

## Start API

From the workspace root:

```bash
smm dashboard serve
```

The bundled stack starts the REST API on port `3001` and the webapp on port `3000`; override them with
`--rest-port` and `--webapp-port`. For local development, `pnpm --filter @smmachine/rest dev` runs the API on port
`8000`, and running the compiled entrypoint directly uses `PORT` or `3000` when `PORT` is unset.

## Timezone query parameter

Time-based endpoints accept `timezone` as an optional IANA timezone identifier, for example `Europe/Madrid`,
`America/New_York`, or `UTC`.

Use this parameter when sending date-only filters or when consuming grouped metrics from a dashboard or client
application:

```text
GET /change-requests/summary?start_date=2026-01-01&end_date=2026-01-31&timezone=Europe%2FMadrid
```

REST requests use the `timezone` query parameter first. If it is missing or invalid, SMM falls back to the active
project's configured `timezone`, then to `UTC`.

Date-only values such as `2026-01-01` are interpreted as calendar dates in the selected timezone. Offset-aware date-time
values such as `2026-01-01T09:00:00+01:00` are treated as exact instants.

## Change requests

- `GET /change-requests/summary`
- `GET /change-requests/through-time`
- `GET /change-requests/by-author`
- `GET /change-requests/review-time`
- `GET /change-requests/open-time`
- `GET /change-requests/comments`
- `GET /change-requests/comments-by-author`
- `GET /change-requests/first-comment-time`
- `GET /change-requests/filter-options`
- `GET /change-requests/evaluate`

Common query params:

- `start_date`, `end_date`
- `timezone`
- `authors`, `exclude_authors`, `exclude_commenters`, `labels`
- `status`
- `aggregate_by`

## Pipelines

- `GET /pipelines/summary`
- `GET /pipelines/by-status`
- `GET /pipelines/jobs-by-status`
- `GET /pipelines/jobs-summary`
- `GET /pipelines/runs-duration`
- `GET /pipelines/jobs-duration-by-workflow`
- `GET /pipelines/dashboard`
- `GET /dora/deployment-frequency`
- `GET /pipelines/runs-by`
- `GET /pipelines/jobs-time-execution`
- `GET /pipelines/jobs-time-execution-by-day`
- `GET /pipelines/jobs-reruns-by-day`
- `GET /pipelines/jobs-steps-time`
- `GET /pipelines/jobs-steps-time-by-day`
- `GET /pipelines/filter-options`
- `GET /pipelines/workflows`
- `GET /pipelines/statuses`
- `GET /pipelines/conclusions`
- `GET /pipelines/branches`
- `GET /pipelines/events`
- `GET /pipelines/jobs`
- `GET /pipelines/evaluate`

Common query params:

- `start_date`, `end_date`
- `timezone`
- `workflow_path`
- `status`, `conclusion`
- `job_name`, `branch`, `event`
- `aggregate_by`, `top`

## Source Code

- `GET /code/pairing-index`
- `GET /code/code-churn`
- `GET /code/code-churn/history`
- `GET /code/coupling`
- `GET /code/coupling/history`
- `GET /code/layered-coupling`
- `GET /code/layered-coupling/history`
- `GET /code/entity-churn`
- `GET /code/entity-churn/history`
- `GET /code/entity-effort`
- `GET /code/entity-effort/history`
- `GET /code/entity-ownership`
- `GET /code/entity-ownership/history`
- `GET /code/authors`
- `GET /code/big-o`
- `GET /code/big-o/file`
- `GET /code/evaluate`

Common query params:

- `start_date`, `end_date`
- `timezone`
- `authors`
- `ignore_files`, `include_only`
- `top`
- `type_churn`

## Issue tracking

- `GET /api/metrics/issues`

Common query params:

- `status`
- `startDate`, `endDate`

## SonarQube

- `GET /sonarqube/quality`
- `GET /sonarqube/component-tree`
- `GET /sonarqube/measurements`
- `GET /sonarqube/measurements/history`
- `GET /sonarqube/component-tree/history`
- `GET /sonarqube/evaluate`

Common query params:

- `measures`
- `component`, `depth`, `metrics`
- `ignore_files`, `include_files`, `remove_folders`

## Architecture

- `GET /architecture/snapshots`
- `GET /architecture/summary`
- `GET /architecture/view`
- `GET /architecture/evaluate`

The architecture endpoints read the snapshots persisted by `smm architecture generate`; they never generate data.

## Engineering health

- `GET /engineering-health/evaluate`

Accepts the same filters as `smm engineering-health evaluate` (metric, category, current and comparison windows,
period, weekend and outlier handling).

## Metric catalog

- `GET /metrics`

Returns the static metric catalog with ids, namespaces, computation metadata and surface mappings. Supports the same
`namespace` and `visibility` query parameters as `smm metrics list`.

## Filters

- `GET /filters`
- `PUT /filters`

`GET /filters` returns the saved filters and reports for the active project (or, when no `project` query parameter
is given, aggregates saved views from every configured project).

`PUT /filters` replaces the saved filters and reports for the active project with the request body. It is the write
path used by the dashboard's "save filter" and reports features; the body matches the `SavedFiltersDocument` shape
(`{ "version": 1, "filters": [...], "reports": [...] }`).

## Projects and version

- `GET /projects`
- `GET /version`

`GET /projects` lists the configured projects; `GET /version` returns the running application version.

## Legacy aggregate metrics

The original aggregate endpoints remain available under `/api/metrics/*`:

- `GET /api/metrics/issues`
- `GET /api/metrics/change-requests`
- `GET /api/metrics/deployment`
- `GET /api/metrics/code`
- `GET /api/metrics/quality`
- `GET /api/metrics/report`

Prefer the domain endpoints above for new integrations; the aggregate endpoints return pre-computed report shapes.

## Logging

The REST API has two logging layers:

### Domain service logging

The core business logic (Jira, SonarQube, change requests, pipelines, etc.) always respects the project's configured `log_level`,
`<REPO>_LOGGING_LEVEL` env var, or falls back to `CRITICAL`. These logs use the standard SMM log format
(`[timestamp] [LEVEL] [serviceName] message`) and can optionally write to the log file if `store_logs` is enabled.

### HTTP-level logging

Request logging (middleware), controller debug/error messages, exception filters, and the startup banner use
`SmmNestLogger` — a NestJS `LoggerService` wrapper around the SMM logger. Its level is controlled by the `DEBUG`
environment variable only:

- `DEBUG=true` — all messages visible (equivalent to INFO level)
- No `DEBUG` — only fatal logs appear (CRITICAL level)

To see HTTP request logs in development:

```bash
DEBUG=true smm dashboard serve
```

Or with the binary directly:

```bash
DEBUG=true PORT=8000 node apps/rest/dist/main.js
```

```{tip}
HTTP-level logging does not currently read per-project `log_level` from `smm_config.json`. Domain service logs
always respect it. If you need HTTP logs, use `DEBUG=true`.
```

## Configuration

- `GET /configuration`

Returns active runtime configuration values used by dashboard and API integrations.
