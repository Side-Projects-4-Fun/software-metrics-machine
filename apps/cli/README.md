# @smmachine/cli

Command-line interface for Software Metrics Machine.

## Installation

```bash
npm install -g @smmachine/launcher
```

## Quick start

```bash
# 1. Create a data directory
mkdir -p ~/.smm-data

# 2. Create config
cat > ~/.smm-data/smm_config.json <<EOF
{
  "projects": [{
    "git_provider": "github",
    "github_token": "ghp_...",
    "github_repository": "owner/repo",
    "git_repository_location": "/path/to/local/clone",
    "main_branch": "main"
  }]
}
EOF

# 3. Export the data dir and check config is valid
export SMM_STORE_DATA_AT=~/.smm-data
smm health-check

# 4. Fetch data and start the dashboard
smm prs fetch --start-date 2025-01-01 --end-date 2025-06-01
smm pipelines fetch --start-date 2025-01-01 --end-date 2025-06-01 --by-day
smm dashboard serve
```

## Configuration

`SMM_STORE_DATA_AT` (required) — path to the directory where `smm_config.json` lives and where all fetched data is stored.

### `smm_config.json` schema

```json
{
  "projects": [
    {
      "git_provider": "github",
      "github_token": "ghp_...",
      "github_repository": "owner/repo",
      "git_repository_location": "/absolute/path/to/local/clone",
      "main_branch": "main",
      "dashboard_start_date": "2025-01-01",
      "dashboard_end_date": "2025-12-31",
      "dashboard_color": "#1976d2",
      "deployment_frequency_targets": [
        { "pipeline": ".github/workflows/ci.yml", "job": "deploy" }
      ],
      "log_level": "INFO",
      "store_logs": true,
      "timezone": "Europe/Madrid",
      "jira_url": "https://xxx.atlassian.net",
      "jira_email": "user@example.com",
      "jira_token": "...",
      "jira_project": "KAN",
      "sonar_url": "https://sonarcloud.io",
      "sonar_token": "...",
      "sonar_project": "...",
      "sonar_local_runner_token": "..."
    }
  ]
}
```

Multiple projects are supported. Select the active one with `smm --project owner/repo <command>`.
If `--project` is omitted, SMM uses the first project in the `projects` array before resolving project-specific
environment variables.

Project configuration can be provided through project-specific environment variables instead of `smm_config.json`.
Uppercase the `github_repository` value and replace non-alphanumeric
characters with `_`, then append the setting environment variable name:

```bash
export BLA_123_GITHUB_TOKEN=xxx   # used for github_repository "bla/123"
export BLA_123_JIRA_TOKEN=xxx     # used for github_repository "bla/123"
export BLA_123_SMM_TIMEZONE=UTC   # used for github_repository "bla/123"
```

`SMM_STORE_DATA_AT` is the only global configuration environment variable. Generic variables such as
`GITHUB_TOKEN`, `JIRA_TOKEN`, `SONAR_TOKEN`, `SMM_TIMEZONE`, and `GIT_REPOSITORY_PATH` are not used.

## Global options

```
-V, --version           output the version number
--debug                 enable debug logging
--project <name>        select active project by github_repository value
-h, --help              display help
```

## Logging

SMM writes logs from the CLI to the console (stderr for warnings/errors, stdout for info/debug). Logging can also be written
to a file inside the project data directory.

### Level resolution

The log level is resolved in this order (highest precedence first):

1. `--debug` flag or `DEBUG` environment variable — forces `DEBUG` level
2. `<REPO>_LOGGING_LEVEL` environment variable — project-specific override (e.g. `OWNER_REPO_LOGGING_LEVEL=INFO`)
3. `log_level` in `smm_config.json` — per-project setting
4. `CRITICAL` — built-in default (only fatal errors are shown)

If an invalid value is provided (e.g. `log_level: "TRACE"`), it falls back to `CRITICAL` with a warning.

```bash
# Quick debug
smm --debug pr summary

# Via environment
DEBUG=true smm pr summary

# Per-project config
export OWNER_REPO_LOGGING_LEVEL=INFO
smm --project owner/repo pr summary
```

