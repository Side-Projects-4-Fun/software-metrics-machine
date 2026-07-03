---
outline: deep
---

# Pipelines

<!--@include: ../parts/supported-by-all.md{,2}-->

The pipelines section is at the core of any CI/CD system. It provides a high-level overview of the pipelines that have
been executed, their statuses, and key metrics related to their performance at a glance. It focuses on first, a quick
statuses run for the pipelines, and second, on the time it takes to run them.

The dashboard tab currently includes:

- Total runs summary.
- Pipeline Runs Duration with Min-Max Range, Job Breakdown, and Runs by Day tabs.
- Jobs Average Time with By Job and By Day tabs.
- Job Reruns with a reruns-by-day chart and jobs summary table.
- Jobs by Status.
- Job Steps Analysis when exactly one job is selected.

Several tables link to provider pages such as workflow runs, job runs, and workflow metrics when the configured provider
supports those URLs.

## Outliers and weekend filtering

Pipeline duration metrics can be skewed by unusually slow runs, retries, provider incidents, or weekend-only activity.
CLI commands that compute averages expose two cleaning options:

```bash
--weekends include|exclude|weekends_only
--outlier-mode include|flag|exclude
```

`--weekends` controls the sample set before averages are calculated. Use `include` to keep all samples, `exclude` to use
weekday samples only, or `weekends_only` to inspect weekend executions separately.

`--outlier-mode` controls detected outliers. Use `include` to keep all samples without reporting outliers, `flag` to keep
all samples and print outliers, or `exclude` to remove outliers before computing the average. Outliers are detected with
the interquartile range rule: values outside `Q1 - 1.5 * IQR` and `Q3 + 1.5 * IQR` are flagged. Weekend filtering runs
before outlier detection.

These options are available on `smm pipelines summary`, `smm pipelines runs-duration`, `smm pipelines jobs-summary`,
`smm pipelines jobs-time-execution`, `smm pipelines jobs-steps-average-time`, `smm pipelines jobs-by-status`, and
`smm pipelines lead-time`.

## Pipeline by Status

:::tabs key:cli
== Dashboard

![Pipelines and statuses](/dashboard/pipelines/pipelines_run.png)

== CLI

```bash
smm pipelines by-status
```

| Option         | Description                          | Example |
|----------------|--------------------------------------|---------|
| Start date     | Filter by created after this date.   | `--start-date=2025-01-01`     |
| End date       | Filter by created before this date.  | `--end-date=2025-12-31`     |
| Output         | Output format (text or json)         | `--output=json`             |

:::






## Pipeline Runs by Time

Computes the number of pipeline runs over time and returns a time series plot showing how many pipeline executions
were triggered in the given time frame. Aggregated by week or month.

```bash
smm pipelines runs-by
```






## Pipeline Runs Duration

Computes the duration of each pipeline run over time and returns a time series plot showing how long each pipeline
execution took to complete in minutes. The time taken is calculated based on the sum of all individual jobs executed in the
pipeline, excluding skipped jobs.

## Dashboard filters

Use these filters in the Pipelines dashboard tab.

### Date range filters

| Dashboard filter | Backend query parameter |
|------------------|-------------------------|
| `startDate`      | `start_date`            |
| `endDate`        | `end_date`              |
| `timezone`       | `timezone`              |

### Pipelines-specific filters

| Dashboard filter         | Backend query parameter |
|--------------------------|-------------------------|
| `workflowSelector`       | `workflow_path`         |
| `workflowStatus[]`       | `status`                |
| `workflowConclusions[]`  | `conclusion`            |
| `jobSelector[]`          | `job_name`              |
| `branch[]`               | `branch`                |
| `event[]`                | `event`                 |
| `aggregateMetric`        | `metric`                |

For list filters (`[]`), the dashboard sends comma-separated values.

Filter options are loaded from the API. Workflows, statuses, conclusions, branches, events, and jobs reflect the data
available in the configured project. When a workflow is selected, the jobs filter refreshes to the jobs for that workflow.

The shared date picker, timezone behavior, saved views, and tab navigation are documented in
[Dashboard](./dashboard.md).

:::tabs key:cli
== Dashboard

![Time it takes to run pipeline](/dashboard/pipelines/runs_in_minutes.png)

== CLI

```bash
smm pipelines runs-duration
```

| Option        | Description                                                                                                             | Example <div style="width:200px"></div> |
|---------------|-------------------------------------------------------------------------------------------------------------------------|--------------------------|
| Start date    | Filter by created after this date.                                                                                      | `--start-date=2025-01-01`     |
| End date      | Filter by created before this date.                                                                                     | `--end-date=2025-12-31`     |
| Metric        | The type of metric to compute for each execution (avg, sum, count)                                                      | `--metric=sum`     |
| Aggregate     | Aggregate the data by day, plotting each day computing the desired metric                                               | `--aggregate-by-day=true`     |
| Raw Filters   | Filters by the fields available by the provider, for example, if using GitHub, you can filters by any filter in the API | `--raw-filters=status=completed,conclusion=success`     |
| Workflow path | Filter by the workflow file path                                                                                        | `--workflow-path=".github/workflows/ci.yml"`     |
| Weekends      | Include, exclude, or isolate weekend samples.                                                                           | `--weekends=exclude` |
| Outlier mode  | Include, flag, or exclude detected outliers.                                                                            | `--outlier-mode=flag` |

