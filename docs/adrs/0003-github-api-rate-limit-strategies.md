# ADR 0003: GitHub API Rate Limit Mitigation Strategies

Date: 2026-06-13

Status: Accepted (Phase 1 & 2 implemented; Phase 3 deferred)

## Context

When fetching large amounts of historical data from GitHub (pull requests, workflow runs, jobs), the `--update` flag across all fetch commands performs incremental data synchronization by fetching only items newer than the latest cached timestamp. Despite this optimization, two problems remain:

1. **Rate limit exhaustion**: GitHub's REST API v3 enforces 5,000 authenticated requests per hour per token. For repositories with years of history and many PRs (thousands of pages), a cold fetch or a large date range sweep can exhaust this limit. Even incremental `--update` on a busy repo can burn through calls on paginated PR comments.

2. **Secondary rate limits**: GitHub also enforces secondary rate limits (abuse detection) that trigger 403/429 responses when requests come in too quickly, causing hard failures with no retry logic.

3. **Inefficient data retrieval**: The current implementation has several inefficiencies that amplify API usage:
   - **PRs**: Date filtering is done client-side after fetching all pages — the API returns items in descending creation order but there is no `since` parameter used to short-circuit pagination (`github-pr-client.ts:82-84`).
   - **PR comments**: Every page is fetched sequentially per PR, one PR at a time — no parallelism.
   - **Workflows**: Day-by-day fetching (`github-workflow-client.ts:42-44`) runs sequentially with no parallelism.
   - **No conditional requests**: No `If-None-Match` / `If-None-Match` headers are sent, so even when data hasn't changed, a full response is returned — and the request still counts against the rate limit.
   - **No rate limit awareness**: The `x-ratelimit-remaining` and `x-ratelimit-reset` headers are never inspected. 429/403 responses are not retried.

For teams with large monorepos or multi-year histories, these issues make `smm prs fetch` and related commands unreliable and time-consuming.

## Decision

We will implement a layered set of mitigations across the GitHub fetch pipeline, prioritised by impact-to-effort ratio:

### Layer 1: Conditional Requests (HTTP ETag / 304 handling)

Send `If-None-Match` (ETag) and `If-None-Match` headers on every API request. When GitHub responds with `304 Not Modified`, the request does **not** count against the rate limit. This is the single highest-impact change for `--update` scenarios on repos that are not in constant active development.

**Scope:** All GitHub clients (`github-pr-client.ts`, `github-workflow-client.ts`, `github-workflow-job-client.ts`).

**Mechanism:**
- Store `ETag` from the response headers alongside the cached data (in memory during a run, or persisted in a metadata file for cross-run persistence).
- On subsequent requests, send `If-None-Match: <etag>`.
- On 304, return the previously cached data without re-processing.

Conditional requests are free (no rate limit cost) when data hasn't changed, and cheap (still counts as one request) when it has.

### Layer 2: Rate Limit Awareness & Retry Logic

Inspect `x-ratelimit-remaining` and `x-ratelimit-reset` headers after every API call. When remaining drops below a configurable threshold (default: 100), sleep until the reset time plus a safety margin.

For 429 (too many requests) and 403 (secondary rate limit) responses, implement exponential backoff with jitter:
1. Wait 1s + jitter, retry
2. Wait 2s + jitter, retry
3. Wait 4s + jitter, retry
4. Up to a configurable max (default: 5 retries)

**Scope:** Axios interceptors or response wrapper in each client class.

### Layer 3: Server-Side Pagination Optimization for PRs

Replace the client-side date filter break (`github-pr-client.ts:82-84`) with a `since` query parameter. GitHub's PR list endpoint supports `sort=created&direction=desc&since=<ISO timestamp>`, which allows the server to return only PRs created/updated after a given date, making pagination stop much earlier.

This directly improves `--update` performance: instead of fetching all pages and breaking when items predate the start, we fetch only the pages GitHub says are relevant.

### Layer 4: Parallel Day Fetching for Workflows

Replace the sequential day-by-day loop in `github-workflow-client.ts:42-44` with concurrent day fetching using a bounded concurrency pool (default: 5 concurrent days). This dramatically reduces wall-clock time for large date ranges without increasing total API usage.

### Layer 5: Token Rotation (Future)

