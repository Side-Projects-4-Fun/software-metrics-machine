#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"

function seed_change_requests_workspace() {
  local workspace="$1"
  seed_sqlite_change_requests_fixture "${workspace}"
}

function run_seeded_change_requests_command() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_change_requests_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm "$@"

  unset SMM_STORE_DATA_AT
}

function test_change_requests_help_renders_successfully() {
  run_smm change-requests --help
  assert_smm_success
  assert_smm_output_contains "Usage:"
  assert_smm_output_contains "fetch"
  assert_smm_output_contains "fetch-comments"
  assert_smm_output_contains "summary"

  run_smm change-requests fetch --help
  assert_smm_success
  assert_smm_output_contains "--force"
  assert_smm_output_contains "--start-date"

  run_smm change-requests fetch-comments --help
  assert_smm_success
  assert_smm_output_contains "--update"
  assert_smm_output_contains "--raw-filters"
}

function test_change_requests_fetch_persists_change_requests_from_mocked_github() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"
  export DEBUG=true

  run_smm_with_github_change_requests_msw change-requests fetch \
    --force \
    --start-date 2026-01-01 \
    --end-date 2026-01-31 \
    --raw-filters "state=all"

  unset DEBUG
  unset SMM_STORE_DATA_AT

  assert_smm_output_contains "Fetch data has been completed"
  assert_smm_output_contains "Fetching change requests from the configured Git provider"
  assert_smm_output_contains "Fetching PRs page 1 for acme/widgets"
  assert_smm_output_contains "GET /repos/acme/widgets/pulls?state=all"
  assert_smm_success
}

function test_change_requests_fetch_comments_persists_comments_from_mocked_github() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"
  export DEBUG=true

  run_smm_with_github_change_requests_msw change-requests fetch --force --start-date 2026-01-01 --end-date 2026-01-31 --raw-filters "state=all"
  run_smm_with_github_change_requests_msw change-requests fetch-comments \
    --force \
    --start-date 2026-01-01 \
    --end-date 2026-01-31

  unset DEBUG
  unset SMM_STORE_DATA_AT

  assert_smm_output_contains "Fetch change request comments data has been completed"
  assert_smm_output_contains "Fetching change request comments from the configured Git provider"
  assert_smm_output_contains "Fetching comments for PR #42 page 1 in acme/widgets"
  assert_smm_output_contains "GET /repos/acme/widgets/pulls/42/comments"
  assert_smm_success
}

function test_change_requests_summary_renders_statistics_from_cached_change_requests() {
  run_seeded_change_requests_command change-requests summary \
    --start-date 2026-01-01 \
    --end-date 2026-01-31 \
    --authors alice,bob \
    --exclude-authors nobody \
    --exclude-commenters nobody \
    --labels feature,analytics \
    --output json

  assert_smm_success
  assert_smm_output_contains '"total_change_requests": 2'
  assert_smm_output_contains '"merged_change_requests": 1'
  assert_smm_output_contains '"unique_authors": 2'
  assert_smm_output_contains '"avg_comments_per_change_request": 0.5'
  assert_smm_output_contains '"login": "reviewer"'
}

function test_change_requests_by_month_renders_cached_change_request_metrics() {
  run_seeded_change_requests_command change-requests by-month \
    --start-date 2026-01-01 \
    --end-date 2026-01-31 \
    --exclude-authors nobody \
    --exclude-commenters nobody \
    --output json

  assert_smm_success
  assert_smm_output_contains '"period": "2026-01"'
  assert_smm_output_contains '"count": 2'
  assert_smm_output_contains '"comments": 0.5'
}

function test_change_requests_by_week_renders_cached_change_request_metrics() {
  run_seeded_change_requests_command change-requests by-week \
    --start-date 2026-01-01 \
    --end-date 2026-01-31 \
    --exclude-authors nobody \
    --exclude-commenters nobody \
    --output json

  assert_smm_success
  assert_smm_output_contains '"count": 1'
  assert_smm_output_contains '"comments": 1'
}

