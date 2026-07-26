---
outline: deep
---

# Pull Requests

<!--@include: ../parts/supported-by-all.md{,2}-->

This dashboard provides insights into Pull Request (PR) activity within a software repository. It includes charts and
tables designed to highlight review speed, comment patterns, throughput, themes, and team dynamics.

Each chart in the dashboard is interactive and supports filtering by author, labels, and date range, allowing you to
drill down into the data that matters most for your team. This enables you to monitor team flow and identify bottlenecks.

## Fetching data

Fetching the data before operating it is the most first step to get started with metrics. This application provides
utilities to fetch data based on date time criteria as it is a standard to use it as a cut off for data analysis.

> [!NOTE]
> Fetching data may take a while depending on activity in the repository, by default it fetches
> every pull request and every workflow run in the repository.

Date-only values passed to `--start-date` and `--end-date` are interpreted with the selected project's configured
`timezone` from `smm_config.json`. If the project does not set `timezone`, SMM uses the project-specific `SMM_TIMEZONE`
environment variable, then `UTC`.

```bash
smm prs fetch
```

| Option         | Description <div style="width:200px"></div> | Example <div style="width:200px"></div> |
|----------------|-------------------------------------|--------------------------|
| Months         | It defaults to 1. It is used if no start or end date is given   | `--months=2`|
| Start date     | Fetches PRs created after a date.   | `--start-date=2025-01-01`|
| End date       | Fetches PRs created before a date.  | `--end-date=2025-12-31`  |
| Filters       | Allows to pass in filters directly to the [GitHub API](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests)  | `--raw-filters=state=open`  |
| Force       | By default a file is stored with the retrieved data to avoid refetching it again. However, using this parameter bypass this cache. | `--force=true`  |

Filtering the data fetch from PRs by date is done logically while fetching the data, this is not a feature that GitHub
API provides.

### Examples - Fetch PRs

Fetching PRs from the last 3 months:

```bash
smm prs fetch --months=3
```

Fetching PRs created between January 1, 2025, and June 30, 2025:

```bash
smm prs fetch --start-date=2025-01-01 --end-date=2025-06-30
```

Using a temporary timezone for CLI execution:

```bash
YOUR_ORG_FRONTEND_APP_SMM_TIMEZONE=Europe/Madrid smm --project your-org/frontend-app prs fetch --start-date=2025-01-01 --end-date=2025-06-30
```

Fetching only open PRs:

```bash
smm prs fetch --raw-filters=state=open,head=main
```

Forcing the fetch to ignore already fetched PRs (this overrides the data stored):

```bash
smm prs fetch --force=true
```

## Fetch PRs comments

Pull requests often have comments that provide insights into the review process. However, in order to fetch comments for
Pull Request, you must first fetch the PRs using the `smm prs fetch` command. The comments are not fetched by default to
optimize the data retrieval process as GitHub API has rate limits. Before fetching the comments, it first uses the PRs
data already fetched to get the comments for each PR using the property `review_comments_url` from each PR.

```bash
smm prs fetch-comments
```

