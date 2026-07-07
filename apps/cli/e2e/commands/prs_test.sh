#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"

function seed_prs_workspace() {
  local workspace="$1"
  local github_dir="${workspace}/github_acme_widgets/github"

  mkdir -p "${github_dir}"

  cat >"${github_dir}/prs.json" <<'JSON'
[
  {
    "id": 101,
    "number": 7,
    "state": "closed",
    "title": "Add checkout flow",
    "body": "Checkout metrics implementation",
    "user": { "id": 501, "login": "alice" },
    "labels": [{ "id": 1, "name": "feature", "color": "0e8a16" }],
    "created_at": "2026-01-05T09:00:00Z",
    "updated_at": "2026-01-06T09:00:00Z",
    "closed_at": "2026-01-07T09:00:00Z",
    "merged_at": "2026-01-07T09:00:00Z",
    "html_url": "https://github.com/acme/widgets/pull/7"
  },
  {
    "id": 102,
    "number": 8,
    "state": "open",
    "title": "Refine cart metrics",
    "body": "Cart analytics improvements",
    "user": { "id": 502, "login": "bob" },
    "labels": [{ "id": 2, "name": "analytics", "color": "5319e7" }],
    "created_at": "2026-01-12T09:00:00Z",
    "updated_at": "2026-01-12T11:00:00Z",
    "html_url": "https://github.com/acme/widgets/pull/8"
  }
]
JSON

  cat >"${github_dir}/pr-comments.json" <<'JSON'
[
  {
    "id": 9001,
    "url": "https://api.github.com/repos/acme/widgets/pulls/comments/9001",
    "pull_request_url": "https://api.github.com/repos/acme/widgets/pulls/7",
    "body": "Please add a checkout regression test.",
    "user": { "id": 601, "login": "reviewer" },
    "path": "src/cart.ts",
    "created_at": "2026-01-05T13:00:00Z",
    "updated_at": "2026-01-05T13:05:00Z",
    "html_url": "https://github.com/acme/widgets/pull/7#discussion_r9001"
  }
]
JSON
}

function test_prs_help_renders_successfully() {
  run_smm prs --help

  assert_smm_output_contains "Usage:"
  assert_smm_output_contains "prs"
  assert_smm_success
}

function test_prs_fetch_help_renders_successfully() {
  run_smm prs fetch --help

  assert_smm_output_contains "Usage:"
  assert_smm_output_contains "fetch"
  assert_smm_success
}

function test_prs_fetch_comments_help_renders_successfully() {
  run_smm prs fetch-comments --help

  assert_smm_output_contains "Usage:"
  assert_smm_output_contains "fetch-comments"
  assert_smm_success
}

function test_prs_fetch_persists_pull_requests_from_mocked_github() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"
  export DEBUG=true

  run_smm_with_github_prs_msw prs fetch --force

  unset DEBUG
  unset SMM_STORE_DATA_AT

  assert_smm_output_contains "Fetch data has been completed"
  assert_smm_output_contains "Fetching PRs page 1 for acme/widgets"
  assert_smm_output_contains "GET /repos/acme/widgets/pulls?state=all"
  assert_smm_success
}

function test_prs_fetch_comments_persists_comments_from_mocked_github() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"
  export DEBUG=true

  run_smm_with_github_prs_msw prs fetch --force
  run_smm_with_github_prs_msw prs fetch-comments --force

  unset DEBUG
  unset SMM_STORE_DATA_AT

  assert_smm_output_contains "Fetch PR comments data has been completed"
  assert_smm_output_contains "Fetching comments for PR #42 page 1 in acme/widgets"
  assert_smm_output_contains "GET /repos/acme/widgets/pulls/42/comments"
  assert_smm_success
}

function test_prs_summary_renders_statistics_from_cached_pull_requests() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_prs_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm prs summary

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "PRs Summary:"
  assert_smm_output_contains "Total PRs: 2"
  assert_smm_output_contains "Merged PRs: 1"
  assert_smm_output_contains "Login: reviewer"
}

function test_prs_by_month_renders_cached_pull_request_metrics() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_prs_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm prs by-month

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "PRs by Month"
  assert_smm_output_contains "\"period\": \"2026-01\""
  assert_smm_output_contains "\"count\": 2"
}

function test_prs_by_week_renders_cached_pull_request_metrics() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_prs_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm prs by-week

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "PRs by Week"
  assert_smm_output_contains "\"count\": 1"
  assert_smm_output_contains "\"averageComments\": 1"
}

function test_prs_through_time_renders_opened_and_closed_counts() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_prs_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm prs through-time --aggregate-by day

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "PRs Through Time"
  assert_smm_output_contains "2026-01-05 | Opened: 1"
  assert_smm_output_contains "2026-01-07 | Closed: 1"
}

function test_prs_by_author_renders_cached_pull_request_authors() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_prs_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm prs by-author

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "PRs by Author"
  assert_smm_output_contains "alice: 1 PRs"
  assert_smm_output_contains "bob: 1 PRs"
}

function test_prs_average_review_time_renders_cached_pull_request_averages() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_prs_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm prs average-review-time

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "Average Review Time by Author"
  assert_smm_output_contains "alice: 2.00 days"
}

function test_prs_average_open_renders_cached_pull_request_averages() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_prs_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm prs average-open --aggregate-by day

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "Average PR Open Time"
  assert_smm_output_contains "2026-01-05: 2.00 days"
  assert_smm_output_contains "2026-01-12: 0.00 days"
}

function test_prs_average_comments_renders_cached_pull_request_average() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_prs_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm prs average-comments

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "Average Comments per PR"
  assert_smm_output_contains "Average Comments: 0.5"
}
