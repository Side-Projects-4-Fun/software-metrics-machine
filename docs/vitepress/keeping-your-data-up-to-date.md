---
outline: deep
---

# Keeping your data up to date

Once you have completed your first analysis, you will want to periodically refresh the data to reflect new commits,
pull requests, pipeline runs, and quality metrics. This page shows how to run a full data update using a reusable
shell script based on the commands from [your first analysis](./your-first-analysis-with-github.md).

## The update script

Copy the script below and save it as `update-data.sh` in your project. The script re-fetches all data sources,
regenerates summaries, and runs quality checks so your dashboard stays current.

```bash
#!/bin/bash

export SMM_STORE_DATA_AT=$1

PROJECT=marabesi/json-tool

start_date=2025-01-10
end_date=2026-06-06

pnpm run build

# code
smm code fetch-commits --start-date=$start_date --end-date=$end_date --project=$PROJECT --force
smm code codemaat-fetch --start-date=$start_date --end-date=$end_date --project=$PROJECT --force
smm architecture generate --start-date=$start_date --end-date=$end_date --project=$PROJECT --debug

# prs
smm prs fetch --start-date=$start_date --end-date=$end_date --project=$PROJECT --force
smm prs fetch-comments --start-date=$start_date --end-date=$end_date --project=$PROJECT --force

# pipelines
smm pipelines fetch --start-date=$start_date --end-date=$end_date --project=$PROJECT --force --by-day
smm pipelines fetch-jobs --run-start-date=$start_date --run-end-date=$end_date --project=$PROJECT --force --by-day

smm sonarqube analysis run --data-dir "./sonarqube_data" --properties "-Dsonar.projectKey=$PROJECT -Dsonar.javascript.exclusions=**/node_modules/**"
smm sonarqube fetch-measures
smm sonarqube fetch-component-tree
smm sonarqube fetch-historical-measures

smm prs summary --output=json
smm pipelines summary --output=json
smm pipelines jobs-summary --output=json
smm health-check --output=json
```

## Understanding the script

The script is organized in sections, each fetching a different data source. The `--force` flag is used on every fetch
command to overwrite previously cached data with the latest results.

### Setup

Set `SMM_STORE_DATA_AT` to the folder containing your `smm_config.json`, then define the project identifier and the
date range you want to refresh.

```bash
export SMM_STORE_DATA_AT=$1

PROJECT=marabesi/json-tool

start_date=2025-01-10
end_date=2026-06-06
```

> [!TIP]
> Pass the data folder path as the first argument when running the script:
>
> ```bash
> ./update-data.sh /path/to/your/data/folder
> ```

### Code metrics

Fetches commit history, runs codemaat analysis, and generates architecture metrics from your local git repository.

```bash
smm code fetch-commits --start-date=$start_date --end-date=$end_date --project=$PROJECT --force
smm code codemaat-fetch --start-date=$start_date --end-date=$end_date --project=$PROJECT --force
smm architecture generate --start-date=$start_date --end-date=$end_date --project=$PROJECT --debug
```

`fetch-commits` pulls the git log, `codemaat-fetch` processes it with [codemaat](./codemaat.md), and
`architecture generate` produces component-level coupling and cohesion metrics.

### Pull requests

Fetches pull requests and their review comments from the configured provider.

```bash
smm prs fetch --start-date=$start_date --end-date=$end_date --project=$PROJECT --force
smm prs fetch-comments --start-date=$start_date --end-date=$end_date --project=$PROJECT --force
```

Always run `prs fetch` before `prs fetch-comments`, as comments are tied to the pull requests already stored locally.

### Pipelines

Fetches pipeline runs and their associated jobs.

```bash
smm pipelines fetch --start-date=$start_date --end-date=$end_date --project=$PROJECT --force --by-day
smm pipelines fetch-jobs --run-start-date=$start_date --run-end-date=$end_date --project=$PROJECT --force --by-day
```

The `--by-day` flag fetches runs one day at a time, which avoids hitting API rate limits on providers with a large
pipeline history. The `--run-start-date` and `--run-end-date` options scope the job fetch to the pipeline run dates
rather than the pipeline creation dates.

### SonarQube

Runs a local SonarQube analysis and fetches the results.

```bash
smm sonarqube analysis run --data-dir "./sonarqube_data" --properties "-Dsonar.projectKey=$PROJECT -Dsonar.javascript.exclusions=**/node_modules/**"
smm sonarqube fetch-measures
smm sonarqube fetch-component-tree
smm sonarqube fetch-historical-measures
```

`sonarqube analysis run` starts a local SonarQube server and scanner, then `fetch-measures`,
`fetch-component-tree`, and `fetch-historical-measures` pull the quality metrics into your local cache. Adjust
`--properties` to match your project's language and exclusions.

### Summaries and health check

After all data is fetched, regenerate summaries and run a health check to validate the data quality.

```bash
smm prs summary --output=json
smm pipelines summary --output=json
smm pipelines jobs-summary --output=json
smm health-check --output=json
```

Summaries provide an overview of fetched PR and pipeline data. The health check identifies gaps, stale entries,
and coverage issues across all providers.

## Using the script

