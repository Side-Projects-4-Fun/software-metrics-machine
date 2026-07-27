---
outline: deep
---

# Supported providers

This project integrates with source control providers and code analysis systems to fetch and visualize development metrics.

## Supported Source Control Providers

### Github

If you are using [GitHub and GitHub Actions](./github.md), the following are supported:

- Insights
- Pipelines
- Pull requests
- Source code analysis via local git repository

### GitLab

If you are using [GitLab](./gitlab.md), the following are supported:

- Insights
- Pipelines
- Merge requests (pull requests)
- Source code analysis via local git repository

### Bitbucket

If you are using Bitbucket, the following are currently supported:

- Source code analysis via git

## Issue Tracking Systems

### Jira

If you are using [Jira](./jira.md), the following metrics are supported:

- Issues and issue properties via REST and CLI fetch
- Issue filtering by status and date range

## Code analysis tools

### Codemaat

[Git](./codemaat.md) is the common data source for code metrics regardless of hosting vendor.

Supported metrics include:

- Code churn
- File coupling
- Entity churn
- Entity effort
- Entity ownership
- Pairing index

### SonarQube

SonarQube is supported in CLI, REST, and dashboard.

See [SonarQube](./sonarqube.md) for setup and usage.
