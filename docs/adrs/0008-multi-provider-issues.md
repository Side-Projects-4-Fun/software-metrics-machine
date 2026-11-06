# ADR 0008: Multi-Provider Issue Tracking (Jira + GitHub)

Date: 2026-11-04

Status: Accepted (2026-11-06)

## Context

Issue tracking was the last first-class metrics area still bound to a single vendor. The `issues`
domain only understood Jira, and the Jira client was constructed independently in the CLI, REST
module and MCP server. There was no provider abstraction, no issue factory, and the catalog and
documentation described the source as Jira-only.

At the same time, SMM already treats other provider-backed domains as interchangeable:

- change requests support GitHub pull requests and GitLab merge requests behind one command group;
- pipelines support both providers behind one factory;
- the domain `Issue` shape is already vendor-neutral;
- GitHub already has the token, repository, rate-limit and retry infrastructure required for a
  second issue source.

The project needs GitHub Issues support without duplicating the Jira path or creating a second
parallel stack for caching, filtering, REST, MCP and the metric catalog. It also needs to serve users
who can export issues from Jira but cannot or do not want to connect to the Jira API. It must keep the
existing data-mutability boundary: only the CLI writes provider data; REST, MCP and the webapp read
cached data.

## Decision

### 1. Provider selection is explicit per project

Each project declares `issues_provider` with the value `jira`, `github`, or `jira-csv`. The field is
optional and defaults to `jira`, so existing projects keep their current behavior and cache layout
with no configuration change or migration.

Selection is never inferred from which credentials happen to be present. A project may legitimately
have both Jira and GitHub credentials, so auto-detection would make the active source ambiguous and
untestable.

### 2. One provider-neutral issue contract

Jira, GitHub, and the Jira CSV export implement the same domain contract for issues and comments.
The domain and the consumers (CLI, REST, MCP, catalog) never branch on vendor. A single factory
selects the client and is the only place that knows which vendor is active.

The contract covers two operations:

- fetch issues with an optional creation window, status and label filters;
- fetch comments either for one issue or for every issue in a comment-creation window.

Provider payloads are normalized into the existing domain `Issue` plus a new `IssueComment` shape.
Additive optional fields (`provider`, `url`, `updatedAt`, `closedAt`) preserve compatibility with
existing cached Jira records.

### 3. GitHub issues are real issues, not pull requests

GitHub's issues endpoint also returns pull requests. The GitHub provider excludes every entry that
carries a `pull_request` marker so the issue set matches the domain concept and the Jira behavior.
Repository-wide GitHub comment queries likewise exclude pull-request conversation comments.

### 4. Comments are a first-class, provider-neutral concern

Comments are fetched and cached separately from issues. They support two modes:

- a single issue (`--issue`), matching the historical per-issue behavior;
- a creation window, so users can retrieve all comments created in a period without naming every
  issue.

The window mode has deliberately different provider costs. GitHub exposes a repository-wide
comments endpoint. Jira does not, so the Jira implementation resolves candidate parent issues by
last update and then reads each issue's comments. That N+1 behavior is accepted, bounded and
surfaced to the user rather than hidden.

### 5. Changelog/timeline history is out of scope, not ported

The previous `fetch-changelog` command was a stub. Jira changelog and GitHub timeline data are
removed from the surface instead of being carried forward or emulated. Keeping an unused method or
a command that only prints guidance would be dead code and a misleading promise.

### 6. Storage is provider-scoped and backward compatible

Issues and comments live under the active issue provider's directory. The Jira location is
unchanged, so existing data requires no migration. GitHub data is stored independently of
`git_provider`, because a project can analyze GitLab merge requests while tracking GitHub issues.

### 7. The CLI is provider-agnostic and the rename is atomic

`smm issues fetch` and `smm issues fetch-comments` are the canonical commands. The old `smm jira`
group is removed in the same change, with no deprecated aliases or compatibility shims.

This follows the precedent in ADR 0005's `smm prs` → `smm change-requests` addendum: when a vendor
name is replaced by a provider-neutral one, the rename is applied atomically across CLI, tests,
documentation and supporting surfaces.

