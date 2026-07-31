---
outline: deep
---

# SonarQube

This guide covers how to configure and use SonarQube with Software Metrics Machine (SMM).

## What is supported

SMM supports SonarQube in three interfaces:

- CLI via the `smm sonarqube` command group
- REST API under `/sonarqube/*`
- Dashboard tab: `SonarQube`

## Configuration

Set `SMM_STORE_DATA_AT` to the folder that contains your `smm_config.json` file.

```bash
export SMM_STORE_DATA_AT=/path/to/data
```

Example `smm_config.json`:

```json
{
  "projects": [
    {
      "git_provider": "github",
      "github_repository": "owner/repo",
      "git_repository_location": "/path/to/repository",
      "sonar_url": "https://sonarqube.example.com",
      "sonar_token": "your_sonar_token",
      "sonar_project": "project_key"
    }
  ]
}
```

## CLI commands

### Fetch quality measures

```bash
smm sonarqube fetch-measures
```

Common options:

- `--metrics`: comma-separated metric keys
- `--output`: `text` or `json`

Example:

```bash
smm sonarqube fetch-measures --metrics coverage,complexity,sqale_rating --output json
```

### Fetch component tree

```bash
smm sonarqube fetch-component-tree
```

Common options:

- `--component`: component key (defaults to configured project)
- `--depth`: depth (`-1` for full traversal)
- `--metrics`: comma-separated metric keys
- `--output`: `text` or `json`

Example:

```bash
smm sonarqube fetch-component-tree --depth -1 --metrics complexity,cognitive_complexity,ncloc
```

### Fetch historical measures

```bash
smm sonarqube fetch-historical-measures
```

Common options:

- `--metrics`: comma-separated metric keys
- `--start-date`: `YYYY-MM-DD`
- `--end-date`: `YYYY-MM-DD`
- `--save`: save result JSON to a file
- `--output`: `text` or `json`

Example:

```bash
smm sonarqube fetch-historical-measures \
  --metrics sqale_rating,coverage,duplicated_lines_density \
  --start-date 2025-01-01 \
  --end-date 2025-12-31 \
  --save sonarqube-history.json \
  --output json
```

### Run local analysis

Run a local SonarQube server and scanner using Docker:

```bash
smm sonarqube analysis run
```

Options:

- `--container-server-name`: SonarQube container name (default: `sonarqube`)
- `--scanner-container-name`: Scanner container name (default: `sonarqube-scanner`)
- `--container-server-image`: SonarQube Docker image (default: `sonarqube:community`)
- `--scanner-image`: Scanner Docker image (default: `sonarsource/sonar-scanner-cli`)
- `--data-dir`: Host path for SonarQube data (default: `./sonarqube_data`)
- `--server-port`: Host port for SonarQube (default: `9000`)
- `--scanner-host-url`: Override scanner host URL
- `--scanner-token`: Scanner authentication token
- `--properties`: Raw scanner options
- `--admin-user`: SonarQube admin username (default: `admin`)
- `--admin-password`: SonarQube admin password (default: `admin`)

This command starts the SonarQube server (if not already running), executes sonar-scanner
against your local repository, and automatically fetches quality measures, component tree,
and historical measures once the analysis completes.

## REST API

Main endpoints:

- `GET /sonarqube/quality`
- `GET /sonarqube/component-tree`
- `GET /sonarqube/measurements`
- `GET /sonarqube/measurements/history`
- `GET /sonarqube/component-tree/history`

See [REST API](./rest-api.md) for details.

## Dashboard usage

Open dashboard:

```bash
smm dashboard serve
```

Then open the `SonarQube` tab. The dashboard includes:

- **Reliability Rating**: top-level reliability score from the main component.
- **Security Rating**: top-level security score from the main component.
- **Maintainability Rating**: top-level maintainability score from the main component.
- **Duplication Density**: duplicated lines density from the main component.
- **SonarQube Measurements**: current metric values and historical measurement snapshots.
- **Top N by Complexity**: components with the highest cyclomatic complexity.
- **Top N by NLOC**: largest components by non-commented lines of code.
- **Component Tree Metrics**: sortable component table with complexity, cognitive complexity, NLOC, coverage, and maintainability.
- **Component Tree Metrics History**: historical component trends for file-level components.

Several cards include target info popovers with metric targets, explanations, and supporting sources. Component names,
complexity, and cognitive complexity values link to SonarQube pages when `sonar_url` and `sonar_project` are configured.

Use filters for:

- include patterns
- ignore patterns
- remove folders
- top entries

### SonarQube dashboard filters

| Dashboard filter               | Backend query parameter |
|--------------------------------|-------------------------|
| `ignorePatternFiles`           | `ignore_files`          |
| `includePatternFiles`          | `include_files`         |
| `sonarqubeRemoveFolders`       | `remove_folders=true`   |
| `topEntries`                   | Dashboard display limit |

The shared date picker, timezone behavior, saved views, and tab navigation are documented in
[Dashboard](./features/dashboard.md).

### Pattern filtering notes

For include and ignore patterns:

- Plain text values perform substring match.
- Glob-like patterns are supported (`*`, `**`, `?`).
- If the pattern has no `/`, matching is applied to file name (basename).
