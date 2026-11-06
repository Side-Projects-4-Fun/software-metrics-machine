#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"

function seed_issues_workspace() {
  local workspace="$1"
  seed_sqlite_issues_fixture "${workspace}"
}

function test_issues_fetch_renders_cached_issues() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_issues_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm issues fetch

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "Fetched 3 issues from Jira"
}

function test_issues_fetch_output_json_renders_cached_issues() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_issues_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm issues fetch --output json

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "KAN-123"
  assert_smm_output_contains "KAN-456"
  assert_smm_output_contains "In Progress"
  assert_smm_output_contains "Done"
}

function test_issues_fetch_comments_with_issue_renders_cached_comments() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_issues_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm issues fetch-comments --issue KAN-123

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "Fetched 2 comments from Jira"
}

function test_issues_fetch_comments_without_issue_renders_cached_comments() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_issues_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm issues fetch-comments

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "fetching all comments can be slow on Jira"
  assert_smm_output_contains "Fetched 3 comments from Jira"
}

function test_issues_fetch_changelog_is_not_a_command() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm issues fetch-changelog

  unset SMM_STORE_DATA_AT

  assert_smm_failure
  assert_smm_output_contains "unknown command"
}

function test_jira_group_is_removed() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm jira fetch-issues

  unset SMM_STORE_DATA_AT

  assert_smm_failure
  assert_smm_output_contains "unknown command"
}

function test_issues_fetch_from_jira_csv_export() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  mkdir -p "${workspace}/github_acme_widgets"

  cat >"${workspace}/smm_config.json" <<JSON
{
  "projects": [
    {
      "git_provider": "github",
      "github_token": "test-token",
      "github_repository": "acme/widgets",
      "git_repository_location": "${workspace}/repo",
      "issues_provider": "jira-csv",
      "log_level": "DEBUG"
    }
  ]
}
JSON

  cat >"${workspace}/github_acme_widgets/Jira.csv" <<'CSV'
Summary,Issue key,Issue Type,Status,Project key,Assignee,Created,Updated,Resolved,Labels,Labels,Description,Comment
"Fix, checkout",KAN-1,Bug,Done,KAN,Alice,09/Oct/26 12:15 PM,10/Oct/26 09:00 AM,10/Oct/26 09:05 AM,smm,feature,Checkout bug,10/Oct/26 09:05 AM;user-1;Looks good
Slow cart,KAN-2,Task,To Do,KAN,Bob,11/Oct/26 08:00 AM,11/Oct/26 08:00 AM,,smm,,Cart latency,
CSV

  export SMM_STORE_DATA_AT="${workspace}"

  run_smm issues fetch --force
  assert_smm_success
  assert_smm_output_contains "Fetched 2 issues from Jira CSV"

  run_smm issues fetch-comments --issue KAN-1
  assert_smm_success
  assert_smm_output_contains "Fetched 1 comments from Jira CSV"

  unset SMM_STORE_DATA_AT
}

function test_issues_filters_save_and_list_across_sections() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm filters save issues-pipeline --section pipelines --start-date 2026-01-01
  assert_smm_success
  run_smm filters save issues-change-request --section change-requests --start-date 2026-01-01
  assert_smm_success

  run_smm filters list
  assert_smm_output_contains "[pipelines] issues-pipeline"
  assert_smm_output_contains "[change-requests] issues-change-request"
  assert_smm_success

  run_smm filters delete issues-pipeline
  assert_smm_success
  run_smm filters delete issues-change-request
  assert_smm_success

  unset SMM_STORE_DATA_AT
}
