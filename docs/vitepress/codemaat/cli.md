# Codemaat CLI Commands for Analysis

This document provides a guide for developers to run Codemaat-related analyses using the CLI commands available in the
`software-metrics-machine` project. Each command is categorized by its functionality.

## Fetch Data

### Fetch Historical Data from Git Repository

```bash
smm code codemaat-fetch --start-date 2026-01-01 --end-date 2026-06-30
```

Fetches historical data from a git repository using Codemaat for analysis.

Options:

```text
--start-date <date>   required
--end-date <date>     required
--subfolder <path>    optional subfolder within the repository to analyze
--group-depth <n>     optional directory depth for auto-generated architecture grouping (default: 2)
--force               regenerate CSV files even if they already exist
--output <format>     text|json (default: text)
```
