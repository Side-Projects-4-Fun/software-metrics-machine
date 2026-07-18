#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"

function seed_prs_workspace() {
  local workspace="$1"
  seed_sqlite_prs_fixture "${workspace}"
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
