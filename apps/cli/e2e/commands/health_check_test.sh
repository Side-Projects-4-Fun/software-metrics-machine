#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"

function test_health_check_reports_all_datasets_as_errors_when_empty() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm health-check

  unset SMM_STORE_DATA_AT

  assert_smm_output_contains "Total datasets: 7"
  assert_smm_output_contains "Healthy: 0"
  assert_smm_output_contains "Errors: 7"
  assert_smm_output_contains "Dataset not found in SQLite cache"
  assert_smm_success
}

function test_health_check_output_json_returns_valid_json() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm health-check --output json

  unset SMM_STORE_DATA_AT

  assert_smm_output_contains '"totalDatasets": 7'
  assert_smm_output_contains '"errorDatasets": 7'
  assert_smm_output_contains '"summary"'
  assert_smm_output_contains '"datasets"'
  assert_smm_success
}

function test_health_check_provider_github_filters_datasets() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm health-check --provider github

  unset SMM_STORE_DATA_AT

  assert_smm_output_contains "github.prs"
  assert_smm_output_not_contains "jira.issues"
  assert_smm_output_not_contains "sonarqube"
  assert_smm_success
}