```bash
#!/bin/bash

export SMM_STORE_DATA_AT=$1

PROJECT=marabesi/json-tool

start_date=2025-01-10
end_date=2026-06-06

smm code fetch-commits --start-date=$start_date --end-date=$end_date --project=$PROJECT --force
smm code codemaat-fetch --start-date=$start_date --end-date=$end_date --project=$PROJECT --force
smm architecture generate --start-date=$start_date --end-date=$end_date --project=$PROJECT --debug

smm prs fetch --start-date=$start_date --end-date=$end_date --project=$PROJECT --force
smm prs fetch-comments --start-date=$start_date --end-date=$end_date --project=$PROJECT --force

smm pipelines fetch --start-date=$start_date --end-date=$end_date --project=$PROJECT --force --by-day
smm pipelines fetch-jobs --run-start-date=$start_date --run-end-date=$end_date --project=$PROJECT --force --by-day

smm sonarqube analysis run --data-dir "./sonarqube_data" --properties "-Dsonar.projectKey=$PROJECT -Dsonar.javascript.exclusions=**/node_modules/**"
smm sonarqube fetch-measures
smm sonarqube fetch-component-tree
smm sonarqube fetch-historical-measures

smm prs summary --output=json
smm pipelines summary --output=json
smm pipelines jobs-summary --output=json
smm health-check --output=json
```

### Adapting to your project

Customize the script for your own setup:

- **`PROJECT`**: set this to the `owner/repo` matching your `github_repository` in `smm_config.json`.
- **`start_date` / `end_date`**: adjust to the date range you want to refresh. Shorter ranges are faster to fetch.
- **`--by-day`**: if your pipeline history is small, you can remove this flag for a single bulk fetch.
- **SonarQube properties**: update `sonar.projectKey` and the exclusion patterns to match your project.
- **Remove sections you do not use**: if you do not use SonarQube, leave out those lines.

### Incremental updates

The script above runs a full refresh with `--force`. For smaller, incremental updates you can run individual
commands with a narrower date range:

```bash
smm prs fetch --start-date 2026-06-01 --end-date 2026-06-06 --project=$PROJECT --force
```

This fetches only the last week of pull requests without re-downloading the full history.

## Update cadence

Not all data sources change at the same pace. Update each source at a cadence that matches how often the underlying
data changes while respecting API rate limits.

| Data source | Recommended cadence | Why |
|---|---|---|
| Pull requests | Weekly | PRs open and close regularly; a weekly window captures merges, reviews, and comments without excessive API calls. |
| PR comments | Weekly | Always run after `prs fetch` to capture review activity on the updated PR list. |
| Pipelines | Weekly | Pipeline runs track CI/CD activity; a weekly fetch keeps trend lines current. |
| Pipeline jobs | Weekly | Always run after `pipelines fetch` to capture job details for the updated runs. |
| Commits (git log) | Weekly to monthly | Commit history changes frequently but accumulates in git locally; fetching too often adds load without much new signal. |
| Codemaat metrics | Weekly to monthly | Depends on fresh commit data; run it after `fetch-commits`. |
| Architecture metrics | Monthly | Architecture coupling and cohesion metrics shift slowly. A monthly refresh is usually enough. |
| SonarQube | Monthly or per-release | Local analysis is resource-intensive. Tie it to milestones or monthly snapshots. |
| Summaries and health check | Every update | Run after every data refresh to validate completeness and catch gaps early. |

### Weekly incremental script

For a weekly cadence, a narrower date range is often enough. Instead of re-fetching the full history, fetch only the
trailing window that covers the latest activity:

```bash
#!/bin/bash
# update-weekly.sh — run once a week

export SMM_STORE_DATA_AT=$1
PROJECT=your-org/your-repo

# trailing 14 days covers two weeks of activity
start_date=$(date -v-14d +%Y-%m-%d)
end_date=$(date +%Y-%m-%d)

smm prs fetch --start-date=$start_date --end-date=$end_date --project=$PROJECT --force
smm prs fetch-comments --start-date=$start_date --end-date=$end_date --project=$PROJECT --force
smm pipelines fetch --start-date=$start_date --end-date=$end_date --project=$PROJECT --force --by-day
smm pipelines fetch-jobs --run-start-date=$start_date --run-end-date=$end_date --project=$PROJECT --force --by-day
smm code fetch-commits --start-date=$start_date --end-date=$end_date --project=$PROJECT --force
smm code codemaat-fetch --start-date=$start_date --end-date=$end_date --project=$PROJECT --force

smm prs summary --output=json
smm pipelines summary --output=json
smm pipelines jobs-summary --output=json
smm health-check --output=json
```

This cuts out SonarQube and architecture, which you can schedule separately on a monthly basis.

### Monthly full refresh

Once a month, run the full script (including SonarQube and architecture) to keep the long-term trend data complete.

## Automating updates

Running the update script manually works for occasional checks, but regular cadences benefit from automation.

### Cron

The simplest approach is a cron job. Add an entry to your user crontab (`crontab -e`) that runs the script on a schedule:

```cron
# Run every Monday at 8:00 AM
0 8 * * 1 /home/user/scripts/update-weekly.sh /path/to/smm-data >> /home/user/scripts/update.log 2>&1

# Run on the 1st of every month at 6:00 AM (full refresh)
0 6 1 * * /home/user/scripts/update-data.sh /path/to/smm-data >> /home/user/scripts/update-full.log 2>&1
```

> [!TIP]
> Redirect stdout and stderr to a log file (`>> log 2>&1`) so you can review the output later. Pipe errors to a
> separate file if you want to monitor failures:
>
> ```cron
> 0 8 * * 1 /home/user/scripts/update-weekly.sh /path/to/smm-data >> /home/user/scripts/update.log 2> /home/user/scripts/update.err
> ```
