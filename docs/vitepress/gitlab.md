---
outline: deep
---

# GitLab provider

This provider fetches and visualizes data from GitLab repositories, including merge requests (equivalent to pull
requests) and pipelines (CI/CD). It uses the [GitLab CLI (`glab`)](https://gitlab.com/gitlab-org/cli) to interact with
the GitLab API.

> [!IMPORTANT]
> Before following the steps below, make sure you have followed the [Getting Started](./getting-started.md) guide and completed
> the environment requirements listed there. The `glab` CLI must also be installed and authenticated.

The steps are organized as follows:

1. Installing and authenticating the `glab` CLI
2. Creating a GitLab access token
3. Configuring SMM for GitLab
4. Fetching the data
5. Visualizing the data using the dashboard or CLI commands

## Installing and authenticating `glab`

The GitLab provider delegates all API calls to the `glab` CLI. Install it first:

```bash
# macOS
brew install glab

# Linux
# See https://gitlab.com/gitlab-org/cli/-/releases

# Windows
winget install --id GitLab.GitLabCLI
```

Once installed, authenticate with your GitLab instance:

```bash
glab auth login
```

For self-hosted GitLab instances, specify your instance hostname:

```bash
glab auth login --hostname gitlab.example.com
```

## Creating a GitLab access token

The GitLab provider needs a personal access token for API authentication. Follow these steps:

1. Go to your GitLab profile settings.
2. Navigate to **Access Tokens**.
3. Create a new personal access token with the following scopes:
   - `read_api` (for reading merge requests, pipelines, and jobs)
   - `read_repository` (for accessing repository data)
4. Create the token and copy it. Store it securely — you won't see it again.
5. Store it in `smm_config.json` under the key `gitlab_token`, or use the project-specific token environment variable documented in [Configuration](./features/configuration.md#project-specific-environment-variables).

## Configuring SMM for GitLab

Set the `git_provider` to `gitlab` in your project configuration and provide the GitLab-specific keys. Below is a
minimal example:

```json
{
  "projects": [
    {
      "git_provider": "gitlab",
      "gitlab_token": "glpat-your-gitlab-token",
      "github_repository": "your-group/your-project",
      "git_repository_location": "/your/local/repo",
      "timezone": "Europe/Madrid"
    }
  ]
}
```

> [!NOTE]
> The `github_repository` key serves as the project identifier in `owner/repo` format. For GitLab, use your
> project's full path (for example `gitlab-org/gitlab`).

### Self-hosted GitLab instances

If you use a self-hosted GitLab instance, add the `gitlab_url` key to your project configuration. SMM uses it for two
purposes:

1. **API calls**: SMM passes the hostname to `glab api --hostname` so requests target your instance instead of
   `gitlab.com`.
2. **Dashboard links**: links in the web UI point to the correct instance.

```json
{
  "projects": [
    {
      "git_provider": "gitlab",
      "gitlab_url": "https://gitlab.example.com",
      "gitlab_token": "glpat-your-gitlab-token",
      "github_repository": "your-group/your-project",
      "git_repository_location": "/your/local/repo"
    }
  ]
}
```

The `gitlab_url` value should be the base URL of your GitLab instance (for example
`https://gitlab.example.com`). SMM extracts the hostname from the URL and passes it to `glab`. Including a
trailing project path (like `https://gitlab.example.com/your-group/your-project`) also works — only the hostname
part is used for API routing.

Make sure you have authenticated `glab` against the same hostname:

```bash
glab auth login --hostname gitlab.example.com
```

You can also set the instance URL through the project-specific environment variable:

```bash
export YOUR_GROUP_YOUR_PROJECT_GITLAB_URL=https://gitlab.example.com
```

## Checking the token works

To verify the token before using it with SMM, test it with `glab`:

```bash
GITLAB_TOKEN=glpat-your-token glab api /user
```

A successful response returns your user information as JSON.

## What SMM supports for GitLab

The GitLab provider supports the same set of metrics as the GitHub provider:

- **Merge requests** (PRs): title, author, state, labels, dates, and comments
- **Pipelines** (workflows): status, duration, branch, and conclusion
- **Jobs**: individual job names, status, duration, and steps

All CLI commands work transparently with GitLab — use the same `smm prs fetch`, `smm pipelines fetch`, and other
commands. The provider selection is driven by `git_provider` in your configuration.

## Limitations

### `glab` CLI dependency

The GitLab provider requires the `glab` CLI to be installed and authenticated on the machine where SMM runs. It
does not make direct HTTP requests to the GitLab API. Ensure `glab` is available in your `PATH`.

### API rate limits

GitLab applies rate limits to API requests. SMM paginates through large result sets and fetches pipeline details
in batches. If you hit rate limits, `glab` handles retries based on its own configuration.

<https://docs.gitlab.com/ee/security/rate_limits.html>
