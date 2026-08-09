#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"

# ---------------------------------------------------------------------------
# Workspace and seed helpers
# ---------------------------------------------------------------------------

function seed_gitlab_mrs_workspace() {
  local workspace="$1"
  seed_sqlite_gitlab_change_requests_fixture "${workspace}"
}

function seed_gitlab_pipelines_workspace() {
  local workspace="$1"
  seed_sqlite_gitlab_pipelines_fixture "${workspace}"
}

function run_seeded_gitlab_mrs_command() {
  local workspace

  workspace="$(create_gitlab_workspace)"
  seed_gitlab_mrs_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm "$@"

  unset SMM_STORE_DATA_AT
}

function run_seeded_gitlab_pipelines_command() {
  local workspace

  workspace="$(create_gitlab_workspace)"
  seed_gitlab_pipelines_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm "$@"

  unset SMM_STORE_DATA_AT
}

# ---------------------------------------------------------------------------
# Help and fetch tests (GitLab API mock)
# ---------------------------------------------------------------------------

function test_gitlab_change_requests_help_renders_successfully() {
  run_smm change-requests --help
  assert_smm_success
  assert_smm_output_contains "Usage:"
  assert_smm_output_contains "fetch"
  assert_smm_output_contains "summary"
}

function test_gitlab_change_requests_fetch_persists_merge_requests_from_gitlab_api() {
  local workspace

  workspace="$(create_gitlab_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"
  export DEBUG=true

  run_smm_with_gitlab_api change-requests fetch \
    --force \
    --start-date 2026-01-01 \
    --end-date 2026-01-31

  unset DEBUG
  unset SMM_STORE_DATA_AT

  assert_smm_output_contains "Fetch data has been completed"
  assert_smm_output_contains "Fetching change requests from the configured Git provider"
  assert_smm_output_contains "Fetching GitLab merge_requests page 1 for acme/widgets"
  assert_smm_success
}

function test_gitlab_change_requests_fetch_comments_persists_comments_from_gitlab_api() {
  local workspace

  workspace="$(create_gitlab_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"
  export DEBUG=true

  run_smm_with_gitlab_api change-requests fetch --force --start-date 2026-01-01 --end-date 2026-01-31
  run_smm_with_gitlab_api change-requests fetch-comments \
    --force \
    --start-date 2026-01-01 \
    --end-date 2026-01-31

  unset DEBUG
  unset SMM_STORE_DATA_AT

  assert_smm_output_contains "Fetch change request comments data has been completed"
  assert_smm_success
}

function test_gitlab_pipelines_fetch_persists_pipelines_from_gitlab_api() {
  local workspace

  workspace="$(create_gitlab_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"
  export DEBUG=true

  run_smm_with_gitlab_api pipelines fetch \
    --force \
    --start-date 2026-02-01 \
    --end-date 2026-02-28

  unset DEBUG
  unset SMM_STORE_DATA_AT

  assert_smm_output_contains "Fetching pipeline runs from the configured Git provider"
  assert_smm_output_contains "Fetch pipeline data has been completed and stored on disk"
  assert_smm_success
}

function test_gitlab_pipelines_fetch_jobs_persists_jobs_from_gitlab_api() {
  local workspace

  workspace="$(create_gitlab_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"
  export DEBUG=true

  run_smm_with_gitlab_api pipelines fetch --force --start-date 2026-02-01 --end-date 2026-02-28
  run_smm_with_gitlab_api pipelines fetch-jobs \
    --force \
    --run-start-date 2026-02-01 \
    --run-end-date 2026-02-28

  unset DEBUG
  unset SMM_STORE_DATA_AT

  assert_smm_output_contains "Fetch pipeline jobs has been completed and stored on disk"
  assert_smm_success
}

# ---------------------------------------------------------------------------
# Merge request read tests (seeded SQLite)
# ---------------------------------------------------------------------------

