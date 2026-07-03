---
outline: deep
---

# Pull Requests

<!--@include: ../parts/supported-by-all.md{,2}-->

This dashboard provides insights into Pull Request (PR) activity within a software repository. It includes charts and
tables designed to highlight review speed, comment patterns, throughput, themes, and team dynamics.

Each chart in the dashboard is interactive and supports filtering by author, labels, and date range, allowing you to
drill down into the data that matters most for your team. This enables you to monitor team flow and identify bottlenecks.

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
- **Who Comments The Most**: comment volume by commenter.
- **Time To First Comment**: elapsed time until the first PR comment.
- **PRs by Author**: number of PRs opened by author.
- **Most Commented Pull Requests**: PRs with the most discussion, with direct PR links.
- **Top Themes in Comments**: common terms in PR comments, with links to search for each theme.
- **Open PRs Through Time**: opened and closed PR volume over time.
- **Average Days PRs Remain Open**: trend of how long PRs stay open.
- **PR Statistics**: totals, status counts, label distribution, and summary details.

Statistics and label values link to provider PR pages when the configured provider supports those URLs.

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

If you notice a spike in opened PRs but few closed ones, it may indicate the start of a new sprint or a backlog forming.
For example, if September 25th shows many opened PRs but none closed, it could signal a need to focus on reviews.

### How It Computes and Filters

1. Aggregates PR events by day.
2. Filters by date range (start/end date) - the date used in the prs are the created_at.
3. Data is processed to count opened and closed PRs per day.
4. You can filter the chart to focus on specific periods, such as a sprint or release window.

## Average PR Open

Tracks how long PRs stay open before merging. It uses weekly or monthly aggregation to show trends in review speed.

:::tabs key:cli
== Dashboard

### Type of Chart

Line chart (trend of average days PRs remain open, aggregated by week or month).

### Insight Provided

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
