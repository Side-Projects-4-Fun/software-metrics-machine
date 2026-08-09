---
outline: deep
---

# Change Requests

<!--@include: ../parts/supported-by-all.md{,2}-->

This dashboard provides insights into change request activity within a software repository. It includes charts and
tables designed to highlight review speed, comment patterns, throughput, themes, and team dynamics.

Each chart in the dashboard is interactive and supports filtering by author, labels, and date range, allowing you to
drill down into the data that matters most for your team. This enables you to monitor team flow and identify bottlenecks.

## Fetching data

Fetching the data before operating it is the most first step to get started with metrics. This application provides
utilities to fetch data based on date time criteria as it is a standard to use it as a cut off for data analysis.

> [!NOTE]
> Fetching data may take a while depending on activity in the repository, by default it fetches
> every change request and every workflow run in the repository.

Date-only values passed to `--start-date` and `--end-date` are interpreted with the selected project's configured
`timezone` from `smm_config.json`. If the project does not set `timezone`, SMM uses the project-specific `SMM_TIMEZONE`
environment variable, then `UTC`.

```bash
smm change-requests fetch
```

| Option         | Description <div style="width:200px"></div> | Example <div style="width:200px"></div> |
|----------------|-------------------------------------|--------------------------|
| Start date     | Fetches change requests created after a date.   | `--start-date=2025-01-01`|
| End date       | Fetches change requests created before a date.  | `--end-date=2025-12-31`  |
| Filters       | Allows passing raw filters directly to the provider's API. See your provider's API docs for available fields. For GitHub: [list pull requests](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests)  | `--raw-filters=state=open`  |
| Force       | By default a file is stored with the retrieved data to avoid refetching it again. However, using this parameter bypass this cache. | `--force=true`  |
| Update       | Incrementally fetch only newer items and merge with existing cache. | `--update=true` |

Filtering the data fetch from change requests by date is done logically while fetching the data. Provider APIs may require
all results to be retrieved before client-side date filtering can be applied.

### Examples - Fetch change requests

Fetching change requests from the last 3 months:

```bash
smm change-requests fetch --start-date=2025-09-01 --end-date=2025-12-01
```

Fetching change requests created between January 1, 2025, and June 30, 2025:

```bash
smm change-requests fetch --start-date=2025-01-01 --end-date=2025-06-30
```

Using a temporary timezone for CLI execution:

```bash
YOUR_ORG_FRONTEND_APP_SMM_TIMEZONE=Europe/Madrid smm --project your-org/frontend-app change-requests fetch --start-date=2025-01-01 --end-date=2025-06-30
```

Fetching only open change requests:

```bash
smm change-requests fetch --raw-filters=state=open,head=main
```

Forcing the fetch to ignore already fetched change requests (this overrides the data stored):

```bash
smm change-requests fetch --force=true
```

## Fetch change request comments

Change requests often have comments that provide insights into the review process. However, in order to fetch comments
for change requests, you must first fetch the change requests using the `smm change-requests fetch` command. The
comments are not fetched by default to optimize data retrieval and respect API rate limits. Before fetching the
comments, it first uses the change requests data already fetched to get the comments for each change request using
the property `review_comments_url` from each change request.

```bash
smm change-requests fetch-comments
```

