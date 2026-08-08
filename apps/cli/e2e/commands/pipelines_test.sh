#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"

function create_pipelines_workspace() {
  local workspace
  local tmp_root="${SMM_REPO_ROOT}/tmp/e2e"

  mkdir -p "${tmp_root}"
  workspace="$(mktemp -d "${tmp_root}/smm-cli-e2e.XXXXXX")"
  mkdir -p "${workspace}/repo"

  cat >"${workspace}/smm_config.json" <<JSON
{
  "projects": [
    {
      "git_provider": "github",
      "github_token": "test-token",
      "github_repository": "acme/widgets",
      "git_repository_location": "${workspace}/repo",
      "log_level": "CRITICAL",
      "deployment_frequency_targets": [
        { "pipeline": ".github/workflows/deploy.yml", "job": "deploy" }
      ]
    }
  ]
}
JSON

  printf '%s\n' "${workspace}"
}

function seed_pipelines_workspace() {
  local workspace="$1"
  seed_sqlite_pipelines_fixture "${workspace}"
}

function run_seeded_pipelines_command() {
  local workspace

  workspace="$(create_pipelines_workspace)"
  seed_pipelines_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm "$@"

  unset SMM_STORE_DATA_AT
}

function test_pipelines_help_renders_successfully() {
  run_smm pipelines --help
  assert_smm_success
  assert_smm_output_contains "Usage:"
  assert_smm_output_contains "fetch"
  assert_smm_output_contains "fetch-jobs"
  assert_smm_output_contains "summary"

  run_smm pipelines fetch --help
  assert_smm_output_contains "--force"
  assert_smm_output_contains "--by-day"
  assert_smm_success

  run_smm pipelines fetch-jobs --help
  assert_smm_output_contains "--run-start-date"
  assert_smm_output_contains "--raw-filters"
  assert_smm_success
}

function test_pipelines_fetch_uses_mocked_github_with_all_options() {
  local workspace

  workspace="$(create_pipelines_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"
  export DEBUG=true

  run_smm_with_github_pipelines_msw pipelines fetch \
    --force \
    --start-date 2026-02-01 \
    --end-date 2026-02-28 \
    --raw-filters "status=completed"

  unset DEBUG
  unset SMM_STORE_DATA_AT

  assert_smm_output_contains "Fetching pipeline runs from the configured Git provider"
  assert_smm_output_contains "Fetch pipeline data has been completed and stored on disk"
  assert_smm_success
}

function test_pipelines_fetch_jobs_uses_mocked_github_with_all_options() {
  local workspace

  workspace="$(create_pipelines_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"
  export DEBUG=true

  run_smm_with_github_pipelines_msw pipelines fetch --force --start-date 2026-02-01 --end-date 2026-02-28 --raw-filters "status=completed"
  run_smm_with_github_pipelines_msw pipelines fetch-jobs \
    --force \
    --run-start-date 2026-02-01 \
    --run-end-date 2026-02-28 \
    --raw-filters "status=success"

  unset DEBUG
  unset SMM_STORE_DATA_AT

  assert_smm_output_contains "Fetching pipeline jobs from the configured Git provider"
  assert_smm_output_contains "Fetch pipeline jobs has been completed and stored on disk"
  assert_smm_success
}

function test_pipelines_summary_renders_cached_workflow_metrics() {
  run_seeded_pipelines_command pipelines summary \
    --start-date 2026-02-01 \
    --end-date 2026-02-28 \
    --max-workflows 5 \
    --output json \
    --raw-filters "status=completed" \
    --weekends exclude \
    --outlier-mode flag

  assert_smm_output_contains '"total_runs": 2'
  assert_smm_output_contains '"successful_runs": 1'
  assert_smm_output_contains '"failed_runs": 1'
  assert_smm_output_contains '"value": 15'
  assert_smm_success
}

