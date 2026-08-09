#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"

function test_filters_save_and_list_renders_saved_filter() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm filters save my-pipelines-filter --section pipelines --start-date 2026-01-01 --end-date 2026-01-31 --workflow-selector deploy
  assert_smm_output_contains 'Saved filter: "my-pipelines-filter" [pipelines]'
  assert_smm_output_contains "ID:"
  assert_smm_success

  run_smm filters list
  assert_smm_output_contains "Saved Filters:"
  assert_smm_output_contains "[pipelines] my-pipelines-filter"
  assert_smm_success

  unset SMM_STORE_DATA_AT
}

function test_filters_save_and_show_renders_filter_details() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm filters save my-change-request-filter --section change-requests --change-request-status merged --start-date 2026-01-01 --end-date 2026-01-31 --aggregate-by week
  assert_smm_success

  run_smm filters show my-change-request-filter
  assert_smm_success
  assert_smm_output_contains "Filter: my-change-request-filter"
  assert_smm_output_contains "Section: change-requests"
  assert_smm_output_contains "startDate: 2026-01-01"
  assert_smm_output_contains "endDate: 2026-01-31"
  assert_smm_output_contains "changeRequestStatus: merged"
  assert_smm_output_contains "aggregateBy: week"

  unset SMM_STORE_DATA_AT
}

function test_filters_save_and_delete_removes_saved_filter() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm filters save temp-filter --section pipelines --start-date 2026-01-01
  assert_smm_success

  run_smm filters delete temp-filter
  assert_smm_success
  assert_smm_output_contains 'Deleted filter: "temp-filter"'

  run_smm filters list
  assert_smm_success
  assert_smm_output_contains "No saved filters found."
  assert_smm_output_not_contains "temp-filter"

  unset SMM_STORE_DATA_AT
}

function test_filters_list_by_section_filters_entries() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm filters save pipelines-one --section pipelines --start-date 2026-01-01
  assert_smm_success
  run_smm filters save change-requests-one --section change-requests --start-date 2026-01-01
  assert_smm_success

  run_smm filters list --section pipelines
  assert_smm_success
  assert_smm_output_contains "[pipelines] pipelines-one"
  assert_smm_output_not_contains "[change-requests]"

  unset SMM_STORE_DATA_AT
}

function test_filters_list_json_output_returns_json() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm filters save json-test --section architecture --start-date 2026-01-01
  assert_smm_success

  run_smm filters list --output json
  assert_smm_success
  assert_smm_output_contains '"name": "json-test"'
  assert_smm_output_contains '"section": "architecture"'

  unset SMM_STORE_DATA_AT
}

function test_filters_show_json_output_returns_filter_as_json() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm filters save json-show --section sonarqube --sonarqube-remove-folders
  assert_smm_success

  run_smm filters show json-show --output json
  assert_smm_success
  assert_smm_output_contains '"name": "json-show"'
  assert_smm_output_contains '"section": "sonarqube"'
  assert_smm_output_contains '"sonarqubeRemoveFolders": true'

  unset SMM_STORE_DATA_AT
}

function test_filters_show_not_found_reports_missing() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm filters show nonexistent
  assert_smm_success
  assert_smm_output_contains 'Filter "nonexistent" not found.'

  unset SMM_STORE_DATA_AT
}

function test_filters_delete_not_found_reports_missing() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm filters delete ghost-filter
  assert_smm_success
  assert_smm_output_contains 'Filter "ghost-filter" not found.'

  unset SMM_STORE_DATA_AT
}

function test_filters_save_with_all_pipelines_options() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm filters save full-pipeline \
    --section pipelines \
    --start-date 2026-01-01 \
    --end-date 2026-06-30 \
    --workflow-selector deploy \
    --job-selector build \
    --branch main,staging \
    --raw-filters "state=all" \
    --weekends exclude \
    --outlier-mode exclude
  assert_smm_success

  run_smm filters show full-pipeline
  assert_smm_success
  assert_smm_output_contains "startDate: 2026-01-01"
  assert_smm_output_contains "endDate: 2026-06-30"
  assert_smm_output_contains "workflowSelector: deploy"
  assert_smm_output_contains "jobSelector: build"
  assert_smm_output_contains "rawFilters: state=all"
  assert_smm_output_contains "weekends: exclude"
  assert_smm_output_contains "outlierMode: exclude"

  unset SMM_STORE_DATA_AT
}

function test_filters_save_with_all_change_requests_options() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm filters save full-change-request \
    --section change-requests \
    --start-date 2026-01-01 \
    --end-date 2026-06-30 \
    --change-request-status merged \
    --aggregate-by week \
    --weekends exclude \
    --outlier-mode flag
  assert_smm_success

  run_smm filters show full-change-request
  assert_smm_success
  assert_smm_output_contains "startDate: 2026-01-01"
  assert_smm_output_contains "endDate: 2026-06-30"
  assert_smm_output_contains "changeRequestStatus: merged"
  assert_smm_output_contains "aggregateBy: week"
  assert_smm_output_contains "weekends: exclude"
  assert_smm_output_contains "outlierMode: flag"

  unset SMM_STORE_DATA_AT
}

function test_filters_list_empty_renders_message() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm filters list
  assert_smm_success
  assert_smm_output_contains "No saved filters found."

  unset SMM_STORE_DATA_AT
}
