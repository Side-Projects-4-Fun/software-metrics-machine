---
outline: deep
---

# Architecture

The Architecture feature generates a persisted snapshot of the repository structure, then lets you inspect it as C4-style views in the dashboard or export it from the CLI.

## Generate a snapshot

Run generation after configuring the project git repository. Architecture generation requires `GIT_REPOSITORY_LOCATION` because SMM reads git history and package/source structure, writes the snapshot under the project's SMM data directory, and makes the latest snapshot available to the dashboard.

```bash
smm architecture generate \
  --start-date 2026-01-01 \
  --end-date 2026-01-31
```

Use `--refresh-git` when you want SMM to refresh cached commits before building the snapshot.

```bash
smm architecture generate --refresh-git
```

The text output includes the snapshot id, project, generation time, number of commits considered, and the available views:

```text
=== Architecture Snapshot Generated ===

Snapshot ID: github-com-acme-payments-2026-01-31T12-00-00-000Z
Project: github.com/acme/payments
Generated at: 2026-01-31T12:00:00.000Z
Commits considered: 84
Views: context (5 nodes / 4 edges), container (4 nodes / 3 edges), component (12 nodes / 10 edges), code (48 nodes / 55 edges)
```

For automation, write the full snapshot as JSON:

```bash
smm architecture generate --output json
```

## Inspect snapshots

List persisted snapshots before choosing one to export or compare.

```bash
smm architecture list-snapshots
```

```text
=== Architecture Snapshots ===

- github-com-acme-payments-2026-01-31T12-00-00-000Z | 2026-01-31T12:00:00.000Z | commits=84 | views=context, container, component, code
```

The JSON format is useful in scripts:

```bash
smm architecture list-snapshots --output json
```

## View architecture in the dashboard

:::tabs key:cli
== Dashboard

Open the Architecture tab after generating at least one snapshot:

```text
/dashboard/architecture
```

The page shows the latest snapshot by default, including the snapshot id, generation timestamp, and commits considered. Use the level tabs to move between `context`, `container`, `component`, and `code` views.

The dashboard renders the selected view as a Mermaid C4 diagram and lists the same elements and relationships below the diagram. Architecture filters share the source-code path controls: `includePatternFiles` limits the view to matching files, and `ignorePatternFiles` removes matching files. These filters are serialized in the dashboard URL and can be saved as views. Shared filter behavior is documented in [Dashboard](./dashboard.md).

== CLI

Export the latest container view as JSON:

```bash
smm architecture export --view container --format json
```

Export a specific snapshot as Mermaid:

```bash
smm architecture export \
  --snapshot-id github-com-acme-payments-2026-01-31T12-00-00-000Z \
  --view component \
  --format mermaid
```

:::

## View levels

| Level       | Use it for |
|-------------|------------|
| `context`   | The system, users, and the SMM containers that generate, serve, and visualize architecture snapshots. |
| `container` | Package-level containers discovered in the repository and their dependencies. |
| `component` | Components grouped under discovered packages. |
| `code`      | Source-file-level relationships. |

If `--snapshot-id` is omitted, `smm architecture export` and the dashboard use the latest persisted snapshot.

## CLI reference

| Command | Purpose |
|---------|---------|
| `smm architecture generate` | Generate and persist an architecture snapshot. |
| `smm architecture list-snapshots` | List persisted snapshot ids and available view levels. |
| `smm architecture export` | Export a view from the latest or selected snapshot. |

### `generate` options

| Option | Description |
|--------|-------------|
| `--start-date <date>` | Start date for git-history input, in `YYYY-MM-DD` format. |
| `--end-date <date>` | End date for git-history input, in `YYYY-MM-DD` format. |
| `--refresh-git` | Force refreshing commits from the git repository. |
| `--output <format>` | Output format: `text` or `json`. Defaults to `text`. |

### `list-snapshots` options

| Option | Description |
|--------|-------------|
| `--output <format>` | Output format: `text` or `json`. Defaults to `text`. |

### `export` options

| Option | Description |
|--------|-------------|
| `--snapshot-id <id>` | Snapshot id to export. Defaults to the latest snapshot. |
| `--view <level>` | View level: `context`, `container`, `component`, or `code`. Defaults to `container`. |
| `--format <format>` | Export format: `json` or `mermaid`. Defaults to `json`. |

## API coverage

The Architecture dashboard tab is backed by:

- `GET /architecture/snapshots`
- `GET /architecture/summary`
- `GET /architecture/view`
