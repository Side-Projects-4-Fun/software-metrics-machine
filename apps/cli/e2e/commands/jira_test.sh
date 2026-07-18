#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"

function seed_jira_workspace() {
  local workspace="$1"
  seed_sqlite_jira_fixture "${workspace}"
}

function test_jira_fetch_issues_renders_cached_issues() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_jira_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm jira fetch-issues

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "Fetched 3 issues from Jira"
}

function test_jira_fetch_issues_output_json_renders_cached_issues() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_jira_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm jira fetch-issues --output json

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "KAN-123"
  assert_smm_output_contains "KAN-456"
  assert_smm_output_contains "In Progress"
  assert_smm_output_contains "Done"
}

function test_jira_fetch_changelog_requires_issue_parameter() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm jira fetch-changelog

  unset SMM_STORE_DATA_AT

  assert_smm_failure
  assert_smm_output_contains "--issue parameter is required"
}

function test_jira_fetch_changelog_with_issue_prints_message() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm jira fetch-changelog --issue KAN-123

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "Fetching changelog for issue KAN-123"
  assert_smm_output_contains "Python CLI for full changelog support"
}

function test_jira_fetch_comments_requires_issue_parameter() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm jira fetch-comments

  unset SMM_STORE_DATA_AT

  assert_smm_failure
  assert_smm_output_contains "--issue parameter is required"
}

function test_jira_fetch_comments_with_issue_prints_message() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm jira fetch-comments --issue KAN-123

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "Fetching comments for issue KAN-123"
  assert_smm_output_contains "Python CLI for full comment support"
}
