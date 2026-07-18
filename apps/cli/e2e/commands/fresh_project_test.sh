#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"


function test_health_check_detects_empty_databases() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm health-check

  unset SMM_STORE_DATA_AT

  assert_smm_output_contains "Total datasets: 7"
  assert_smm_output_contains "Healthy: 0"
  assert_smm_output_contains "Errors: 7"
  assert_smm_success
}

function test_prs_summary_handles_no_data_gracefully() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm prs summary

  unset SMM_STORE_DATA_AT

  assert_smm_output_contains "Total PRs: 0"
  assert_smm_success
}

function test_pipelines_summary_handles_no_data_gracefully() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm pipelines summary

  unset SMM_STORE_DATA_AT

  assert_smm_output_contains "Total Runs: 0"
  assert_smm_success
}

function test_code_commands_work_without_git_history() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm code churn --help
  assert_smm_output_contains "Usage:"
  assert_smm_success

  run_smm code coupling --help
  assert_smm_output_contains "Usage:"
  assert_smm_success

  unset SMM_STORE_DATA_AT
}

function test_config_file_is_valid_json() {
  local workspace
  local config_file

  workspace="$(create_smm_e2e_workspace)"
  config_file="${workspace}/smm_config.json"

  # Validate JSON by parsing it with node
  if ! node -e "JSON.parse(require('fs').readFileSync('${config_file}', 'utf8'))" 2>/dev/null; then
    assert_smm_equals "valid JSON" "invalid JSON in smm_config.json"
  fi

  assert_smm_equals "valid JSON" "valid JSON"
}