| Option         | Description <div style="width:200px"></div> | Example <div style="width:240px"></div> |
|----------------|-------------------------------------|--------------------------|
| Start date     |  The change requests created date to filter after this date, this is the change request not the comment itself.  | `--start-date=2025-01-01`|
| End date       | The change requests created date to filter before this date, this is the change request not the comment itself.  | `--end-date=2025-12-31`  |
| Filters        | Allows passing raw filters directly to the provider's API. See your provider's API docs for available fields. For GitHub: [list review comments](https://docs.github.com/en/rest/pulls/comments?apiVersion=2022-11-28). It will pass the filters for each change request request.  | `--raw-filters=sort=created`  |
| Force       | By default a file is stored with the retrieved data to avoid refetching it again. However, using this parameter bypass this cache. | `--force=true`  |
| Update       | Incrementally fetch only comments updated since the last sync. | `--update=true` |

### Examples - Fetch change request comments

Fetching comments for change requests created between January 1, 2025, and June 30, 2025:

```bash
smm change-requests fetch-comments --start-date=2025-01-01 --end-date=2025-06-30
```

Forcing the fetch to ignore already fetched comments (this overrides the data stored):

```bash
smm change-requests fetch-comments --force=true
```


## Dashboard filters

Use these filters in the Change Requests dashboard tab.

### Date range filters

| Dashboard filter | Backend query parameter |
|------------------|-------------------------|
| `startDate`      | `start_date`            |
| `endDate`        | `end_date`              |
| `timezone`       | `timezone`              |

### Change Requests-specific filters

| Dashboard filter      | Backend query parameter |
|-----------------------|-------------------------|
| `authorSelect[]`      | `authors`               |
| `excludeAuthorSelect[]` | `exclude_authors`      |
| `excludeCommenterSelect[]` | `exclude_commenters` |
| `labelSelector[]`     | `labels`                |
| `changeRequestStatus`   | `status`                |
| `aggregateBy`         | `aggregate_by`          |

For list filters (`[]`), the dashboard sends comma-separated values.

The status filter supports `open`, `closed`, `merged`, and `draft`. The aggregation filter supports `day`, `week`, and
`month`.

The shared date picker, timezone behavior, saved views, and tab navigation are documented in
[Dashboard](./dashboard.md).

## Statistical method, outliers and weekend filtering

Change request metrics support multiple statistical methods via the `--method` option:

```bash
--method average|median|p75|p90|p95|min|max
```

The default is `average`. `median` (p50) shows the typical experience without being skewed by outliers. `p75`/`p90`/`p95`
answer "N% of change requests are within X days", matching common SLA formulations. `min`/`max` show the full range.

Average-based change request metrics can include unusually large or small samples, such as a change request left open
during a holiday or a burst of automated comments. CLI commands that compute metrics expose two cleaning options:

```bash
--weekends include|exclude|weekends_only
--outlier-mode include|flag|exclude
```

`--weekends` controls the sample set before metrics are calculated. Use `include` to keep all samples, `exclude` to use
weekday samples only, or `weekends_only` to inspect weekend activity separately.

`--outlier-mode` controls detected outliers. Use `include` to keep all samples without reporting outliers, `flag` to keep
all samples and print outliers, or `exclude` to remove outliers before computing the metric. Outliers are detected with
the interquartile range rule: values outside `Q1 - 1.5 * IQR` and `Q3 + 1.5 * IQR` are flagged. Weekend filtering runs
before outlier detection.

These options are available on `smm change-requests review-time`, `smm change-requests open-time`, and
`smm change-requests comments`.

## Dashboard cards

The Change Requests tab includes:

- **Average Review Time**: review time grouped by author.
- **Who Comments The Most**: comment volume by commenter *(dashboard only)*.
- **Time To First Comment**: elapsed time until the first change request comment *(dashboard only)*.
- **Change Requests by Author**: number of change requests opened by author.
- **Most Commented Change Requests**: change requests with the most discussion, with direct links *(dashboard only)*.
- **Top Themes in Comments**: common terms in change request comments, with links to search for each theme *(dashboard only)*.
- **Open Change Requests Through Time**: opened and closed change request volume over time.
- **Average Days Change Requests Remain Open**: trend of how long change requests stay open.
- **Change Request Statistics**: totals, status counts, label distribution, and summary details.

Statistics and label values link to provider change request pages when the configured provider supports those URLs.
Cards marked *dashboard only* are computed on the fly from comment data and do not have separate CLI commands; run
`smm change-requests fetch-comments` first to populate the data they depend on.

## Summary change request data

Show a summary of the change requests fetched from the repository, including total change requests, average open
time, and other key metrics.

:::tabs key:cli
== Dashboard

Available as the Change Request Statistics card in the Change Requests tab and as the Change Requests summary card in
the Insights tab.

== CLI

```bash
smm change-requests summary
```

| Option            | Description                          | Example                  |
|-------------------|--------------------------------------|--------------------------|
| Start date        | Fetches change requests created after a date.    | `--start-date=2025-01-01`|
| End date          | Fetches change requests created before a date.   | `--end-date=2025-12-31`  |
| Authors           | Comma-separated change request authors to include. | `--authors=alice,bob`  |
| Exclude authors   | Comma-separated change request authors to exclude. | `--exclude-authors=bot` |
| Exclude commenters| Comma-separated change request commenters to exclude. | `--exclude-commenters=bot` |
| Labels            | Filters change requests by attached labels. Multiple labels can be provided separated by commas. | `--labels=bug,enhancement` |
| Raw filters       | Comma-separated raw filter string (e.g. `status=draft,author=john`). Parsed and merged with other flags. | `--raw-filters="status=draft,author=john"` |
| Output            | Defines the output format, either text or json. Defaults to text.  | `--output=json`     |

### Examples - Summary change request data

```bash
smm change-requests summary \
  --start-date=2025-01-01 \
  --end-date=2025-06-30 \
  --output=text \
  --labels=bug,enhancement
```

Output:

```textplain
Change Requests Summary:

Total change requests: 876
Merged change requests: 589
Closed change requests: 743
Change requests without conclusion: 287
Unique Authors: 146
Unique Labels: 17
Average of comments per change request: 1.711187214611872

Labels:
  - created-by: next.js team: 350 change requests
  - locked: 705 change requests
  - tests: 375 change requests
  - documentation: 152 change requests
  - ci approved: 45 change requests
  - run-react-18-tests: 97 change requests
  - type: next: 396 change requests
  - created-by: turbopack team: 188 change requests
  - turbopack: 181 change requests
  - type: react-sync: 37 change requests
  - examples: 21 change requests
  - create-next-app: 24 change requests
  - created-by: next.js devex team: 44 change requests
  - font (next/font): 25 change requests
  - hacktoberfest-accepted: 5 change requests
  - ci bypass graphite optimization: 10 change requests
  - rspack: 6 change requests

First change request:
  Number: 84395
  Title: Update failing e2e deploy tests
  Author: ijjk
  Created: 2025-10-01T01:09:44Z
  Merged: 2025-10-01T02:18:18Z
  Closed: 2025-10-01T02:18:18Z

Last change request:
  Number: 85953
  Title: Update authentication.mdx: Fix `Auth0` Link
  Author: georgesfarah
  Created: 2025-11-09T23:07:38Z
  Merged: 2025-11-11T09:09:20Z
  Closed: 2025-11-11T09:09:20Z
```

:::

## Open Change Requests Through Time

Shows the volume of change requests opened and closed each day. This helps you spot bottlenecks, busy periods, or
trends in your team's workflow.

:::tabs key:cli
== Dashboard

### Type of Chart

Bar chart (daily breakdown, with separate bars for opened and closed change requests).

### Insight Provided

Shows the volume of change requests opened and closed each day. This helps you spot bottlenecks, busy periods, or
trends in your team's workflow.

![Change requests timeline](/dashboard/change-requests/change_requests_timeline.png)

### How It Computes and Filters

1. Aggregates change request events by day.
2. Filters by date range (start/end date) - the date used in the change requests are the created_at.
3. Data is processed to count opened and closed change requests per day.
4. You can filter the chart to focus on specific periods, such as a sprint or release window.

== CLI

```bash
smm change-requests through-time
```

| Option            | Description                          | Example                  |
|-------------------|--------------------------------------|--------------------------|
| Start date        | Fetches change requests created after a date.    | `--start-date=2025-01-01`|
| End date          | Fetches change requests created before a date.   | `--end-date=2025-12-31`  |
| Authors           | Comma-separated change request authors to include. | `--authors=alice,bob`  |
| Exclude authors   | Comma-separated change request authors to exclude. | `--exclude-authors=bot` |
| Exclude commenters| Comma-separated change request commenters to exclude. | `--exclude-commenters=bot` |
| Labels            | Filters change requests by attached labels.      | `--labels=bug,enhancement` |
| Aggregate by      | Aggregation period: day, week, or month (default: week). | `--aggregate-by=month` |
| Raw filters       | Comma-separated raw filter string.   | `--raw-filters="status=draft"` |
| Output            | Output format (text or json). Defaults to text. | `--output=json` |

### Examples - Open Change Requests Through Time

Computes the number of opened and closed change requests over time for a specific author:

```bash
smm change-requests through-time \
  --start-date=2025-01-01 \
  --end-date=2025-06-30 \
  --authors=author1,author2
```

:::

## Change Request Open Time

Tracks how long change requests stay open before merging. It uses weekly or monthly aggregation to show trends in
review speed.

:::tabs key:cli
== Dashboard

### Type of Chart

Line chart showing the trend of average days change requests remain open, aggregated by week or month to smooth daily
fluctuations.

### Insight Provided

Reveals how quickly your team merges change requests and whether review speed is improving or degrading over time. A
downward trend suggests faster reviews and healthier flow.

![Change requests open by on average](/dashboard/change-requests/open_change_requests_average.png)

== CLI

```bash
smm change-requests open-time --method average
```

| Option            | Description                          | Example                  |
|-------------------|--------------------------------------|--------------------------|
| Start date        | Fetches change requests created after a date.    | `--start-date=2025-01-01`|
| End date          | Fetches change requests created before a date.   | `--end-date=2025-12-31`  |
| Authors           | Comma-separated change request authors to include. | `--authors=alice,bob`  |
| Exclude authors   | Comma-separated change request authors to exclude. | `--exclude-authors=bot` |
| Exclude commenters| Comma-separated change request commenters to exclude. | `--exclude-commenters=bot` |
| Labels            | Filters change requests by attached labels.      | `--labels=bug,enhancement` |
| Aggregate by      | Aggregation period: day, week, or month (default: week). | `--aggregate-by=month` |
| Method            | Statistical method: average, median, p75, p90, p95, min, max (default: average). | `--method=median` |
| Raw filters       | Comma-separated raw filter string.   | `--raw-filters="status=draft"` |
| Output            | Output format (text or json). Defaults to text. | `--output=json` |

:::

### How It Computes and Filters

1. Calculates the average number of days change requests are open, grouped by week or month.
2. Supports filters for author, labels (e.g., bug, enhancement), and date range.
3. Aggregation smooths out daily fluctuations, showing long-term trends.

## Review Time By Author

Plot the review time taken from the team to review a change request opened by an author and merge it. Supports multiple
statistical methods via `--method`.

:::tabs key:cli
== Dashboard

### Type of Chart

Horizontal bar chart (authors ranked by average change request open time).

### Insight Provided

Highlights which contributors have change requests that remain open the longest, helping identify review bottlenecks or
training needs.

![Change requests open by author](/dashboard/change-requests/change_requests_open_by_author.png)

== CLI

```bash
smm change-requests review-time --method average
```

| Option            | Description                          | Example                  |
|-------------------|--------------------------------------|--------------------------|
| Start date        | Fetches change requests created after a date.    | `--start-date=2025-01-01`|
| End date          | Fetches change requests created before a date.   | `--end-date=2025-12-31`  |
| Authors           | Comma-separated change request authors to include. | `--authors=alice,bob`  |
| Exclude authors   | Comma-separated change request authors to exclude. | `--exclude-authors=bot` |
| Exclude commenters| Comma-separated change request commenters to exclude. | `--exclude-commenters=bot` |
| Labels            | Filters change requests by attached labels.      | `--labels=bug,enhancement` |
| Top               | Show top N authors (default: 10).    | `--top=20`              |
| Method            | Statistical method: average, median, p75, p90, p95, min, max (default: average). | `--method=p90` |
| Raw filters       | Comma-separated raw filter string.   | `--raw-filters="status=merged"` |
| Weekends          | Include, exclude, or isolate weekend samples. | `--weekends=exclude` |
| Outlier mode      | Include, flag, or exclude detected outliers. | `--outlier-mode=flag` |
| Output            | Output format (text or json). Defaults to text. | `--output=json` |

:::

### Example Usage

If one author consistently has longer open times, it may indicate complex change requests or a need for more review
support. For example, if Alice's change requests average 7 days open while others average 2, you can investigate
further.

### How It Computes and Filters

1. Computes average open time for each author.
2. Filters by top N authors, labels, and date range.
3. Data is processed to exclude bots or focus on specific contributors.

## Change Requests By Author

:::tabs key:cli
== Dashboard

### Type of Chart

Horizontal bar chart (authors ranked by number of change requests opened).

### Insight Provided

Shows who is most active in opening change requests, helping you recognize top contributors and balance workload.

== CLI

```bash
smm change-requests by-author
```

| Option            | Description                          | Example                  |
|-------------------|--------------------------------------|--------------------------|
| Start date        | Fetches change requests created after a date.    | `--start-date=2025-01-01`|
| End date          | Fetches change requests created before a date.   | `--end-date=2025-12-31`  |
| Authors           | Comma-separated change request authors to include. | `--authors=alice,bob`  |
| Exclude authors   | Comma-separated change request authors to exclude. | `--exclude-authors=bot` |
| Exclude commenters| Comma-separated change request commenters to exclude. | `--exclude-commenters=bot` |
| Labels            | Filters change requests by attached labels.      | `--labels=bug,enhancement` |
| Top               | Show top N authors (default: 10).    | `--top=20`              |
| Raw filters       | Comma-separated raw filter string.   | `--raw-filters="status=merged"` |
| Output            | Output format (text or json). Defaults to text. | `--output=json` |

:::

### Example Usage

If one developer is opening most change requests, you may want to redistribute tasks or recognize their effort. For
example, if Bob opened 30 change requests in a month, he's a key contributor.

### How It Computes and Filters

1. Counts change requests opened by each author.
2. Filters by top N authors, labels, and date range.
3. Includes bots (e.g., dependabot) to show the impact of automation.

## Comments per change request

Plot the number of comments a change request receives before it is merged, aggregated by week or month. Supports
multiple statistical methods via `--method`.

:::tabs key:cli
== Dashboard

### Type of Chart

Line chart showing the average number of comments per change request over time, aggregated by week or month.

### Insight Provided

Measures discussion depth on change requests. Higher values may indicate thorough reviews or contentious changes,
while very low values could signal superficial reviews.

![Comments made in change requests averaged](/dashboard/change-requests/change_requests_comments_average.png)

== CLI

```bash
smm change-requests comments --method average --aggregate-by=week
```

| Option            | Description                          | Example                  |
|-------------------|--------------------------------------|--------------------------|
| Start date        | Fetches change requests created after a date.    | `--start-date=2025-01-01`|
| End date          | Fetches change requests created before a date.   | `--end-date=2025-12-31`  |
| Authors           | Comma-separated change request authors to include. | `--authors=alice,bob`  |
| Exclude authors   | Comma-separated change request authors to exclude. | `--exclude-authors=bot` |
| Exclude commenters| Comma-separated change request commenters to exclude. | `--exclude-commenters=bot` |
| Labels            | Filters change requests by attached labels.      | `--labels=bug,enhancement` |
| Aggregate by      | Aggregation period: week or month. Shows per-period values. | `--aggregate-by=month` |
| Method            | Statistical method: average, median, p75, p90, p95, min, max (default: average). | `--method=median` |
| Raw filters       | Comma-separated raw filter string.   | `--raw-filters="status=merged"` |
| Output            | Output format (text or json). Defaults to text. | `--output=json` |

:::
