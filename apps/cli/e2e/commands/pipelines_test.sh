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
  assert_smm_output_contains "pipelines"
}

function test_pipelines_fetch_help_renders_successfully() {
  run_smm pipelines fetch --help

  assert_smm_success
  assert_smm_output_contains "Usage:"
  assert_smm_output_contains "fetch"
}

function test_pipelines_fetch_jobs_help_renders_successfully() {
  run_smm pipelines fetch-jobs --help

  assert_smm_success
  assert_smm_output_contains "Usage:"
  assert_smm_output_contains "fetch-jobs"
}

function test_pipelines_fetch_uses_cached_workflows() {
  run_seeded_pipelines_command pipelines fetch

  assert_smm_success
  assert_smm_output_contains "Fetching pipeline runs from the configured Git provider"
  assert_smm_output_contains "Fetch pipeline data has been completed and stored on disk"
}

function test_pipelines_fetch_jobs_uses_cached_jobs() {
  run_seeded_pipelines_command pipelines fetch-jobs

  assert_smm_success
  assert_smm_output_contains "Fetching pipeline jobs from the configured Git provider"
  assert_smm_output_contains "Fetch pipeline jobs has been completed and stored on disk"
}

function test_pipelines_summary_renders_cached_workflow_metrics() {
  run_seeded_pipelines_command pipelines summary

  assert_smm_success
  assert_smm_output_contains "Pipeline Summary"
  assert_smm_output_contains "Total Runs: 2"
  assert_smm_output_contains "Successful Runs: 1"
  assert_smm_output_contains "Failed Runs: 1"
  assert_smm_output_contains "Average Duration: 15.00 minutes"
}

function test_pipelines_by_status_renders_cached_workflow_statuses() {
  run_seeded_pipelines_command pipelines by-status

  assert_smm_success
  assert_smm_output_contains "Pipelines by Status"
  assert_smm_output_contains "Successful: 1"
  assert_smm_output_contains "Failed: 1"
  assert_smm_output_contains "Total: 2"
}

function test_pipelines_runs_duration_renders_cached_duration_average() {
  run_seeded_pipelines_command pipelines runs-duration

  assert_smm_success
  assert_smm_output_contains "Pipeline Run Durations"
  assert_smm_output_contains "Average Duration: 15.00 minutes"
  assert_smm_output_contains "Total Runs: 2"
}

function test_pipelines_runs_by_period() {
  run_seeded_pipelines_command pipelines runs-by --period day

  assert_smm_success
  assert_smm_output_contains "Period: 2026-02-03 | Total Runs: 1 | Pipeline: .github/workflows/deploy.yml"
}

function test_pipelines_jobs_summary_renders_cached_job_metrics() {
  run_seeded_pipelines_command pipelines jobs-summary

  assert_smm_success
  assert_smm_output_contains "Pipeline Jobs Summary"
  assert_smm_output_contains "Job name: build"
  assert_smm_output_contains "Total Jobs: 2"
  assert_smm_output_contains "Failure count: 1"
}

function test_pipelines_jobs_time_execution_renders_cached_job_averages() {
  run_seeded_pipelines_command pipelines jobs-time-execution

  assert_smm_success
  assert_smm_output_contains "Job Execution Times"
  assert_smm_output_contains "Job: build"
  assert_smm_output_contains "Average Execution Time: 12.50 minutes"
}

function test_pipelines_jobs_steps_average_time_renders_cached_step_averages() {
  run_seeded_pipelines_command pipelines jobs-steps-average-time --job build

  assert_smm_success
  assert_smm_output_contains "Job Steps Execution Times"
  assert_smm_output_contains "Step: Test"
  assert_smm_output_contains "Average Execution Time: 9.00 minutes"
  assert_smm_output_contains "Analyzed across 2 step executions"
}

function test_pipelines_jobs_by_status_renders_cached_job_statuses() {
  run_seeded_pipelines_command pipelines jobs-by-status

  assert_smm_success
  assert_smm_output_contains "Jobs by Status"
  assert_smm_output_contains "Name: build"
  assert_smm_output_contains "Successful: 1, success rate: 50%"
  assert_smm_output_contains "Failed: 1, failure rate: 50%"
}

function test_pipelines_deployment_frequency_renders_configured_target_counts() {
  run_seeded_pipelines_command pipelines deployment-frequency --period day

  assert_smm_success
  assert_smm_output_contains "Deployment Frequency"
  assert_smm_output_contains ".github/workflows/deploy.yml / deploy"
  assert_smm_output_contains "Total Deployments: 1 (daily), 1 (weekly), 1 (monthly)"
}

function test_pipelines_lead_time_renders_cached_average() {
  run_seeded_pipelines_command pipelines lead-time

  assert_smm_success
  assert_smm_output_contains "Lead Time for Changes"
  assert_smm_output_contains "Lead Time: 15.00 hours"
}