function test_gitlab_mrs_summary_renders_statistics_from_cached_merge_requests() {
  run_seeded_gitlab_mrs_command change-requests summary \
    --start-date 2026-01-01 \
    --end-date 2026-01-31 \
    --output json

  assert_smm_success
  assert_smm_output_contains '"total_change_requests": 2'
  assert_smm_output_contains '"merged_change_requests": 1'
  assert_smm_output_contains '"unique_authors": 2'
}

function test_gitlab_mrs_summary_text_renders_readable_output() {
  run_seeded_gitlab_mrs_command change-requests summary \
    --start-date 2026-01-01 \
    --end-date 2026-01-31

  assert_smm_success
  assert_smm_output_contains "Change Requests Summary:"
  assert_smm_output_contains "Total change requests: 2"
  assert_smm_output_contains "Merged change requests: 1"
  assert_smm_output_contains "Unique Authors: 2"
}

function test_gitlab_mrs_by_month_renders_cached_metrics() {
  run_seeded_gitlab_mrs_command change-requests by-month \
    --start-date 2026-01-01 \
    --end-date 2026-01-31 \
    --output json

  assert_smm_success
  assert_smm_output_contains '"period": "2026-01"'
  assert_smm_output_contains '"count": 2'
}

function test_gitlab_mrs_by_author_renders_cached_authors() {
  run_seeded_gitlab_mrs_command change-requests by-author \
    --start-date 2026-01-01 \
    --end-date 2026-01-31 \
    --top 10

  assert_smm_success
  assert_smm_output_contains "Change Requests by Author"
  assert_smm_output_contains "alice"
  assert_smm_output_contains "bob"
}

function test_gitlab_mrs_review_time_renders_with_average_method() {
  run_seeded_gitlab_mrs_command change-requests review-time \
    --start-date 2026-01-01 \
    --end-date 2026-01-31 \
    --method average \
    --top 10

  assert_smm_success
  assert_smm_output_contains "AVERAGE Review Time by Author"
}

# ---------------------------------------------------------------------------
# Pipeline read tests (seeded SQLite)
# ---------------------------------------------------------------------------

function test_gitlab_pipelines_summary_renders_statistics_from_cached_pipelines() {
  run_seeded_gitlab_pipelines_command pipelines summary \
    --start-date 2026-02-01 \
    --end-date 2026-02-28 \
    --raw-filters "status=completed" \
    --output json

  assert_smm_success
  assert_smm_output_contains '"total_runs": 2'
  assert_smm_output_contains '"successful_runs": 1'
  assert_smm_output_contains '"failed_runs": 1'
}

function test_gitlab_pipelines_by_status_renders_cached_workflow_statuses() {
  run_seeded_gitlab_pipelines_command pipelines by-status \
    --start-date 2026-02-01 \
    --end-date 2026-02-28 \
    --raw-filters "status=completed" \
    --output json

  assert_smm_success
  assert_smm_output_contains '"successful": 1'
  assert_smm_output_contains '"failed": 1'
  assert_smm_output_contains '"total": 2'
}

function test_gitlab_pipelines_jobs_summary_renders_cached_job_metrics() {
  run_seeded_gitlab_pipelines_command pipelines jobs-summary \
    --start-date 2026-02-01 \
    --end-date 2026-02-28 \
    --raw-filters "status=completed" \
    --output json

  assert_smm_success
  assert_smm_output_contains '"job_name": "build"'
  assert_smm_output_contains '"total_runs": 2'
  assert_smm_output_contains '"job_name": "deploy"'
  assert_smm_output_contains '"total_runs": 1'
}

function test_gitlab_pipelines_runs_by_period() {
  run_seeded_gitlab_pipelines_command pipelines runs-by \
    --start-date 2026-02-01 \
    --end-date 2026-02-28 \
    --period day \
    --raw-filters "status=completed" \
    --output json

  assert_smm_success
  assert_smm_output_contains '"period": "2026-02-03"'
  assert_smm_output_contains '"period": "2026-02-04"'
  assert_smm_output_contains '"runs": 1'
}
