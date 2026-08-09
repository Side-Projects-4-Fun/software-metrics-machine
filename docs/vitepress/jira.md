---
outline: deep
---

# Jira provider

This provider is focused on fetching and analyzing issues from Jira Cloud.

> [!IMPORTANT]
> Before following the steps below, make sure you have followed the [Getting Started](./getting-started.md) guide to set up
> the project.

You should expect to have Jira integration running after these steps:

1. Generating the Jira API token
2. Configuring Jira connection
3. Fetching issues from Jira
4. Querying issues via CLI or REST

## Generating the Jira API token

To interact with the Jira API and fetch the data needed for this project, you need to generate an API token. Follow these steps:

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token" button
3. Give your token a meaningful label (e.g., "software-metrics-machine")
4. Click "Create" and copy the generated token
5. Store it securely - you won't be able to see it again after leaving the page
6. Store it in `smm_config.json` under the key `jira_token`

### Check token is working

To check if the token is working before adding it to SMM configuration, you can set temporary shell variables and then do
a test request. Start by running the following commands:

```bash
export JIRA_URL_TO_TEST="https://your-domain.atlassian.net"
export JIRA_TOKEN_TO_TEST="your_api_token"
export JIRA_EMAIL_TO_TEST="your-email@example.com"
```

Once the variables have been set, test your connection with Jira using the following command:

```bash
curl -u "$JIRA_EMAIL_TO_TEST:$JIRA_TOKEN_TO_TEST" "$JIRA_URL_TO_TEST/rest/api/3/myself"
```

A JSON response should be returned with your user information, something similar to the following:

```json
{
  "self": "https://your-domain.atlassian.net/rest/api/3/user?accountId=123456",
  "accountId": "123456",
  "accountType": "atlassian",
  "name": "user",
  "email": "user@example.com",
  "avatarUrls": {
    "48x48": "https://...",
    "24x24": "https://...",
    "16x16": "https://...",
    "32x32": "https://..."
  },
  "displayName": "User Name",
  "active": true,
  ...other fields
}
```

That is it, your Jira credentials are ready.

## Configuration

The Jira provider requires these fields in `smm_config.json`:

```json
{
  "projects": [
    {
      "git_provider": "github",
      "github_repository": "owner/repo",
      "git_repository_location": "/path/to/repo",
      "github_token": "your_github_token",
      "jira_url": "https://your-domain.atlassian.net",
      "jira_email": "your-email@example.com",
      "jira_token": "your_jira_api_token",
      "jira_project": "PROJ"
    }
  ]
}
```

### Configuration parameters

- **`jira_url`**: The base URL of your Jira Cloud instance (e.g., `https://your-domain.atlassian.net`)
- **`jira_email`**: Your Jira account email
- **`jira_token`**: Your Jira API token generated from https://id.atlassian.com/manage-profile/security/api-tokens
- **`jira_project`**: The Jira project key you want to analyze (e.g., `PROJ`, `DEV`, `BUG`)

You can also provide these as project-specific environment variables:

```bash
export OWNER_REPO_JIRA_URL="https://your-domain.atlassian.net"
export OWNER_REPO_JIRA_EMAIL="your-email@example.com"
export OWNER_REPO_JIRA_TOKEN="your_api_token"
export OWNER_REPO_JIRA_PROJECT="PROJ"
```

## Fetching data

Fetch issues first, then use metrics endpoints and dashboard.

### Issues

Fetch issues from your Jira project:

```bash
smm jira fetch-issues [OPTIONS]
```

#### Options

- `--start-date DATE`: Start date in ISO 8601 format (YYYY-MM-DD)
- `--end-date DATE`: End date in ISO 8601 format (YYYY-MM-DD)
- `--status STATUS`: Filter by status (e.g., Open, In Progress, Done)
- `--force`: Force re-fetching even if data is already cached
- `--output`: `text` or `json`

#### Examples

Fetch issues with a specific date range:

```bash
smm jira fetch-issues --start-date 2024-01-01 --end-date 2024-03-31
```

Fetch issues in a specific status:

```bash
smm jira fetch-issues --status "In Progress"
```

### Changelog and comments commands

The CLI currently exposes these commands:

```bash
smm jira fetch-changelog --issue PROJ-123
smm jira fetch-comments --issue PROJ-123
```

These two commands currently print guidance and are not full data-fetch implementations in this Node CLI.

## Data Storage

Fetched Jira data is stored under your data directory and provider/repository path.

The Jira repository path follows this shape:

```
<store_data>/
└── <git_provider>_<owner_repo>/
  └── jira/
    └── issues data
```

## Limitations

### API Rate Limiting

Jira Cloud has rate limits on API requests. The Jira provider implements intelligent caching to minimize unnecessary API calls:

- Downloaded data is cached locally
- Use the `--force` flag to re-download data
- Subsequent runs will skip already downloaded data

For more information about Jira API rate limits, see:
https://developer.atlassian.com/cloud/jira/platform/rate-limits/

### Project Access

Ensure that:
- Your API token has access to the configured project
- You have the necessary permissions in Jira to view issues, comments, and history
- The project key is correct and accessible

### Continuous Integration with Git Data

Combine Jira data with GitHub/GitLab data for comprehensive metrics:

```bash
# Fetch both GitHub and Jira data
smm change-requests fetch
smm pipelines fetch
smm pipelines fetch-jobs
smm jira fetch-issues
```

## Troubleshooting

### Authentication Errors

If you receive authentication errors:

1. Verify your Jira URL is correct
2. Check that your API token is valid and not expired
3. Ensure your email address is correct (used for authentication)
4. Verify you have access to the specified project

### Connection Errors

If you cannot connect to Jira:

1. Check your internet connection
2. Verify the Jira URL is accessible
3. Check if your firewall/VPN allows connections to Jira
4. Verify the project key is correct

### No Data Returned

If no issues are returned:

1. Check that the project key is correct
2. Verify the date range includes issues in your project
3. Check issue type and status filters are correct
4. Try fetching without filters: `smm jira fetch-issues`

## Next Steps

Once you have fetched data from Jira, you can:

1. Combine it with git and GitHub data for comprehensive analysis
2. Visualize trends and patterns using dashboard and REST API
3. Use `GET /jira/issues` for service integrations