Provide an optional `SMM_GITHUB_TOKEN_POOL` environment variable accepting a comma-separated list of tokens. The client cycles through them for each request or each page, multiplying the effective rate limit.

This is lower priority because it requires users to create and manage multiple tokens, and Layer 1 (conditional requests) eliminates the majority of wasteful requests.

### Layer 6: GraphQL API (Long-term)

The GitHub GraphQL API v4 can fetch PRs, comments, reviews, and commits in a single query per PR. This could reduce requests from `1 (PR list) + N (comment pages per PR)` to `1 (paginated PRs with embedded comments)`. However, GraphQL has a different rate limit model (points, not requests), and the migration requires rewriting the entire client layer. This is deferred until the REST-based layers above are proven insufficient.

## Implementation Phasing

### Phase 1 (immediate)
- Conditional requests (Layer 1) — `~20 lines per client`
- Rate limit awareness with sleep on low remaining (Layer 2, partial) — `~30 lines in an axios interceptor`
- Server-side `since` parameter for PRs (Layer 3) — `~5 lines`

### Phase 2 (near-term)
- 429/403 exponential backoff with jitter (Layer 2, complete) — `~40 lines`
- Parallel day fetching for workflows (Layer 4) — `~25 lines`

### Phase 3 (future)
- Token rotation (Layer 5)
- GraphQL client (Layer 6)

## Consequences

### Positive

- **Dramatic reduction in rate limit consumption** for `--update` on quiet repos — 304s cost zero requests.
- **Graceful degradation on busy repos** — rate limit awareness prevents hard failures.
- **Faster cold fetches** for workflows with parallel day fetching.
- **Less wasted bandwidth** for PR pagination with server-side date pruning.
- **Backward compatible** — all changes are transparent to existing CLI commands and flags.

### Negative

- **Slight latency increase** on cache misses — the ETag comparison adds a round-trip even when data has changed (still cheaper than re-fetching all pages).
- **Token rotation adds operational complexity** (Phase 3).
- **ETag storage** requires either in-memory tracking (lost between runs) or a small metadata file on disk. Full cross-run persistence adds ~50 lines of infrastructure.

### Neutral

- **Per-request overhead** of reading/writing response headers is negligible.
- **GraphQL migration** (Phase 3) would be a significant rewrite but is deferred until necessary.
- **No change to the CLI interface or flags** — all improvements are transparent to users.

## Alternatives Considered

1. **Do nothing**: Rate limits would continue to cause failures on large repos. Not viable.

2. **Resumable pagination only**: Already partially implemented for pipelines/jobs (`workflows_progress.json`, `jobs_progress.json`). Helps with crashes but does nothing to reduce total API usage. Complementary, not a replacement.

3. **GH Archive (gharchive.org)**: Pre-processed event data for public repos could provide PR and issue data without any API calls. However, GH Archive does not contain workflow run data or PR comments, and provides no authentication for private repos. Not a complete solution.

4. **GitHub CLI (`gh`) as transport**: Delegating to the `gh` CLI binary (similar to how the GitLab provider uses `glab`) would handle auth and some throttling transparently, but adds a binary dependency and makes cross-platform support harder.

5. **GitHub App Installation tokens**: Provide higher rate limits (5,000 per installation vs per user). Requires creating and installing a GitHub App. Worth considering for team deployments but adds setup overhead.

6. **Increased `per_page` to 100**: Already the maximum for GitHub's API. No further improvement possible.

7. **Remove `--update` altogether**: The incremental update behaviour would be lost, forcing full re-fetches. This would make rate limit exhaustion worse, not better.

## Notes

The ETag-based conditional request approach is well-documented in GitHub's API documentation:
https://docs.github.com/en/rest/overview/resources-in-the-rest-api#conditional-requests

GitHub recommends conditional requests as the primary strategy for API efficiency, stating: "Use your API quota as efficiently as possible by making conditional requests where possible."

The `since` parameter for Pull Requests is documented at:
https://docs.github.com/en/rest/pulls/pulls#list-pull-requests

Best Practices for Using the REST API
https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api?apiVersion=2026-03-10

This ADR does not supersede any prior ADR. It introduces new infrastructure alongside the existing fetch pipeline.

Response headers to inspect for rate limit awareness: https://docs.github.com/en/rest/using-the-rest-api/getting-started-with-the-rest-api?apiVersion=2026-03-10#about-the-response-code-and-headers