function test_change_requests_through_time_renders_opened_and_closed_counts() {
  run_seeded_change_requests_command change-requests through-time \
    --start-date 2026-01-01 \
    --end-date 2026-01-31 \
    --authors alice,bob \
    --exclude-authors nobody \
    --exclude-commenters nobody \
    --labels feature,analytics \
    --aggregate-by day \
    --output json

  assert_smm_success
  assert_smm_output_contains '"date": "2026-01-05"'
  assert_smm_output_contains '"kind": "Opened"'
  assert_smm_output_contains '"kind": "Closed"'
  assert_smm_output_contains '"date": "2026-01-07"'
  assert_smm_output_contains '"date": "2026-01-12"'
}

function test_change_requests_by_author_renders_cached_change_request_authors() {
  run_seeded_change_requests_command change-requests by-author \
    --start-date 2026-01-01 \
    --end-date 2026-01-31 \
    --authors alice,bob \
    --exclude-authors nobody \
    --exclude-commenters nobody \
    --labels feature,analytics \
    --top 5 \
    --output json

  assert_smm_success
  assert_smm_output_contains '"author": "alice"'
  assert_smm_output_contains '"author": "bob"'
  assert_smm_output_contains '"count": 1'
}

function test_change_requests_review_time_renders_cached_change_request_averages() {
  run_seeded_change_requests_command change-requests review-time \
    --start-date 2026-01-01 \
    --end-date 2026-01-31 \
    --authors alice,bob \
    --exclude-authors nobody \
    --exclude-commenters nobody \
    --labels feature,analytics \
    --top 3 \
    --method median \
    --output json

  assert_smm_success
  assert_smm_output_contains '"author": "alice"'
  assert_smm_output_contains '"method": "median"'
}

function test_change_requests_open_time_renders_cached_change_request_averages() {
  run_seeded_change_requests_command change-requests open-time \
    --start-date 2026-01-01 \
    --end-date 2026-01-31 \
    --authors alice,bob \
    --exclude-authors nobody \
    --exclude-commenters nobody \
    --labels feature,analytics \
    --aggregate-by day \
    --method p90 \
    --output json

  assert_smm_success
  assert_smm_output_contains '"period": "2026-01-05"'
  assert_smm_output_contains '"period": "2026-01-12"'
  assert_smm_output_contains '"method": "p90"'
}

function test_change_requests_comments_renders_cached_change_request_average() {
  run_seeded_change_requests_command change-requests comments \
    --start-date 2026-01-01 \
    --end-date 2026-01-31 \
    --authors alice,bob \
    --exclude-authors nobody \
    --exclude-commenters nobody \
    --labels feature,analytics \
    --method average \
    --output json

  assert_smm_success
  assert_smm_output_contains '"avg_comments": 0.5'
  assert_smm_output_contains '"method": "average"'
}

function test_change_requests_summary_applies_saved_filter() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_change_requests_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm filters save change-request-test-filter \
    --section change-requests \
    --change-request-status merged \
    --start-date 2026-01-01 \
    --end-date 2026-01-31 \
    --aggregate-by week \
    --weekends exclude \
    --outlier-mode flag
  assert_smm_success

  run_smm change-requests summary --filter change-request-test-filter

  unset SMM_STORE_DATA_AT

  assert_smm_output_contains "Change Requests Summary:"
  assert_smm_output_contains "Total change requests: 2"
  assert_smm_output_contains "Merged change requests: 1"
  assert_smm_success
}

function test_change_requests_through_time_applies_saved_filter() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_change_requests_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm filters save change-request-through-filter \
    --section change-requests \
    --start-date 2026-01-01 \
    --end-date 2026-01-31 \
    --change-request-status merged \
    --aggregate-by day
  assert_smm_success

  run_smm change-requests through-time --filter change-request-through-filter

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "Change Requests Through Time"
}