| Option         | Description <div style="width:200px"></div> | Example <div style="width:240px"></div> |
|----------------|-------------------------------------|--------------------------|
| Start date     |  The PRs created date to filter after this date, this is the PR not the comment pr itself.  | `--start-date=2025-01-01`|
| End date       | The PRs created date to filter before this date, this is the PR not the comment pr itself.  | `--end-date=2025-12-31`  |
| Filters        | Allows to pass in filters directly to the [GitHub API](https://docs.github.com/en/rest/pulls/comments?apiVersion=2022-11-28&versionId=free-pro-team%40latest&category=pulls&subcategory=review-requests#list-review-comments-on-a-pull-request). It will pass the filters for each PR request.  | `--raw-filters=sort=created`  |
| Force       | By default a file is stored with the retrieved data to avoid refetching it again. However, using this parameter bypass this cache. | `--force=true`  |

### Examples - Fetch PRs comments

Fetching comments for PRs created between January 1, 2025, and June 30, 2025:

```bash
smm prs fetch-comments --start-date=2025-01-01 --end-date=2025-06-30
```

Forcing the fetch to ignore already fetched comments (this overrides the data stored):

```bash
smm prs fetch-comments --force=true
```


## Dashboard filters

Use these filters in the Pull Requests dashboard tab.

### Date range filters

| Dashboard filter | Backend query parameter |
|------------------|-------------------------|
| `startDate`      | `start_date`            |
| `endDate`        | `end_date`              |
| `timezone`       | `timezone`              |

### Pull Requests-specific filters

| Dashboard filter      | Backend query parameter |
|-----------------------|-------------------------|
| `authorSelect[]`      | `authors`               |
| `excludeAuthorSelect[]` | `exclude_authors`      |
| `excludeCommenterSelect[]` | `exclude_commenters` |
| `labelSelector[]`     | `labels`                |
| `pullRequestStatus`   | `status`                |
| `aggregateBy`         | `aggregate_by`          |

For list filters (`[]`), the dashboard sends comma-separated values.

The status filter supports `open`, `closed`, `merged`, and `draft`. The aggregation filter supports `day`, `week`, and
`month`.

The shared date picker, timezone behavior, saved views, and tab navigation are documented in
[Dashboard](./dashboard.md).

## Outliers and weekend filtering

Average-based PR metrics can include unusually large or small samples, such as a PR left open during a holiday or a burst
of automated comments. CLI commands that compute averages expose two cleaning options:

```bash
--weekends include|exclude|weekends_only
--outlier-mode include|flag|exclude
```

`--weekends` controls the sample set before averages are calculated. Use `include` to keep all samples, `exclude` to use
weekday samples only, or `weekends_only` to inspect weekend activity separately.

`--outlier-mode` controls detected outliers. Use `include` to keep all samples without reporting outliers, `flag` to keep
all samples and print outliers, or `exclude` to remove outliers before computing the average. Outliers are detected with
the interquartile range rule: values outside `Q1 - 1.5 * IQR` and `Q3 + 1.5 * IQR` are flagged. Weekend filtering runs
before outlier detection.

These options are available on `smm prs average-review-time`, `smm prs average-open`, and `smm prs average-comments`.

## Dashboard cards

The Pull Requests tab includes:

- **Average Review Time**: review time grouped by author.
- **Who Comments The Most**: comment volume by commenter *(dashboard only)*.
- **Time To First Comment**: elapsed time until the first PR comment *(dashboard only)*.
- **PRs by Author**: number of PRs opened by author.
- **Most Commented Pull Requests**: PRs with the most discussion, with direct PR links *(dashboard only)*.
- **Top Themes in Comments**: common terms in PR comments, with links to search for each theme *(dashboard only)*.
- **Open PRs Through Time**: opened and closed PR volume over time.
- **Average Days PRs Remain Open**: trend of how long PRs stay open.
- **PR Statistics**: totals, status counts, label distribution, and summary details.

Statistics and label values link to provider PR pages when the configured provider supports those URLs. Cards marked
*dashboard only* are computed on the fly from comment data and do not have separate CLI commands; run `smm prs
fetch-comments` first to populate the data they depend on.

## Summary PRs data

Show a summary of the PRs fetched from the repository, including total PRs, average open time, and other key metrics.

:::tabs key:cli
== Dashboard

Available as the PR Statistics card in the Pull Requests tab and as the Pull Requests summary card in the Insights tab.

== CLI

```bash
smm prs summary
```

| Option            | Description                          | Example                  |
|-------------------|--------------------------------------|--------------------------|
| Start date        | Fetches PRs created after a date.    | `--start-date=2025-01-01`|
| End date          | Fetches PRs created before a date.   | `--end-date=2025-12-31`  |
| Authors           | Comma-separated PR authors to include. | `--authors=alice,bob`  |
| Exclude authors   | Comma-separated PR authors to exclude. | `--exclude-authors=bot` |
| Exclude commenters| Comma-separated PR commenters to exclude. | `--exclude-commenters=bot` |
| Labels            | Filters PRs by attached labels. Multiple labels can be provided separated by commas. | `--labels=bug,enhancement` |
| Raw filters       | Comma-separated raw filter string (e.g. `status=draft,author=john`). Parsed and merged with other flags. | `--raw-filters="status=draft,author=john"` |
| Output            | Defines the output format, either text or json. Defaults to text.  | `--output=json`     |

### Examples - Summary PRs data

```bash
smm prs summary \
  --start-date=2025-01-01 \
  --end-date=2025-06-30 \
  --output=text \
  --labels=bug,enhancement
```

Output:

```textplain
PRs Summary:

Total PRs: 876
Merged PRs: 589
Closed PRs: 743
PRs Without Conclusion: 287
Unique Authors: 146
Unique Labels: 17
Average of comments per PR: 1.711187214611872

Labels:
  - created-by: next.js team: 350 PRs
  - locked: 705 PRs
  - tests: 375 PRs
  - documentation: 152 PRs
  - ci approved: 45 PRs
  - run-react-18-tests: 97 PRs
  - type: next: 396 PRs
  - created-by: turbopack team: 188 PRs
  - turbopack: 181 PRs
  - type: react-sync: 37 PRs
  - examples: 21 PRs
  - create-next-app: 24 PRs
  - created-by: next.js devex team: 44 PRs
  - font (next/font): 25 PRs
  - hacktoberfest-accepted: 5 PRs
  - ci bypass graphite optimization: 10 PRs
  - rspack: 6 PRs

First PR:
  Number: 84395
  Title: Update failing e2e deploy tests
  Author: ijjk
  Created: 2025-10-01T01:09:44Z
  Merged: 2025-10-01T02:18:18Z
  Closed: 2025-10-01T02:18:18Z

Last PR:
  Number: 85953
  Title: Update authentication.mdx: Fix `Auth0` Link
  Author: georgesfarah
  Created: 2025-11-09T23:07:38Z
  Merged: 2025-11-11T09:09:20Z
  Closed: 2025-11-11T09:09:20Z
```

:::

## Open PRs Through Time

Shows the volume of PRs opened and closed each day. This helps you spot bottlenecks, busy periods, or trends in your team's workflow.

:::tabs key:cli
== Dashboard

### Type of Chart

Bar chart (daily breakdown, with separate bars for opened and closed PRs).

### Insight Provided

Shows the volume of PRs opened and closed each day. This helps you spot bottlenecks, busy periods, or trends in your team's workflow.

![Pull requests timeline](/dashboard/prs/prs_timeline.png)

### How It Computes and Filters

1. Aggregates PR events by day.
2. Filters by date range (start/end date) - the date used in the prs are the created_at.
3. Data is processed to count opened and closed PRs per day.
4. You can filter the chart to focus on specific periods, such as a sprint or release window.

== CLI

```bash
smm prs through-time
```

| Option            | Description                          | Example                  |
|-------------------|--------------------------------------|--------------------------|
| Start date        | Fetches PRs created after a date.    | `--start-date=2025-01-01`|
| End date          | Fetches PRs created before a date.   | `--end-date=2025-12-31`  |
| Authors           | Comma-separated PR authors to include. | `--authors=alice,bob`  |
| Exclude authors   | Comma-separated PR authors to exclude. | `--exclude-authors=bot` |
| Exclude commenters| Comma-separated PR commenters to exclude. | `--exclude-commenters=bot` |
| Labels            | Filters PRs by attached labels.      | `--labels=bug,enhancement` |
| Aggregate by      | Aggregation period: day, week, or month (default: week). | `--aggregate-by=month` |
| Raw filters       | Comma-separated raw filter string.   | `--raw-filters="status=draft"` |
| Output            | Output format (text or json). Defaults to text. | `--output=json` |

### Examples - Open PRs Through Time

Computes the number of opened and closed PRs over time for a specific author:

```bash
smm prs through-time \
  --start-date=2025-01-01 \
  --end-date=2025-06-30 \
  --authors=author1,author2
```

:::

## Average PR Open

Tracks how long PRs stay open before merging. It uses weekly or monthly aggregation to show trends in review speed.

:::tabs key:cli
== Dashboard

### Type of Chart

Line chart showing the trend of average days PRs remain open, aggregated by week or month to smooth daily fluctuations.

### Insight Provided

Reveals how quickly your team merges pull requests and whether review speed is improving or degrading over time. A
downward trend suggests faster reviews and healthier flow.

![Pull requests open by on average](/dashboard/prs/open_prs_average.png)

== CLI

```bash
smm prs average-open
```

| Option            | Description                          | Example                  |
|-------------------|--------------------------------------|--------------------------|
| Start date        | Fetches PRs created after a date.    | `--start-date=2025-01-01`|
| End date          | Fetches PRs created before a date.   | `--end-date=2025-12-31`  |
| Authors           | Comma-separated PR authors to include. | `--authors=alice,bob`  |
| Exclude authors   | Comma-separated PR authors to exclude. | `--exclude-authors=bot` |
| Exclude commenters| Comma-separated PR commenters to exclude. | `--exclude-commenters=bot` |
| Labels            | Filters PRs by attached labels.      | `--labels=bug,enhancement` |
| Aggregate by      | Aggregation period: day, week, or month (default: week). | `--aggregate-by=month` |
| Raw filters       | Comma-separated raw filter string.   | `--raw-filters="status=draft"` |
| Output            | Output format (text or json). Defaults to text. | `--output=json` |

:::

### How It Computes and Filters

1. Calculates the average number of days PRs are open, grouped by week or month.
2. Supports filters for author, labels (e.g., bug, enhancement), and date range.
3. Aggregation smooths out daily fluctuations, showing long-term trends.

## Average Review Time By Author

Plot the average time taken from the team to review a PR open by an author and merge it. The result is shown in average
by days.

:::tabs key:cli
== Dashboard

### Type of Chart

Horizontal bar chart (authors ranked by average PR open time).

### Insight Provided

Highlights which contributors have PRs that remain open the longest, helping identify review bottlenecks or training needs.

![Pull requests open by author](/dashboard/prs/prs_open_by_author.png)

== CLI

```bash
smm prs average-review-time
```

| Option            | Description                          | Example                  |
|-------------------|--------------------------------------|--------------------------|
| Start date        | Fetches PRs created after a date.    | `--start-date=2025-01-01`|
| End date          | Fetches PRs created before a date.   | `--end-date=2025-12-31`  |
| Authors           | Comma-separated PR authors to include. | `--authors=alice,bob`  |
| Exclude authors   | Comma-separated PR authors to exclude. | `--exclude-authors=bot` |
| Exclude commenters| Comma-separated PR commenters to exclude. | `--exclude-commenters=bot` |
| Labels            | Filters PRs by attached labels.      | `--labels=bug,enhancement` |
| Top               | Show top N authors (default: 10).    | `--top=20`              |
| Raw filters       | Comma-separated raw filter string.   | `--raw-filters="status=merged"` |
| Weekends          | Include, exclude, or isolate weekend samples. | `--weekends=exclude` |
| Outlier mode      | Include, flag, or exclude detected outliers. | `--outlier-mode=flag` |
| Output            | Output format (text or json). Defaults to text. | `--output=json` |

:::

### Example Usage

If one author consistently has longer open times, it may indicate complex PRs or a need for more review support. For
example, if Alice's PRs average 7 days open while others average 2, you can investigate further.

### How It Computes and Filters

1. Computes average open time for each author.
2. Filters by top N authors, labels, and date range.
3. Data is processed to exclude bots or focus on specific contributors.

## PRs By Author

:::tabs key:cli
== Dashboard

### Type of Chart

Horizontal bar chart (authors ranked by number of PRs opened).

### Insight Provided

Shows who is most active in opening PRs, helping you recognize top contributors and balance workload.

== CLI

```bash
smm prs by-author
```

| Option            | Description                          | Example                  |
|-------------------|--------------------------------------|--------------------------|
| Start date        | Fetches PRs created after a date.    | `--start-date=2025-01-01`|
| End date          | Fetches PRs created before a date.   | `--end-date=2025-12-31`  |
| Authors           | Comma-separated PR authors to include. | `--authors=alice,bob`  |
| Exclude authors   | Comma-separated PR authors to exclude. | `--exclude-authors=bot` |
| Exclude commenters| Comma-separated PR commenters to exclude. | `--exclude-commenters=bot` |
| Labels            | Filters PRs by attached labels.      | `--labels=bug,enhancement` |
| Top               | Show top N authors (default: 10).    | `--top=20`              |
| Raw filters       | Comma-separated raw filter string.   | `--raw-filters="status=merged"` |
| Output            | Output format (text or json). Defaults to text. | `--output=json` |

:::

### Example Usage

If one developer is opening most PRs, you may want to redistribute tasks or recognize their effort. For example, if Bob
opened 30 PRs in a month, he's a key contributor.

### How It Computes and Filters

1. Counts PRs opened by each author.
2. Filters by top N authors, labels, and date range.
3. Includes bots (e.g., dependabot) to show the impact of automation.

## Average Comments per PR

Plot the average number of comments a PR receives before it is merged, aggregated by week or month.

:::tabs key:cli
== Dashboard

### Type of Chart

Line chart showing the average number of comments per PR over time, aggregated by week or month.

### Insight Provided

Measures discussion depth on pull requests. Higher averages may indicate thorough reviews or contentious changes, while
very low averages could signal superficial reviews.

![Comments made in prs averaged](/dashboard/prs/prs_comments_average.png)

== CLI

```bash
smm prs average-comments --aggregate-by=week
```

| Option            | Description                          | Example                  |
|-------------------|--------------------------------------|--------------------------|
| Start date        | Fetches PRs created after a date.    | `--start-date=2025-01-01`|
| End date          | Fetches PRs created before a date.   | `--end-date=2025-12-31`  |
| Authors           | Comma-separated PR authors to include. | `--authors=alice,bob`  |
| Exclude authors   | Comma-separated PR authors to exclude. | `--exclude-authors=bot` |
| Exclude commenters| Comma-separated PR commenters to exclude. | `--exclude-commenters=bot` |
| Labels            | Filters PRs by attached labels.      | `--labels=bug,enhancement` |
| Aggregate by      | Aggregation period: week or month. Shows per-period averages. | `--aggregate-by=month` |
| Raw filters       | Comma-separated raw filter string.   | `--raw-filters="status=merged"` |
| Output            | Output format (text or json). Defaults to text. | `--output=json` |

:::