function test_pipelines_by_status_renders_cached_workflow_statuses() {
  run_seeded_pipelines_command pipelines by-status \
    --start-date 2026-02-01 \
    --end-date 2026-02-28 \
    --output json \
    --raw-filters "status=completed"

  assert_smm_output_contains '"successful": 1'
  assert_smm_output_contains '"failed": 1'
  assert_smm_output_contains '"total": 2'
  assert_smm_success
}

function test_pipelines_runs_duration_renders_cached_duration_average() {
  run_seeded_pipelines_command pipelines runs-duration \
    --start-date 2026-02-01 \
    --end-date 2026-02-28 \
    --workflow ".github/workflows/deploy.yml" \
    --output json \
    --raw-filters "status=completed" \
    --weekends exclude \
    --outlier-mode flag

  assert_smm_output_contains '"averageDuration": 15'
  assert_smm_success
}

function test_pipelines_runs_duration_with_median_method() {
  run_seeded_pipelines_command pipelines runs-duration \
    --start-date 2026-02-01 \
    --end-date 2026-02-28 \
    --workflow ".github/workflows/deploy.yml" \
    --method median \
    --raw-filters "status=completed" \
    --weekends exclude \
    --outlier-mode flag

  assert_smm_output_contains "MEDIAN Pipeline Run Durations"
  assert_smm_output_contains "Median Duration: 15 min"
  assert_smm_output_contains "Total Runs: 2"
  assert_smm_success
}

function test_pipelines_runs_duration_with_min_method() {
  run_seeded_pipelines_command pipelines runs-duration \
    --start-date 2026-02-01 \
    --end-date 2026-02-28 \
    --workflow ".github/workflows/deploy.yml" \
    --method min \
    --raw-filters "status=completed" \
    --weekends exclude \
    --outlier-mode flag

  assert_smm_output_contains "MIN Pipeline Run Durations"
  assert_smm_output_contains "Min Duration: 10 min"
  assert_smm_output_contains "Total Runs: 2"
  assert_smm_success
}

function test_pipelines_runs_duration_help_includes_method() {
  run_smm pipelines runs-duration --help
  assert_smm_output_contains "--method"
  assert_smm_output_contains "Statistical method"
  assert_smm_success
}

function test_pipelines_runs_by_period() {
  run_seeded_pipelines_command pipelines runs-by \
    --start-date 2026-02-01 \
    --end-date 2026-02-28 \
    --period day \
    --output json \
    --raw-filters "status=completed"

  assert_smm_output_contains '"period": "2026-02-03"'
  assert_smm_output_contains '"period": "2026-02-04"'
  assert_smm_output_contains '"runs": 1'
  assert_smm_output_contains '".github/workflows/deploy.yml"'
  assert_smm_success
}

function test_pipelines_jobs_summary_renders_cached_job_metrics() {
  run_seeded_pipelines_command pipelines jobs-summary \
    --start-date 2026-02-01 \
    --end-date 2026-02-28 \
    --max-jobs 10 \
    --output json \
    --raw-filters "status=completed" \
    --weekends exclude \
    --outlier-mode flag

  assert_smm_output_contains '"job_name": "build"'
  assert_smm_output_contains '"total_runs": 2'
  assert_smm_output_contains '"failure_count": 1'
  assert_smm_output_contains '"job_name": "deploy"'
  assert_smm_output_contains '"total_runs": 1'
  assert_smm_success
}

function test_pipelines_jobs_time_execution_renders_cached_job_averages() {
  run_seeded_pipelines_command pipelines jobs-time-execution \
    --start-date 2026-02-01 \
    --end-date 2026-02-28 \
    --job build \
    --output json \
    --raw-filters "status=completed" \
    --weekends exclude \
    --outlier-mode flag

  assert_smm_output_contains '"job_name": "build"'
  assert_smm_output_contains '"value": 12.5'
  assert_smm_output_contains '"failure_count": 1'
  assert_smm_output_contains '"success_count": 1'
  assert_smm_success
}

