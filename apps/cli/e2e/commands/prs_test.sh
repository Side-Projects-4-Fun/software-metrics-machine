#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"

function test_prs_help_renders_successfully() {
  run_smm prs --help

  assert_smm_success
  assert_smm_output_contains "Usage:"
  assert_smm_output_contains "prs"
}

function test_prs_fetch_help_renders_successfully() {
  run_smm prs fetch --help

  assert_smm_success
  assert_smm_output_contains "Usage:"
  assert_smm_output_contains "fetch"
}

function test_prs_fetch_persists_pull_requests_from_mocked_github() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"
  export DEBUG=true

  run_smm_with_github_prs_msw prs fetch --force

  unset DEBUG
  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "Fetch data has been completed"
  assert_smm_output_contains "Fetching PRs page 1 for acme/widgets"
  assert_smm_output_contains "GET /repos/acme/widgets/pulls?state=all"
}
