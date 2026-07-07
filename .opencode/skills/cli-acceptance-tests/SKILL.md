---
name: cli-acceptance-tests
description: "Acceptance testing workflow for the Software Metrics Machine CLI e2e suite. Use when writing, extending, debugging, or reviewing bashunit acceptance tests under apps/cli/e2e, including command help checks, cached fixture flows, GitHub MSW-backed flows, local git repository fixtures, SMM_STORE_DATA_AT workspaces, and pnpm run test:cli:acceptance. USE FOR: CLI acceptance tests, e2e tests, bashunit, apps/cli/e2e, command smoke tests, persisted CLI output tests. DO NOT USE FOR: unit tests or Vitest tests (use tdd skill), linting (use lint skill), webapp browser tests."
---

# CLI Acceptance Tests

## Scope

Use this skill for acceptance tests in `apps/cli/e2e`. These tests execute the built `smm` CLI through bashunit and verify user-visible behavior: exit status, output text, generated files, and persisted data.

## Test Runner

Run from the repository root:

```bash
pnpm run test:cli:acceptance
```

Run from `apps/cli`:

```bash
pnpm run test:e2e
```

`apps/cli/package.json` builds the CLI before running `e2e/run.sh`. The runner expects bashunit at `apps/cli/lib/bashunit`, or through `BASHUNIT_BIN=/path/to/bashunit`.

If only build verification is needed before running e2e tests:

```bash
pnpm --filter @smmachine/cli build
```

## File Layout

- Test files live in `apps/cli/e2e/commands/*_test.sh`.
- Shared helpers live in `apps/cli/e2e/support/bootstrap.sh`.
- GitHub PR network simulations use `apps/cli/e2e/support/github-prs-msw-runner.mjs`.
- Each test file starts with:

```bash
#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"
```

## Test Function Pattern

Use bashunit function names beginning with `test_`:

```bash
function test_command_help_renders_successfully() {
  run_smm command --help

  assert_smm_success
  assert_smm_output_contains "Usage:"
  assert_smm_output_contains "command"
}
```

Prefer acceptance-level assertions over implementation details. Assert stable output labels, status codes, generated files, and persisted records.

## Helper API

Use helpers from `support/bootstrap.sh`:

- `run_smm <args...>` executes the built CLI and captures `SMM_E2E_STATUS` and `SMM_E2E_OUTPUT`.
- `run_smm_with_github_prs_msw <args...>` runs the command through the GitHub PR MSW runner.
- `create_smm_e2e_workspace` creates a temp workspace under repo `tmp/` with `smm_config.json` and `repo/`.
- `assert_smm_success`
- `assert_smm_failure`
- `assert_smm_output_contains "<text>"`
- `assert_smm_output_not_contains "<text>"`
- `assert_smm_file_exists "<path>"`
- `assert_smm_file_contains "<path>" "<text>"`
- `assert_smm_equals "<expected>" "<actual>"`

Do not call the real GitHub API in acceptance tests. Use cached JSON fixtures or the MSW runner.

## Workspace and Environment Pattern

For tests that need persisted stores:

```bash
function test_command_renders_cached_metrics() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_command_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm command report

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "Report Title"
}
```

Always unset environment variables after `run_smm` before assertions. Common variables:

- `SMM_STORE_DATA_AT` points the CLI at the isolated test workspace.
- `DEBUG=true` enables debug output for fetch tests that assert request details.

## Fixture Patterns

### Cached JSON Stores

Seed stores under the project folder that matches the default config from `create_smm_e2e_workspace`:

```bash
local github_dir="${workspace}/github_acme_widgets/github"
mkdir -p "${github_dir}"

cat >"${github_dir}/prs.json" <<'JSON'
[
  {
    "id": 101,
    "number": 7,
    "state": "closed",
    "title": "Add checkout flow",
    "user": { "id": 501, "login": "alice" },
    "created_at": "2026-01-05T09:00:00Z",
    "updated_at": "2026-01-06T09:00:00Z",
    "merged_at": "2026-01-07T09:00:00Z",
    "html_url": "https://github.com/acme/widgets/pull/7"
  }
]
JSON
```

Use fixed timestamps and deterministic values. Keep fixture records minimal, but include every field required by the command path being exercised.

### Local Git Repositories

For commands that read git history, initialize a real repo inside the workspace:

```bash
git -C "${workspace}/repo" init --initial-branch=main >/dev/null 2>&1
git -C "${workspace}/repo" config user.name "Alice"
git -C "${workspace}/repo" config user.email "alice@example.com"
git -C "${workspace}/repo" config commit.gpgsign false
```

Set `GIT_AUTHOR_DATE`, `GIT_COMMITTER_DATE`, and author identity explicitly when commit order or metrics matter.

### GitHub Fetch Flows

Use the MSW runner for GitHub-backed fetch behavior:

```bash
function test_prs_fetch_persists_pull_requests_from_mocked_github() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"
  export DEBUG=true

  run_smm_with_github_prs_msw prs fetch --force

  unset DEBUG
  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "Fetch data has been completed"
  assert_smm_output_contains "GET /repos/acme/widgets/pulls?state=all"
}
```

## SQLite Assertions

When validating SQLite migrations or persisted database records, prefer a tiny local helper in the relevant test file using `node:sqlite`, as in `apps/cli/e2e/commands/tools_test.sh`. Assert row counts and key fields, not full database dumps.

## Writing New Tests

1. Find the closest existing command test in `apps/cli/e2e/commands`.
2. Add the new case to the relevant `*_test.sh`, or create a new command file if the command group does not exist.
3. Use `run_smm` for local/cached flows and `run_smm_with_github_prs_msw` for mocked GitHub HTTP flows.
4. Use isolated workspaces for any test that reads or writes store data.
5. Assert success or failure explicitly before checking output details.
6. Keep output assertions stable and user-facing.
7. Run `pnpm run test:cli:acceptance`.

## Review Checklist

- The test is deterministic and does not require network access.
- The CLI is exercised through `run_smm` or the MSW runner, not by importing source code.
- Environment variables are unset after command execution.
- Fixtures use fixed dates, authors, IDs, paths, and repository names.
- Assertions cover exit status plus meaningful output or persisted side effects.
- New command groups include a help smoke test where useful.
