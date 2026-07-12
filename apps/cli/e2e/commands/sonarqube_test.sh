#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"

function test_sonarqube_fetch_measures_fails_without_server() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm sonarqube fetch-measures

  unset SMM_STORE_DATA_AT

  assert_smm_failure
  assert_smm_output_contains "Fetching quality measures from SonarQube"
}

function test_sonarqube_fetch_component_tree_fails_without_server() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm sonarqube fetch-component-tree

  unset SMM_STORE_DATA_AT

  assert_smm_failure
  assert_smm_output_contains "Fetching component tree from SonarQube"
}

function test_sonarqube_fetch_historical_measures_fails_without_server() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm sonarqube fetch-historical-measures

  unset SMM_STORE_DATA_AT

  assert_smm_failure
  assert_smm_output_contains "Fetching historical measures from SonarQube"
}