### 8. REST and MCP stay read-only and report the active provider

`GET /api/metrics/issues` keeps its route and query parameters and adds the active provider to its
response. The MCP tool `smm_get_issue_metrics` keeps its name and reads the same configured source.
Neither surface gains write endpoints, cache mutations or fetch-on-read behavior.

Comments are cached by the CLI but are not exposed by REST or MCP in this decision.

### 9. Catalog and documentation stay provider-neutral

The issue catalog entries describe the configured issue tracker rather than Jira. The CLI fetch
command is declared as a catalog surface, generated artifacts are regenerated, and the architecture
documentation no longer describes the issue tracker as Jira-only.

No derived issue metrics (lead time, cycle time, WIP, reopen rate) are added. A derived metric needs
a history source that this decision deliberately does not fetch.

### 10. The Jira CSV export is a first-class, file-backed provider

Users who cannot connect to the Jira API can select `issues_provider: "jira-csv"`. SMM then reads
the Jira export from:

```
<SMM_STORE_DATA_AT>/<project>/Jira.csv
```

`<project>` is the same project data directory that holds `smm.sqlite` and the provider caches. The
file is parsed by a dedicated client that implements the same issue/comment contract as the API
clients, so the repository, CLI, REST API, MCP server and catalog work without a file-specific code
path.

The CSV mode uses the same cache and fetch semantics as the API providers. It also keeps the same
identity model: the issue key is the stable id, labels and repeated comment columns are all read, and
comments are exposed through `smm issues fetch-comments`. `jira_url` remains optional and only
affects browsable issue links.

The CSV provider is explicit, not an automatic fallback. If `Jira.csv` exists but `issues_provider`
is `jira`, SMM still calls the Jira API. This avoids silently switching the source of truth when a
file appears in the data directory.

CSV timestamps carry no timezone; they are interpreted as UTC. The export is a snapshot, so replacing
the file requires `smm issues fetch --force`.

## Interfaces at a glance

The decision exposes the same configured source through four surfaces. The snippets are illustrative, not
implementation contracts.

**Project configuration**

```json
{
  "issues_provider": "github",
  "github_repository": "owner/repo",
  "github_token": "ghp_..."
}
```

Omit `issues_provider` to keep Jira as the default:

```json
{
  "issues_provider": "jira",
  "jira_url": "https://your-domain.atlassian.net",
  "jira_email": "user@example.com",
  "jira_token": "...",
  "jira_project": "PROJ"
}
```

Read a Jira export without an API connection:

```json
{
  "issues_provider": "jira-csv",
  "jira_url": "https://your-domain.atlassian.net"
}
```

**CLI**

GitHub statuses are `open` / `closed`; Jira and the Jira CSV export use the project's status names
(for example `Done`).

```bash
# Issues: creation window, status, labels
smm issues fetch --start-date 2026-01-01 --end-date 2026-03-31 --status open --label bug
smm issues fetch --update
smm issues fetch --output json

# Comments: one issue
smm issues fetch-comments --issue PROJ-123   # Jira
smm issues fetch-comments --issue 123        # GitHub

# Comments: every comment created in a window
smm issues fetch-comments --start-date 2026-01-01 --end-date 2026-03-31
```

**REST**

```http
GET /api/metrics/issues?startDate=2026-01-01&endDate=2026-03-31&status=open
```

```json
{
  "provider": "github",
  "totalIssues": 1,
  "issues": [
    {
      "id": "1234",
      "key": "123",
      "title": "Fix checkout totals",
      "status": "open",
      "assignee": "alice",
      "createdAt": "2026-02-10T09:00:00.000Z",
      "labels": ["bug"]
    }
  ]
}
```

**MCP**

```json
{
  "tool": "smm_get_issue_metrics",
  "arguments": { "status": "open", "startDate": "2026-01-01", "endDate": "2026-03-31" }
}
```

Comments are intentionally absent from the REST and MCP snippets: they are CLI-cached data in this
decision, not a published API surface.

## Rationale