### Examples - Runs duration

Computes the average time of each pipeline run between August 17, 2025, and November 17, 2025 and aggregates the data
by day, returning the average duration of all runs executed each day:

```bash
smm pipelines runs-duration \
  --start-date 2025-08-17 \
  --end-date 2025-11-17 \
  --workflow-path=".github/workflows/ci.yml" \
  --aggregate-by-day=true
```

:::

## Pipeline Summary

Summary of pipelines executed showing total runs, statuses, first and last run available from the data.

:::tabs key:cli
== Dashboard

Available in the Insights tab as the Pipeline Runs summary card and in the Pipelines tab as the Total runs summary.

== CLI

```bash
smm pipelines summary
```

| Option         | Description                          | Example <div style="width:200px"></div> |
|----------------|--------------------------------------|--------------------------|
| Start date     | Filter by created after this date.   | `--start-date=2025-01-01`     |
| End date       | Filter by created before this date.  | `--end-date=2025-12-31`     |
| Limit          | Limit the number of pipelines shown  | `--max-workflows`     |
| Output format  | Format of the output, text or json  | `--output=json`     |

:::






## Jobs Average Time Execution

Jobs are the building blocks of any pipeline. They represent individual tasks or steps that need to be executed as
part of the overall pipeline process. This command associates the jobs wih their corresponding pipeline execution.

In the dashboard, the Jobs Average Time card can be viewed by job or by day.

:::tabs key:cli
== Dashboard

![Jobs averaged out by run duration](/dashboard/pipelines/jobs_duration.png)

== CLI

```bash
smm pipelines jobs-time-execution
```

| Option       | Description                                                    | Example <div style="width:200px"></div>     |
|--------------|----------------------------------------------------------------|---------------------------------------------|
| Start date   | Filter by created after this date.                             | `--start-date=2025-01-01`                   |
| End date     | Filter by created before this date.                            | `--end-date=2025-12-31`                     |
| Job name     | Optional job name substring to filter jobs                     | `--job-name=test`                           |
| Output       | Output format (text or json)                                   | `--output=json`                             |

### Examples - Shows jobs based on their execution time

List the average time it takes for the jobs to run from start to finish:

```bash
smm pipelines jobs-time-execution \
  --start-date 2025-01-01 \
  --end-date 2025-06-30
```


:::




## Jobs by Status

```bash
smm pipelines jobs-by-status
```

:::tabs key:cli
== Dashboard

Available as the Jobs by Status card in the Pipelines tab.

== CLI

```bash
smm pipelines jobs-by-status
```

| Option               | Description                                                                                                                 | Example <div style="width:200px"></div>             |
|----------------------|-----------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------|
| Start date           | Filter by created after this date.                                                                                          | `--start-date=2025-01-01`                           |
| End date             | Filter by created before this date.                                                                                         | `--end-date=2025-12-31`                             |
| Raw Filters          | Filters by the job fields available by the provider, for example, if using GitHub, you can filters by any filter in the API | `--raw-filters=status=completed,conclusion=success` |
| Pipeline raw Filters | Filters by the pipeline, use this option to decrease the scope size of the dataset                                          | `--pipeline-raw-filters=status=completed`           |


### Examples - Filter jobs by status

Computes jobs that belong to pipelines completed between August 17, 2025, and November 17, 2025 and have been
successfully completed:

```bash
smm pipelines jobs-by-status \
  --start-date 2025-08-17 \
  --end-date 2025-11-17 \
  --pipeline-raw-filters=status=completed \ 
  --raw-filters=conclusion=success 
```

:::





## Jobs Summary

```bash
smm pipelines jobs-summary
```

:::tabs key:cli
== Dashboard

Available in the Job Reruns card as the Jobs Summary table. It includes total runs, average duration, success/failure
counts, success/failure rates, and rerun count.

== CLI

```bash
smm pipelines jobs-summary
```

| Option         | Description                          | Example <div style="width:200px"></div> |
|----------------|--------------------------------------|--------------------------|
| Start date     | Filter by created after this date.   | `--start-date=2025-01-01`     |
| End date       | Filter by created before this date.  | `--end-date=2025-12-31`     |
| Pipeline       | Filter jobs by pipeline name (not the path) | `--pipeline="Name of the pipeline"`     |

:::

## Job Steps Analysis

When exactly one job is selected in the dashboard filters, the Pipelines tab shows step-level analysis for that job. The
card includes:

- Average step duration by day.
- Overall time proportion by step.
- A sortable table of steps, average duration, and count.