function test_pipelines_jobs_time_execution_with_p95_method() {
  run_seeded_pipelines_command pipelines jobs-time-execution \
    --start-date 2026-02-01 \
    --end-date 2026-02-28 \
    --job build \
    --method p95 \
    --raw-filters "status=completed" \
    --weekends exclude \
    --outlier-mode flag

  assert_smm_output_contains "P95 Job Execution Times"
  assert_smm_output_contains "P95 Execution Time: 19 min"
  assert_smm_success
}

function test_pipelines_jobs_time_execution_help_includes_method() {
  run_smm pipelines jobs-time-execution --help
  assert_smm_output_contains "--method"
  assert_smm_output_contains "Statistical method"
  assert_smm_success
}

function test_pipelines_jobs_steps_time_with_all_options() {
  run_seeded_pipelines_command pipelines jobs-steps-time \
    --start-date 2026-02-01 \
    --end-date 2026-02-28 \
    --job build \
    --method median \
    --output json \
    --raw-filters "status=completed" \
    --weekends exclude \
    --outlier-mode flag

  assert_smm_output_contains '"name": "Checkout"'
  assert_smm_output_contains '"name": "Test"'
  assert_smm_output_contains '"count": 2'
  assert_smm_success
}

function test_pipelines_jobs_by_status_renders_cached_job_statuses() {
  run_seeded_pipelines_command pipelines jobs-by-status \
    --start-date 2026-02-01 \
    --end-date 2026-02-28 \
    --output json \
    --raw-filters "status=completed" \
    --weekends exclude \
    --outlier-mode flag

  assert_smm_output_contains '"job_name": "build"'
  assert_smm_output_contains '"success_rate": 50'
  assert_smm_output_contains '"job_name": "deploy"'
  assert_smm_output_contains '"success_rate": 100'
  assert_smm_success
}

function test_pipelines_deployment_frequency_renders_configured_target_counts() {
  run_seeded_pipelines_command pipelines deployment-frequency \
    --start-date 2026-02-01 \
    --end-date 2026-02-28 \
    --period day \
    --output json \
    --raw-filters "status=completed"

  assert_smm_output_contains '"pipeline": ".github/workflows/deploy.yml"'
  assert_smm_output_contains '"job": "deploy"'
  assert_smm_output_contains '"daily_counts": 1'
  assert_smm_output_contains '"months": "2026-02"'
  assert_smm_success
}

function test_pipelines_lead_time_renders_cached_average() {
  run_seeded_pipelines_command pipelines lead-time \
    --start-date 2026-02-01 \
    --end-date 2026-02-28 \
    --output json \
    --raw-filters "status=completed" \
    --weekends exclude \
    --outlier-mode flag

  assert_smm_output_contains '"leadTime": 0.25'
  assert_smm_success
}

function test_pipelines_summary_applies_saved_filter() {
  local workspace

  workspace="$(create_pipelines_workspace)"
  seed_pipelines_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm filters save pl-test-filter \
    --section pipelines \
    --start-date 2026-02-01 \
    --end-date 2026-02-28 \
    --workflow-selector deploy \
    --branch main \
    --weekends exclude \
    --outlier-mode flag
  assert_smm_success

  run_smm pipelines summary --filter pl-test-filter

  unset SMM_STORE_DATA_AT

  assert_smm_output_contains "Pipeline Summary"
  assert_smm_output_contains "Total Runs: 2"
  assert_smm_output_contains "Successful Runs: 1"
  assert_smm_output_contains "Failed Runs: 1"
  assert_smm_success
}

function test_pipelines_by_status_applies_saved_filter() {
  local workspace

  workspace="$(create_pipelines_workspace)"
  seed_pipelines_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm filters save pl-status-filter \
    --section pipelines \
    --start-date 2026-02-01 \
    --end-date 2026-02-28 \
    --branch main \
    --outlier-mode exclude \
    --weekends include
  assert_smm_success

  run_smm pipelines by-status --filter pl-status-filter

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "Pipelines by Status"
  assert_smm_output_contains "Successful: 1"
  assert_smm_output_contains "Failed: 1"
}