- **Explicit configuration over detection.** It preserves the invariant that a project has exactly
  one active issue source, even when multiple credentials are configured.
- **One contract over merging providers.** Merging Jira and GitHub issues into a single list would
  require source-qualified identities, deduplication rules and a UI that explains mixed sources.
  The provider-neutral contract keeps a future merge possible without paying for it now.
- **Atomic rename over aliases.** `AGENTS.md` forbids compatibility shims, and the repository has
  already executed the same class of rename for change requests. The package is pre-1.0, so the
  breaking change is acceptable and well documented.
- **Comments as data, not metrics.** Fetching and caching comments is useful for future analysis,
  but the catalog is reserved for computed metrics.
- **No fabricated analytics.** Timeline history is unavailable, so adding cycle-time metrics now
  would produce numbers without evidence.
- **CSV as a provider, not a fallback.** A file-backed provider keeps the same contract and gives
  offline users the same metrics, while an explicit `issues_provider` prevents a stray `Jira.csv`
  from silently replacing the API source.

## Consequences

### Positive

- One issue pipeline for Jira, GitHub and the Jira CSV export, with one place to change provider
  selection.
- Existing Jira projects upgrade without configuration or data migration.
- Users who cannot connect to the Jira API can still use the same issue metrics from an export.
- Adding GitLab issues later becomes a new client and one enum value, not another stack.
- CLI, REST, MCP and the catalog remain consistent because they all consume the same configured
  repository.
- Incremental issue updates now use `updatedAt` when available, so edited, closed or relabelled
  older issues are no longer invisible to `--update`.

### Negative / costs

- The `smm jira` command group is removed, which is a breaking CLI change.
- Bulk comment fetching without `--issue` is N+1 on Jira: slower and more rate-limit sensitive than
  the GitHub path.
- Jira changelog and GitHub timeline history remain unavailable, so derived issue metrics stay
  blocked.
- Switching `issues_provider` requires a fresh fetch; provider caches are intentionally separate.
- The Jira CSV provider reads a snapshot, interprets timestamps as UTC, and does not retain author
  display names for comments (the export only carries author ids).

### Neutral / follow-ups

- A webapp issues page is not part of this decision.
- REST and MCP comment read endpoints are follow-ups.
- GitLab issues, milestones, projects, sub-issues and reactions remain out of scope.
- The repository review checklist for this change remains in the pull request, not in this ADR.

## Alternatives considered

1. **Auto-detect the provider from credentials.** Rejected: ambiguous when both Jira and GitHub are
   configured, and impossible to test deterministically.
2. **Merge Jira and GitHub issues into one list.** Rejected for this decision: requires
   source-qualified keys, cross-provider deduplication and mixed-source UX. The provider-neutral
   contract keeps the option open.
3. **Add a separate `smm github-issues` group and a second repository.** Rejected: duplicates
   caching, filtering, REST, MCP and catalog wiring, and recreates the problem this ADR solves.
4. **Keep `smm jira` aliases or a permanent provider-scoped group.** Rejected: aliases are forbidden
   by `AGENTS.md`, and a permanent group would give Jira two entry points for the same operation.
5. **Keep `fetch-changelog` and return "not supported" on GitHub.** Rejected: it preserves a command
   that promises data the system does not fetch.
6. **Add derived issue metrics now.** Rejected: no timeline/history source exists, so the metrics
   would not be evidence-based.
7. **Fall back to `Jira.csv` automatically when the file exists.** Rejected: a file appearing in the
   data directory would silently change the source of truth. The provider must be selected
   explicitly.
8. **Add a one-off `smm issues import` command instead of a provider.** Rejected: it would create a
   second ingestion path and bypass the fetch/cache semantics already shared by the issue
   repository.

## References

- ADR 0005 addendum — `smm prs` → `smm change-requests` atomic rename precedent.
- ADR 0007 — metric catalog as static data with typed implementation bindings.
- `docs/vitepress/issues.md` — provider-neutral user documentation.
- `docs/vitepress/jira.md` — Jira-specific setup.
- `packages/core/src/domain/issues/` — issue repository and provider factory.
