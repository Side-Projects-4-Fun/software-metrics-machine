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

Default port is `3000` unless `PORT` is set.

## Timezone query parameter

Time-based endpoints accept `timezone` as an optional IANA timezone identifier, for example `Europe/Madrid`,
`America/New_York`, or `UTC`.

Use this parameter when sending date-only filters or when consuming grouped metrics from a dashboard or client
application:

```text
GET /pull-requests/summary?start_date=2026-01-01&end_date=2026-01-31&timezone=Europe%2FMadrid
```

REST requests use the `timezone` query parameter first. If it is missing or invalid, SMM falls back to the active
project's configured `timezone`, then to `UTC`.

Date-only values such as `2026-01-01` are interpreted as calendar dates in the selected timezone. Offset-aware date-time
values such as `2026-01-01T09:00:00+01:00` are treated as exact instants.

## Pull Requests

- `GET /pull-requests/summary`
- `GET /pull-requests/through-time`
- `GET /pull-requests/by-author`
- `GET /pull-requests/average-review-time`
- `GET /pull-requests/average-open-by`
- `GET /pull-requests/average-comments`
- `GET /pull-requests/comments-by-author`
- `GET /pull-requests/first-comment-time`
- `GET /pull-requests/filter-options`

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
- `GET /pipelines/runs-duration`
- `GET /pipelines/jobs-duration-by-workflow`
- `GET /dora/deployment-frequency`
- `GET /pipelines/runs-by`
- `GET /pipelines/jobs-average-time`
- `GET /pipelines/jobs-average-time-by-day`
- `GET /pipelines/jobs-reruns-by-day`
- `GET /pipelines/jobs-steps-average-time`
- `GET /pipelines/jobs-steps-average-time-by-day`
- `GET /pipelines/filter-options`
- `GET /pipelines/jobs`

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
- `GET /code/coupling`
- `GET /code/entity-churn`
- `GET /code/entity-effort`
- `GET /code/entity-ownership`
- `GET /code/authors`
- `GET /code/big-o`
- `GET /code/big-o/file`

Common query params:

- `start_date`, `end_date`
- `timezone`
- `authors`
- `ignore_files`, `include_only`
- `top`
- `type_churn`

## Jira

- `GET /jira/issues`

Common query params:

- `status`
- `startDate`, `endDate`

## SonarQube

- `GET /sonarqube/quality`
- `GET /sonarqube/component-tree`
- `GET /sonarqube/measurements`
- `GET /sonarqube/measurements/history`
- `GET /sonarqube/component-tree/history`

Common query params:

- `measures`
- `component`, `depth`, `metrics`
- `ignore_files`, `include_files`, `remove_folders`

## Logging

The REST API has two logging layers:

### Domain service logging

The core business logic (Jira, SonarQube, PRs, pipelines, etc.) always respects the project's configured `log_level`,
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
