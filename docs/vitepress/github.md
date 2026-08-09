---
outline: deep
---

# GitHub provider

This provider is focused on fetching and visualizing data from GitHub repositories, specifically change requests and
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
   - `pull requests` (for accessing change request data)
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

That is it! You are ready to go and start fetching your data! You now can either use the CLI commands or the dashboard to visualize the data. For that end, you can follow ["Your first analysis with GitHub"](./your-first-analysis-with-github.md) section. In the next section we will explain the limitations of the GitHub API.

## Limitations

### Requests

GitHub however, has a limit on requests that can be done to collect data, which impacts the accessibility and the data
analysis that Metrics Machine can do. For that end, the library has implemented a mechanism of pause and resume to start
off where the last downloaded data has been stored, to avoid missing the data needed.

<https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2022-11-28#primary-rate-limit-for-authenticated-users>
