# Utility Tools

This section covers utility tools available in Software Metrics Machine that help with data management and processing.

## JSON merge

Merges JSON files from the current directory into a single output file.

## Health Check

Analyzes the quality and completeness of your locally cached data. It checks for missing datasets,
stale data, invalid dates, and coverage gaps across all providers.

```bash
smm health-check
```

| Option           | Description                                         | Example                 |
|------------------|-----------------------------------------------------|-------------------------|
| Provider         | Filter by provider (all, github, jira, sonarqube)   | `--provider=jira`       |
| Max gap days     | Only report gaps larger than this many days         | `--max-gap-days=7`      |
| Output           | Output format (text or json)                        | `--output=json`         |

### Example

```bash
smm health-check --provider=github --max-gap-days=3 --output=text
```