### File logging

Set `store_logs: true` in `smm_config.json` or `<REPO>_STORE_LOGS=true` to write logs to
`<storeData>/<provider>_<owner_repo>/smm.log`. File output uses the same format and level filtering as console output.

### Valid levels

| Level | Console output | Use case |
|-------|---------------|----------|
| `DEBUG` | All messages | Development / troubleshooting |
| `INFO` | Info, warnings, errors | General usage |
| `WARN` | Warnings and errors | Production (moderate verbosity) |
| `ERROR` | Errors only | Production |
| `CRITICAL` | Fatal errors only | Silent operation (default) |

## Outliers and weekend filtering

Some average-based PR and pipeline commands support data cleaning options before computing the final average.

```
--weekends <mode>       include|exclude|weekends_only  (default: include)
--outlier-mode <mode>   include|flag|exclude           (default: include)
```

`--weekends` controls which samples are considered:

- `include`: keep all samples.
- `exclude`: use only weekday samples.
- `weekends_only`: use only Saturday and Sunday samples.

`--outlier-mode` controls how unusually high or low samples are handled:

- `include`: compute averages from all samples and do not report outliers.
- `flag`: compute averages from all samples and report detected outliers.
- `exclude`: remove detected outliers before computing averages and report what was removed.

Outliers are detected with the interquartile range rule: values below `Q1 - 1.5 * IQR` or above `Q3 + 1.5 * IQR` are
marked as outliers. Weekend filtering runs before outlier detection, so outlier bounds are calculated from the selected
weekday/weekend sample set.

These options are available on:

- `smm prs average-review-time`
- `smm prs average-open`
- `smm prs average-comments`
- `smm pipelines summary`
- `smm pipelines runs-duration`
- `smm pipelines jobs-summary`
- `smm pipelines jobs-time-execution`
- `smm pipelines jobs-steps-average-time`
- `smm pipelines jobs-by-status`
- `smm pipelines lead-time`

## Commands

### `smm prs` — Pull request operations

#### `smm prs fetch`
Fetch pull requests from the configured Git provider.

```
--force               force re-fetch even if data already exists
--update              incremental update: fetch only newer items and merge with cache
--start-date <date>   PRs created on or after this date (ISO 8601)
--end-date <date>     PRs created on or before this date (ISO 8601)
```

#### `smm prs fetch-comments`
Fetch pull request comments.

```
--force               force re-fetch
--update              incremental update
--start-date <date>   filter PRs by creation date on or after (ISO 8601)
--end-date <date>     filter PRs by creation date on or before (ISO 8601)
```

#### `smm prs summary`
View PR summary statistics.

```
--start-date <date>
--end-date <date>
--authors <list>              comma-separated authors to include
--exclude-authors <list>      comma-separated authors to exclude
--exclude-commenters <list>   comma-separated commenters to exclude
--labels <list>               comma-separated labels to filter by
--raw-filters <filters>       raw filter string (e.g. status=draft,author=john)
--output <format>             text|json  (default: text)
```

#### `smm prs by-month`
View PR metrics grouped by month.

```
--start-date <date>
--end-date <date>
--exclude-authors <list>
--exclude-commenters <list>
--output <format>             text|json  (default: text)
```

#### `smm prs by-week`
View PR metrics grouped by week. Same options as `by-month`.

#### `smm prs through-time`
View PRs opened and closed over time (daily/weekly/monthly).

```
--start-date <date>
--end-date <date>
--authors <list>
--exclude-authors <list>
--exclude-commenters <list>
--labels <list>
--aggregate-by <period>       day|week|month  (default: week)
--raw-filters <filters>
--output <format>             text|json  (default: text)
```

#### `smm prs by-author`
View PRs grouped by author.

```
--start-date <date>
--end-date <date>
--authors <list>
--exclude-authors <list>
--exclude-commenters <list>
--labels <list>
--top <number>                show top N authors  (default: 10)
--raw-filters <filters>
--output <format>             text|json  (default: text)
```

#### `smm prs average-review-time`
View average review time (days) by author. Same options as `by-author`, plus the outlier and weekend filtering options.

