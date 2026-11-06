---
outline: deep
---

# Issue tracking providers

Software Metrics Machine reads issues from one configurable issue tracker per project. Set
`issues_provider` to `jira`, `github`, or `jira-csv`; the CLI, REST API, MCP server and metric catalog
all use the same source.

> [!IMPORTANT]
> Before following the steps below, make sure you have followed the [Getting Started](./getting-started.md)
> guide to set up the project.

## Choosing a provider

```json
{
  "projects": [
    {
      "git_provider": "github",
      "github_repository": "owner/repo",
      "github_token": "ghp_...",
      "issues_provider": "github",
      "git_repository_location": "/path/to/repo"
    }
  ]
}
```

`issues_provider` is optional and defaults to `jira`, so existing Jira projects keep working
without a configuration change.

| Value      | Source                   | Required settings                                              |
| ---------- | ------------------------ | -------------------------------------------------------------- |
| `jira`     | Jira Cloud REST API      | `jira_url`, `jira_email`, `jira_token`, `jira_project`         |
| `github`   | GitHub REST API          | `github_repository` (`owner/repo`), `github_token`             |
| `jira-csv` | Jira CSV export on disk  | A `Jira.csv` export in the project data directory              |

Project-specific environment variables are also supported:

```bash
export OWNER_REPO_ISSUES_PROVIDER="github"
export OWNER_REPO_GITHUB_TOKEN="ghp_..."
```

### GitHub token scopes

- Public repositories: a token with public read access is enough.
- Private repositories: the token needs the `repo` scope.
- The same token used for change requests and pipelines can be reused.

### Jira setup

To read issues from Jira Cloud you need an API token associated with your Atlassian account.

1. Open <https://id.atlassian.com/manage-profile/security/api-tokens>.
2. Click **Create API token**.
3. Give it a label such as `software-metrics-machine`.
4. Copy the token immediately — Atlassian only shows it once.
5. Add it to the project configuration together with your Jira URL, email and project key:

```json
{
  "issues_provider": "jira",
  "jira_url": "https://your-domain.atlassian.net",
  "jira_email": "your-email@example.com",
  "jira_token": "your_jira_api_token",
  "jira_project": "PROJ"
}
```

The token inherits your Jira permissions, so the account must be able to browse the configured
`jira_project`. You can verify the credentials before running SMM:

```bash
curl -u "$JIRA_EMAIL:$JIRA_TOKEN" "$JIRA_URL/rest/api/3/myself"
```

A JSON payload with your user information means the token works. The [Jira provider](./jira.md)
page covers the full connection check and configuration reference.

### Jira CSV export (no API connection)

If you cannot or do not want to connect to Jira, export the issues from Jira and place the file at:

```
<SMM_STORE_DATA_AT>/<project>/Jira.csv
```

`<project>` is the same project folder SMM uses for the repository — the directory that contains
`smm.sqlite` and the provider subfolders, typically
`<store_data>/<git_provider>_<owner_repo>`. The file name is case-sensitive: `Jira.csv`.

Configure the project to use the file instead of the API:

```json
{
  "issues_provider": "jira-csv",
  "jira_url": "https://your-domain.atlassian.net"
}
```

No `jira_email`, `jira_token` or `jira_project` is required for this mode. `jira_url` is optional and
is only used to build browsable issue links.

The export is read using its `Summary`, `Issue key`, `Issue Type`, `Status`, `Project key`,
`Assignee`, `Created`, `Updated`, `Resolved`, `Labels`, `Description` and `Comment` columns.
Repeated `Labels` and `Comment` columns are supported, which is how Jira exports multiple labels and
comments per issue.

> [!NOTE]
> The CSV is a snapshot. After replacing the file, run `smm issues fetch --force` to refresh the
> cache. CSV timestamps carry no timezone, so SMM interprets them as UTC. Comments are read from the
> `Comment` columns and cached by `smm issues fetch-comments`.

## Fetching issues

```bash
smm issues fetch [OPTIONS]
```

| Option               | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `--start-date DATE`  | Issues created on or after this ISO date or datetime     |
| `--end-date DATE`    | Issues created on or before this ISO date or datetime    |
| `--status STATUS`    | Jira status name, `open` / `closed` on GitHub, or the exported CSV status |
| `--label LABELS`     | Comma-separated labels (Jira `labels in`, GitHub `labels`) |
| `--force`            | Re-fetch even when the cache already has data            |
| `--update`           | Fetch only items updated since the latest cached item    |
| `--output FORMAT`    | `text` or `json` (default: `text`)                       |

Examples:

```bash
smm issues fetch --start-date 2026-01-01 --end-date 2026-03-31
smm issues fetch --status open --label bug,backend
smm issues fetch --update
```

## Fetching comments

```bash
smm issues fetch-comments [OPTIONS]
```

| Option              | Description                                                       |
| ------------------- | ----------------------------------------------------------------- |
| `--issue KEY`       | Fetch comments for one issue (`PROJ-123`, or `123` / `#123` on GitHub) |
| `--start-date DATE` | Comment creation start boundary                                   |
| `--end-date DATE`   | Comment creation end boundary                                     |
| `--force`           | Replace cached comments                                           |
| `--update`          | Merge comments updated since the latest cached comment            |
| `--output FORMAT`   | `text` or `json` (default: `text`)                                |

Examples:

```bash
# One issue
smm issues fetch-comments --issue PROJ-123

# Every comment created in a window
smm issues fetch-comments --start-date 2026-01-01 --end-date 2026-03-31

# Incremental update
smm issues fetch-comments --update
```

When neither `--issue` nor a date window is given, SMM fetches all comments. On Jira that is an
N+1 flow — one comments request per matching issue — so the CLI prints a warning before starting.
GitHub has a repository-wide comments endpoint and the Jira CSV provider reads comments from the
export, so neither needs the warning.

There is no `smm issues fetch-changelog` command. Jira changelog and GitHub timeline history are
not fetched in this version.

## Data storage

Fetched data is stored under the project data directory:

```
<store_data>/
└── <git_provider>_<owner_repo>/
  ├── Jira.csv                  # jira-csv export (user-provided)
  └── <issues_provider>/
    ├── issues.json
    └── comments.json
```

The default Jira layout is unchanged (`jira/issues.json`), so existing data needs no migration.
GitHub issues live under `github/`, and Jira CSV exports are cached under `jira-csv/`. Both are
independent of `git_provider`.

## REST and MCP

- `GET /api/metrics/issues` returns `{ provider, totalIssues, issues }`.
- MCP tool `smm_get_issue_metrics` uses the same configured provider.
- Comments are cached by the CLI but are not exposed by REST or MCP yet.

## Limitations

- GitHub issue timeline events, milestones, projects and sub-issues are not fetched.
- Jira comment windows are resolved by first finding issues updated inside the window, then
  fetching each issue's comments.
- The `jira-csv` provider reads a snapshot. Replacing `Jira.csv` requires `smm issues fetch --force`,
  and CSV timestamps are interpreted as UTC because the export carries no timezone.
- Switching `issues_provider` requires a fresh fetch; issues and comments from different
  providers are stored in separate directories.

## Next steps

- Combine issue data with [change requests](./features/change-requests.md) and
  [pipelines](./features/pipelines.md) for delivery metrics.
- Inspect available metrics with `smm metrics list`.
