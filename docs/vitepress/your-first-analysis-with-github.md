---
outline: deep
---

# Your first analysis with GitHub (or GitLab)

This guide will walk you through the steps to perform your first analysis using Software Metrics Machine. By the end of
this guide, you will have fetched data from a repository and visualized key metrics to gain insights into your
software development process.

> [!NOTE]
> This guide uses GitHub as the provider. If you are using GitLab, the same CLI commands apply — just set
> `git_provider` to `gitlab` in your `smm_config.json`. See the [GitLab provider guide](./gitlab.md) for setup
> instructions.

## The project

For this first analysis, we will be using a sample GitHub repository that contains a variety of change requests and
workflows. You can use your own repository if you prefer. We will be using the [vuejs repository](https://github.com/vuejs/vue)
as it is a heavily active open source project so that you can see most of the features of the tool.

## Setting up the environment

The first step is to clone the repository locally if you haven't done so already.

```bash
git clone https://github.com/vuejs/vue
```

Once done, note the path where you cloned the repository, as you will need it.

> [!NOTE]
> Cloning the repository is used to fetch git history data with [codemaat](codemaat.md) tool, if you only want to fetch
> data from GitHub API you can skip this step.

## SMM Configuration file

Now, set up the configuration to point to the repository you just cloned and provide the necessary GitHub token. If you
haven't generated a GitHub token yet, follow the steps in the [GitHub setup guide](./github.md).

Run the interactive wizard, which asks for the Git provider, repository, local clone path, branch, and token, then
writes `smm_config.json` for you:

```bash
smm project configure
```

The wizard also handles the data directory for you: if no data directory is available yet, it asks for one, creates it,
and saves it as the default so later commands reuse it. See [Project management](./project.md) for the full wizard
walkthrough.

Next, we will fetch the data from GitHub.

## Fetching Data

To fetch data from the GitHub repository, we will use the CLI commands provided by Software Metrics Machine.

### Fetching source code codemaat

To fetch the git history data using codemaat, run the following command:

```bash
smm code codemaat-fetch --start-date 2023-01-01 --end-date 2023-01-10
```

### Fetch change requests

To fetch change requests from the repository, run the following command:

```bash
smm change-requests fetch --start-date 2023-01-01 --end-date 2023-01-10
```

This command fetches change requests created between January 1, 2025, and January 10, 2025. You can adjust the dates as
needed. If you want to fetch all change requests, you can omit the date filters. However, be aware that fetching a large
number of change requests may take a while and could hit GitHub API rate limits.

In addition to fetching change requests, you can also fetch associated reviews and comments by running the following
command:

```bash
smm change-requests fetch-comments --start-date 2023-01-01 --end-date 2023-01-10
```

The comments fetched are based on the change requests already fetched, so ensure you run the
`smm change-requests fetch` command first.

### Fetch pipelines (workflow runs)

To fetch workflow runs from the repository, run the following command:

```bash
smm pipelines fetch --start-date 2025-01-01 --end-date 2025-12-10
```

This command fetches pipelines created between January 1, 2025, and December 10, 2025. You can adjust the dates as
needed. If you want to fetch all runs, you can omit the date filters. However, be aware that fetching a large number of
change requests may take a while and could hit GitHub API rate limits.

Pipelines are associated with jobs, to fetch the jobs associated with the fetched pipelines, run the following command:

```bash
smm pipelines fetch-jobs --start-date 2025-01-01 --end-date 2025-12-10
```

Like the change request comments, the jobs fetched are based in the pipelines already fetched, so ensure you run the
`smm pipelines fetch` command first.

## Data quality

Once data is fetched, you might want to check the quality of it and if the data matches the expected values. To achieve that,
SMM has a summary command that shows basic information about the quality of the data. Such as:

It will print a summary of the change requests fetched, including:

- Total change requests (total_change_requests): The total number of change requests.
- First change request (first_change_request): Details of the first change request.
- Last change request (last_change_request): Details of the last change request.
- Merged change requests (merged_change_requests): The number of change requests that were merged.
- Closed change requests (closed_change_requests): The number of change requests that were closed but not merged.
- Change requests Without Conclusion (change_requests_without_conclusion): The number of change requests that are neither closed nor merged.
- Unique Authors (unique_authors): The number of unique authors who created change requests.
- Unique Labels (unique_labels): The number of unique labels used across change requests.
- Labels (labels): A list of all unique labels used in change requests.

The command to get the summary is:

```bash
smm change-requests summary
```

## Visualizing the data

Now that you have fetched the data, you can visualize it using the dashboard application provided by Software Metrics
Machine. To start the dashboard, run the following command:

```bash
smm dashboard serve
```

For large repositories or long date ranges, start the dashboard with a larger Node.js heap:

```bash
NODE_OPTIONS="--max-old-space-size=8192" smm dashboard serve
```

This will start a local server, and you can access the dashboard by navigating to `http://localhost:3000` in
your web browser.

[Happy exploring!](features.md)