#### `smm prs average-open`
View average PR open time (days) aggregated by period.

```
--start-date <date>
--end-date <date>
--authors <list>
--exclude-authors <list>
--exclude-commenters <list>
--labels <list>
--aggregate-by <period>       day|week|month  (default: week)
--raw-filters <filters>
--output <format>             text|json  (default: text)
--weekends <mode>             include|exclude|weekends_only  (default: include)
--outlier-mode <mode>         include|flag|exclude  (default: include)
```

#### `smm prs average-comments`
View average number of comments per PR. Same options as `average-open`.

---

### `smm pipelines` — Pipeline/workflow operations

#### `smm pipelines fetch`
Fetch pipeline runs from the configured Git provider.

```
--force               force re-fetch
--update              incremental update
--start-date <date>   runs created on or after (ISO 8601)
--end-date <date>     runs created on or before (ISO 8601)
--raw-filters <f>     raw filters (e.g. status=success,branch=main)
--by-day              fetch day by day instead of all at once (recommended for large datasets)
```

#### `smm pipelines fetch-jobs`
Fetch pipeline jobs.

```
--force
--update
--run-start-date <date>   filter by pipeline creation date on or after
--run-end-date <date>     filter by pipeline creation date on or before
--raw-filters <f>
--by-day
```

#### `smm pipelines summary`
Display a summary of pipeline runs.

```
--max-workflows <n>   maximum number of workflows to list  (default: 10)
--start-date <date>
--end-date <date>
--raw-filters <f>
--output <format>     text|json  (default: text)
--weekends <mode>     include|exclude|weekends_only  (default: include)
--outlier-mode <mode> include|flag|exclude  (default: include)
```

#### `smm pipelines by-status`
View pipeline runs grouped by status.

```
--start-date <date>
--end-date <date>
--output <format>     text|json  (default: text)
```

#### `smm pipelines runs-duration`
View pipeline run durations.

```
--start-date <date>
--end-date <date>
--workflow <name>     filter by workflow name
--output <format>     text|json  (default: text)
--weekends <mode>     include|exclude|weekends_only  (default: include)
--outlier-mode <mode> include|flag|exclude  (default: include)
```

#### `smm pipelines runs-by`
View pipeline runs by time period.

```
--start-date <date>
--end-date <date>
--period <period>     day|week|month  (default: week)
--output <format>     text|json  (default: text)
```

#### `smm pipelines jobs-summary`
Display a summary of pipeline jobs.

```
--max-jobs <n>        maximum number of jobs to list  (default: 20)
--start-date <date>
--end-date <date>
--output <format>     text|json  (default: text)
--weekends <mode>     include|exclude|weekends_only  (default: include)
--outlier-mode <mode> include|flag|exclude  (default: include)
```

#### `smm pipelines jobs-time-execution`
View pipeline job execution times.

```
--start-date <date>
--end-date <date>
--job <name>          filter by job name
--output <format>     text|json  (default: text)
--weekends <mode>     include|exclude|weekends_only  (default: include)
--outlier-mode <mode> include|flag|exclude  (default: include)
```

#### `smm pipelines jobs-steps-average-time`
View pipeline job steps average execution times.

```
--start-date <date>
--end-date <date>
--job <name>
--output <format>     text|json  (default: text)
--weekends <mode>     include|exclude|weekends_only  (default: include)
--outlier-mode <mode> include|flag|exclude  (default: include)
```

#### `smm pipelines jobs-by-status`
View pipeline jobs grouped by status.

```
--start-date <date>
--end-date <date>
--output <format>     text|json  (default: text)
--weekends <mode>     include|exclude|weekends_only  (default: include)
--outlier-mode <mode> include|flag|exclude  (default: include)
```

#### `smm pipelines deployment-frequency`
Calculate deployment frequency (DORA metric).

```
--start-date <date>
--end-date <date>
--period <period>     day|week|month  (default: week)
--output <format>     text|json  (default: text)
```

#### `smm pipelines lead-time`
Calculate lead time for changes (DORA metric).

```
--start-date <date>
--end-date <date>
--output <format>     text|json  (default: text)
--weekends <mode>     include|exclude|weekends_only  (default: include)
--outlier-mode <mode> include|flag|exclude  (default: include)
```

