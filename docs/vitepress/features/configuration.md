---
outline: deep
---

# Configuration

Configuration is stored in `smm_config.json` inside the folder referenced by `SMM_STORE_DATA_AT`.

## Data directory resolution

The data directory is resolved in this order:

1. The `SMM_STORE_DATA_AT` environment variable, when set.
2. The `store_data_at` value saved in the user settings file (`$XDG_CONFIG_HOME/smm/config.json`, falling back to
   `~/.config/smm/config.json`).

The environment variable always wins over the saved default. When neither is present, SMM asks you to configure a
project or fails with an error explaining that `SMM_STORE_DATA_AT` is required.

```bash
export SMM_STORE_DATA_AT=/absolute/path/to/data-folder
```

After running `smm project configure` once, the data directory is saved to the user settings file, so you no longer
need to export `SMM_STORE_DATA_AT` in every shell session. Set the environment variable to temporarily use a different
data directory.

> [!IMPORTANT]
> Use a different folder than the cloned repository to store the data, to avoid any accidental deletion or data changes.

## Configure a project interactively

The easiest way to create or update `smm_config.json` is the interactive wizard:

```bash
smm project configure
```

The wizard covers the core keys in the [Key reference](#key-reference) table and handles the data directory setup for
you. See [Project management](../project.md) for the full wizard walkthrough and `smm project list`.

## Configuration format

For advanced setups the wizard does not cover (such as `deployment_frequency_targets`, `dashboard_start_date`, or
multiple projects at once), create or edit `smm_config.json` by hand. SMM uses a multi-project configuration format.
Wrap your project configurations in a `projects` array:

```json
{
  "projects": [
    {
      "git_provider": "github",
      "github_token": "your_github_token",
      "github_repository": "your-org/frontend-app",
      "git_repository_location": "/absolute/path/to/frontend-app",
      "deployment_frequency_targets": [
        { "pipeline": ".github/workflows/ci.yml", "job": "deploy" }
      ],
      "main_branch": "main",
      "timezone": "Europe/Madrid",
      "dashboard_start_date": "2025-01-01",
      "dashboard_end_date": "2025-12-31",
      "dashboard_color": "#1976d2",
      "log_level": "INFO"
    },
    {
      "git_provider": "github",
      "github_token": "your_github_token",
      "github_repository": "your-org/backend-api",
      "git_repository_location": "/absolute/path/to/backend-api",
      "main_branch": "main",
      "jira_url": "https://your-domain.atlassian.net",
      "jira_email": "your-email@example.com",
      "jira_token": "your_jira_token",
      "jira_project": "API"
    },
    {
      "git_provider": "gitlab",
      "gitlab_token": "glpat-your-gitlab-token",
      "github_repository": "your-group/infra-config",
      "git_repository_location": "/absolute/path/to/infra-config",
      "main_branch": "main",
      "timezone": "UTC"
    }
  ]
}
```

### Selecting a project

When you have multiple projects, select which one to use with the CLI global option:

```bash
smm --project your-org/frontend-app change-requests fetch
```

If `smm_config.json` has more than one project and `--project` is not provided, SMM uses the first project in the
`projects` array. Project-specific environment variables are then resolved with that first project's
`github_repository` prefix.

In the dashboard, configured projects appear in the project drawer. Selecting a project stores the repository name in the
`smm_active_project` browser cookie and reloads the current page without stale filter query parameters.

### Project-specific environment variables

Project configuration can be provided through project-specific environment variables instead of `smm_config.json`.
Uppercase the `github_repository` value, replace non-alphanumeric characters with underscores, and append the setting
environment variable name:

```bash
export YOUR_ORG_FRONTEND_APP_GITHUB_TOKEN=ghp_frontend
export YOUR_ORG_FRONTEND_APP_JIRA_TOKEN=jira_token
export YOUR_ORG_FRONTEND_APP_SMM_TIMEZONE=Europe/Madrid
```

For example, `github_repository` value `your-org/frontend-app` maps `GITHUB_TOKEN` to
`YOUR_ORG_FRONTEND_APP_GITHUB_TOKEN`, `JIRA_TOKEN` to `YOUR_ORG_FRONTEND_APP_JIRA_TOKEN`, and so on.

Supported project-specific environment variable suffixes are:

- `GIT_PROVIDER`
- `GITHUB_TOKEN`
- `GITLAB_TOKEN`
- `GITLAB_URL`
- `GIT_REPOSITORY_PATH`
- `LOGGING_LEVEL`
- `JIRA_URL`
- `JIRA_EMAIL`
- `JIRA_TOKEN`
- `JIRA_PROJECT`
- `SONAR_URL`
- `SONAR_TOKEN`
- `SONAR_PROJECT`
- `STORE_LOGS`
- `SMM_TIMEZONE`
- `SMM_STORAGE_TYPE`

The only global environment variable used by configuration loading is `SMM_STORE_DATA_AT`. Generic variables such as
`GITHUB_TOKEN`, `JIRA_TOKEN`, `SONAR_TOKEN`, `SMM_TIMEZONE`, or `GIT_REPOSITORY_PATH` are not used. When
`SMM_STORE_DATA_AT` is not set, the data directory is resolved from the `store_data_at` value in the user settings
file (see [Data directory resolution](#data-directory-resolution)).

Project-specific `GITHUB_TOKEN` takes precedence over project `github_token` and root `github_token`. Other
project-specific environment variables are used only when the selected project does not set the corresponding
`smm_config.json` key, except `LOGGING_LEVEL`, which overrides `log_level`.

## Dashboard configuration

These keys affect dashboard behavior:

- `dashboard_start_date` and `dashboard_end_date`: default dashboard date range when no URL filters are provided.
- `dashboard_color`: theme color value exposed by the configuration API.
- `deployment_frequency_targets`: pipeline/job pairs used by the Insights deployment frequency chart.
- `timezone`: configured project timezone for CLI and provider fetch behavior.

Dashboard filtering uses the browser timezone and sends it as the `timezone` query parameter. This keeps dashboard
date-time filtering aligned with the user viewing the dashboard. See [Dashboard](./dashboard.md) for shared dashboard
behavior.

## Timezone configuration

Set `timezone` in each project to an IANA timezone identifier such as `Europe/Madrid`, `America/New_York`, or `UTC`.
This value is used by CLI commands when they interpret date-only filters and group time-based metrics.

```json
{
  "projects": [
    {
      "github_repository": "your-org/frontend-app",
      "timezone": "Europe/Madrid"
    }
  ]
}
```

If `timezone` is omitted from the selected project, CLI commands use the project-specific `SMM_TIMEZONE` environment
variable. If neither is set, SMM uses `UTC`.

```bash
export YOUR_ORG_FRONTEND_APP_SMM_TIMEZONE=Europe/Madrid
smm --project your-org/frontend-app change-requests summary --start-date 2026-01-01 --end-date 2026-01-31
```

For client dashboards and REST API calls, send the browser or viewer timezone as the `timezone` query parameter. The
dashboard does this automatically from the browser's `Intl.DateTimeFormat().resolvedOptions().timeZone` value. REST API
clients should pass the same kind of IANA identifier:

```text
/change-requests/summary?start_date=2026-01-01&end_date=2026-01-31&timezone=Europe%2FMadrid
```

Date-only filters such as `2026-01-01` are expanded to the beginning or end of that day in the selected timezone.
Offset-aware date-time values such as `2026-01-01T09:00:00+01:00` are treated as exact instants.

## Key reference

| Key | Description | Required |
|-----|-------------|----------|
| `git_provider` | Git provider (`github` or `gitlab`) | Yes |
| `github_token` | GitHub personal access token | Yes for GitHub change request/pipeline |
| `gitlab_token` | GitLab personal access token | Yes for GitLab MR/pipeline |
| `gitlab_url` | GitLab instance URL for self-hosted GitLab (e.g. `https://gitlab.example.com`). Used for both `glab api --hostname` provider calls and dashboard links. No effect when `git_provider` is not `gitlab`. | No |
| `github_repository` | Repository in `owner/repo` format (also used as project identifier) | Yes |
| `git_repository_location` | Local clone path for git/code metrics. When left empty during `smm project configure`, the repository is cloned automatically and this path is filled in. See [Project management](../project.md#cloning-the-repository-automatically). | Yes for source-code metrics |
| `deployment_frequency_targets` | Deployment frequency workflow/job targets as `{ "pipeline": "...", "job": "..." }` objects | No |
| `main_branch` | Main branch name | No |
| `dashboard_start_date` | Default start date in dashboard | No |
| `dashboard_end_date` | Default end date in dashboard | No |
| `dashboard_color` | Dashboard color theme value | No |
| `log_level` | Logging level (`DEBUG`, `INFO`, `WARN`, `ERROR`, `CRITICAL`) | No |
| `jira_url` | Jira base URL | No |
| `jira_email` | Jira account email | No |
| `jira_token` | Jira API token | No |
| `jira_project` | Jira project key | No |
| `sonar_url` | SonarQube server URL | No |
| `sonar_token` | SonarQube token | No |
| `sonar_project` | SonarQube project key | No |
| `sonar_local_runner_token` | SonarQube local analysis runner token (generated by local analysis) | No |
| `store_logs` | Store log files to disk (`true`/`false`) | No |
| `timezone` | IANA timezone identifier (for example `Europe/Madrid`, `UTC`) | No |
