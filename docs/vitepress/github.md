---
outline: deep
---

# GitHub provider

This provider is focused on fetching and visualizing data from GitHub repositories, specifically pull requests and
workflows (pipelines). It leverages the GitHub REST API to gather the necessary information and provides a set of
tools to visualize and analyze the data.

> [!IMPORTANT]
> Before following the steps below, make sure you have followed the [Getting Started](./getting-started.md) guide and completed
> the environment requirements listed there.

You should expect to have the dashboard and the CLI up and running in a few minutes after following the steps below. The
steps that follows are organized as follows.

1. Generating the github token
2. Fetching the data from GitHub
3. Visualizing the data using the dashboard or CLI commands

## Generating the GitHub token

To interact with the GitHub API and fetch the data needed for this project, you need to generate a personal access token.
Follow these steps:

1. Go to your GitHub account settings.
2. Navigate to "Developer settings" > "Personal access tokens" > "Tokens (classic)".
3. Click on "Generate new token" and select the necessary scopes:
   - `repo` (for accessing private repositories if needed)
   - `workflow` (for accessing GitHub Actions workflows)
   - `pull requests` (for accessing pull request data)
4. Generate the token and copy it. Make sure to store it securely, as you won't be able to see it again.
5. Store it in the configuration file `smm_config.json` under the key `github_token`, or use the project-specific token environment variable documented in [Configuration](./features/configuration.md#project-specific-environment-variables).

### Check token is working

To check if the token is working before adding it to SMM configuration, you can set a temporary shell variable and then
do a test request. Start running the following command:

```bash
export TOKEN_TO_TEST=ghp_123123123
```

Once the variables have been set, test your connection with Github with the following command:

```bash
curl -H "Authorization: token $TOKEN_TO_TEST" https://api.github.com/user
```

A JSON response should be return with the user information, something similar to the following:

```json
{
  "login": "user",
  "id": 12312344,
  "node_id": "aaa2",
  "avatar_url": "https://avatars.githubusercontent.com/u/123123?v=4",
  "gravatar_id": ""
  ...other fields
}
```

That is it! You are ready to go and start fetching your data!

## Fetching data

Fetching the data before operating it is the most first step to get started with metrics. This application provides
utilities to fetch data based on date time criteria as it is a standard to use it as a cut off for data analysis. Filters
are optional. [See the CLI documentation for more details](./github/cli.md).

> [!NOTE]
> Fetching data may take a while depending on activity in the repository, by default it fetches
> every pull request and every workflow run in the repository. To fine tune the fetching process, use the options
> available in the [CLI documentation](./github/cli.md).

### Pull requests

For options to fetch pull requests refer to the [CLI documentation](./github/cli-prs.md).

```bash
smm prs fetch
```

### Workflows (pipelines)

For options to fetch workflows and jobs refer to the [CLI documentation](./github/cli-workflows.md).

```bash
smm pipelines fetch
```

## Limitations

### Requests

GitHub however, has a limit on requests that can be done to collect data, which impacts the accessibility and the data
analysis that Metrics Machine can do. For that end, the library has implemented a mechanism of pause and resume to start
off where the last downloaded data has been stored, to avoid missing the data needed.

<https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2022-11-28#primary-rate-limit-for-authenticated-users>

## Visualizing data

This project provides commands to visualize the fetched data using various metrics. Visualization helps in understanding
trends, identifying bottlenecks, and making informed decisions based on the data. The two options to visualize data are:

1. A dashboard (web application) that provides an interactive interface to explore the data.
2. CLI commands that generate charts and display them using matplotlib.

### Dashboard

The web application provides an interactive dashboard to explore the data visually. To start the dashboard, run the
following command:

```bash
smm dashboard serve
```

If the dashboard needs to load a large local dataset, increase the Node.js heap before starting it:

```bash
NODE_OPTIONS="--max-old-space-size=8192" smm dashboard serve
```

On Windows PowerShell:

```powershell
$env:NODE_OPTIONS="--max-old-space-size=8192"; smm dashboard serve
```

### CLI commands

The CLI commands are designed to generate specific charts based on the fetched data. Each command corresponds to a
particular metric or analysis. [See the CLI documentation for more details](./github/cli.md).