---

### `smm code` — Code analysis operations

> Code analysis requires a local git clone of the repository (`git_repository_location` in config).
> `smm code codemaat-fetch` additionally requires **Java** to be installed.

#### `smm code fetch-commits`
Analyze change sets from the git repository. Run this before `codemaat-fetch`.

```
--start-date <date>
--end-date <date>
--authors <list>      comma-separated authors to filter
--force               bypass cache and re-read from git
--buffer <size>       max buffer in MB for git output  (default: 100)
--output <format>     text|json  (default: text)
```

#### `smm code codemaat-fetch`
Run CodeMaat analysis and produce CSV output. Requires `fetch-commits` to have run first. Requires Java.

```
--start-date <date>   required
--end-date <date>
--subfolder <path>    subfolder within the repo to analyze  (default: repo root)
--group-depth <n>     optional directory depth for auto-generated architectural grouping  (default: 2)
--force               regenerate CSV files even if they exist
--output <format>     text|json  (default: text)
```

#### `smm code summary`
View code summary with pairing insights.

```
--start-date <date>
--end-date <date>
--output <format>     text|json|csv  (default: text)
```

#### `smm code churn`
Calculate code churn metrics.

```
--start-date <date>
--end-date <date>
--authors <list>
--output <format>     text|json|csv  (default: text)
```

#### `smm code coupling`
Analyze code coupling between modules.

```
--start-date <date>
--end-date <date>
--min-coupling <n>    minimum coupling threshold  (default: 0.3)
--output <format>     text|json|csv  (default: text)
```

#### `smm code entity-churn`
Calculate entity-level churn metrics.

```
--start-date <date>
--end-date <date>
--top <n>             show top N entities  (default: 20)
--output <format>     text|json|csv  (default: text)
```

#### `smm code entity-effort`
Calculate entity effort metrics. Same options as `entity-churn`.

#### `smm code entity-ownership`
Analyze entity ownership by developer.

```
--start-date <date>
--end-date <date>
--entity <path>       specific file/entity to analyze
--output <format>     text|json|csv  (default: text)
```

#### `smm code pairing-index`
Calculate developer pairing index.

```
--start-date <date>
--end-date <date>
--min-shared <n>      minimum shared commits  (default: 2)
--output <format>     text|json|csv  (default: text)
```

---

### `smm jira` — Jira integration operations

#### `smm jira fetch-issues`
Fetch issues from Jira.

```
--force
--update              incremental update
--start-date <date>
--end-date <date>
--status <status>     filter by issue status
--output <format>     text|json  (default: text)
```

#### `smm jira fetch-changelog`
Fetch issue changelog. Note: limited support in the current version.

```
--issue <key>         specific issue key
--output <format>     text|json  (default: text)
```

#### `smm jira fetch-comments`
Fetch issue comments. Note: limited support in the current version.

```
--issue <key>
--output <format>     text|json  (default: text)
```

---

### `smm sonarqube` — SonarQube integration operations

#### `smm sonarqube analysis run`
Start a local SonarQube instance (if needed) and run sonar-scanner via Docker.

```
--container-server-name <name>     (default: sonarqube)
--scanner-container-name <name>    (default: sonarqube-scanner)
--container-server-image <image>   (default: sonarqube:community)
--scanner-image <image>            (default: sonarsource/sonar-scanner-cli)
--data-dir <path>                  host path mounted to /opt/sonarqube/data  (default: ./sonarqube_data)
--server-port <port>               host port mapped to SonarQube 9000  (default: 9000)
--scanner-host-url <url>           SONAR_HOST_URL passed to scanner
--scanner-token <token>            SONAR_TOKEN passed to scanner
--properties <value>               raw SONAR_SCANNER_OPTS value
--admin-user <user>                (default: admin)
--admin-password <password>        (default: admin)
```

#### `smm sonarqube fetch-measures`
Fetch quality measures from SonarQube.

```
--metrics <list>      comma-separated metrics  (default: coverage,sqale_rating,complexity,duplicated_lines_density)
--local               use sonar_local_runner_token instead of sonar_token
--output <format>     text|json  (default: text)
```

#### `smm sonarqube fetch-component-tree`
Fetch component tree with metrics.

```
--component <key>     component key  (default: configured sonar_project)
--depth <n>           tree depth, -1 for all  (default: -1)
--metrics <list>      (default: complexity,cognitive_complexity,ncloc,sqale_rating,coverage)
--local
--output <format>     text|json  (default: text)
```

#### `smm sonarqube fetch-historical-measures`
Fetch historical measures from SonarQube.

```
--metrics <list>      (default: sqale_rating,coverage,duplicated_lines_density)
--start-date <date>
--end-date <date>
--update              incremental update since last sync
--save <file>         save results to a JSON file at the given path
--local
--output <format>     text|json  (default: text)
```

---

### `smm engineering-health` — Cross-metric progress over time

Use this command to compare delivery, quality, collaboration, and architecture signals across two windows.
It is useful for tech leaders tracking whether engineering practices are improving sprint over sprint,
month by month, and quarter by quarter.

#### `smm engineering-health evaluate`

```
--metric <ids>                comma-separated metric ids (optional)
--category <name>             delivery|quality|collaboration|architecture (optional)
--start-date <date>           current window start date (YYYY-MM-DD)
--end-date <date>             current window end date (YYYY-MM-DD)
--compare-start-date <date>   previous window start date (YYYY-MM-DD)
--compare-end-date <date>     previous window end date (YYYY-MM-DD)
--period <period>             day|week|month  (default: week)
--weekends <mode>             include|exclude|weekends_only  (default: include)
--outlier-mode <mode>         include|flag|exclude  (default: include)
--output <format>             text|json  (default: text)
```

Examples for leadership reviews:

```bash
# Sprint over sprint (2 weeks vs previous 2 weeks)
smm engineering-health evaluate \
  --category delivery \
  --start-date 2026-07-01 --end-date 2026-07-14 \
  --compare-start-date 2026-06-17 --compare-end-date 2026-06-30 \
  --period week

# Month by month (current month vs previous month)
smm engineering-health evaluate \
  --metric coverage,duplication,complexity,review-time,pair-programming \
  --start-date 2026-07-01 --end-date 2026-07-31 \
  --compare-start-date 2026-06-01 --compare-end-date 2026-06-30 \
  --period month \
  --weekends exclude \
  --outlier-mode flag

# Quarter by quarter (Q3 vs Q2)
smm engineering-health evaluate \
  --category collaboration \
  --start-date 2026-07-01 --end-date 2026-09-30 \
  --compare-start-date 2026-04-01 --compare-end-date 2026-06-30 \
  --period month \
  --output json
```

Tip: use `--output json` in leadership reviews to store results and build a recurring trend report pipeline.

---

### `smm dashboard` — Dashboard operations

#### `smm dashboard serve`
Start the bundled REST API and webapp servers.

```
--webapp-port <port>   (default: 3000)
--rest-port <port>     (default: 3001)
--host <host>          (default: 0.0.0.0)
```

Requires a full build (`pnpm run build:npm` from the repo root) before first run.

---

### `smm tools` — Utility tools

#### `smm tools json-merge`
Merge multiple JSON files into one.

```
--input <pattern>     glob pattern for input files  (default: *.json)
--output <file>       output file path  (default: merged.json)
--pretty              pretty-print the output JSON
```

### `smm health-check`
Analyze local cache data quality (missing, stale, invalid, coverage gaps).

```
--provider <name>      all|github|jira|sonarqube  (default: all)
--max-gap-days <days>  only report gaps larger than N days  (default: 1)
--output <format>      text|json  (default: text)
```

---

## Development

Requires **Node.js ≥ 25.2.1** and **pnpm ≥ 10.0.0**.

```bash
# Install dependencies from repo root
pnpm install

# Run CLI in dev mode (no build step needed)
# Use an absolute path — the dev script changes into apps/cli/ before running
SMM_STORE_DATA_AT=$(pwd)/.data pnpm run cli

# Run tests
pnpm --filter @smmachine/cli test
```
