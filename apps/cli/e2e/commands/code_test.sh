#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"

function create_code_workspace() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"

  git -C "${workspace}/repo" init --initial-branch=main >/dev/null 2>&1
  git -C "${workspace}/repo" config user.name "Alice"
  git -C "${workspace}/repo" config user.email "alice@example.com"
  git -C "${workspace}/repo" config commit.gpgsign false

  printf '%s\n' "checkout" >"${workspace}/repo/checkout.txt"
  git -C "${workspace}/repo" add checkout.txt
  GIT_AUTHOR_DATE="2026-03-01T10:00:00Z" \
    GIT_COMMITTER_DATE="2026-03-01T10:00:00Z" \
    git -C "${workspace}/repo" commit -m "Add checkout metrics" >/dev/null 2>&1

  printf '%s\n' "cart" >"${workspace}/repo/cart.txt"
  git -C "${workspace}/repo" add cart.txt
  GIT_AUTHOR_NAME="Bob" \
    GIT_AUTHOR_EMAIL="bob@example.com" \
    GIT_AUTHOR_DATE="2026-03-02T10:00:00Z" \
    GIT_COMMITTER_DATE="2026-03-02T10:00:00Z" \
    git -C "${workspace}/repo" commit -m "Add cart metrics" >/dev/null 2>&1

  printf '%s\n' "${workspace}"
}

function test_code_fetch_commits_help_renders_successfully() {
  run_smm code fetch-commits --help

  assert_smm_success
  assert_smm_output_contains "Usage:"
  assert_smm_output_contains "fetch-commits"
  assert_smm_output_contains "--buffer"
}

function test_code_fetch_commits_persists_commits_from_git_repository() {
  local workspace
  local commits_file

  workspace="$(create_code_workspace)"
  commits_file="${workspace}/github_acme_widgets/git/commits.json"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm code fetch-commits --force --output json

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "\"commits\": 2"
  assert_smm_file_exists "${commits_file}"
  assert_smm_file_contains "${commits_file}" "\"author\": \"Alice\""
  assert_smm_file_contains "${commits_file}" "\"author\": \"Bob\""
  assert_smm_file_contains "${commits_file}" "\"subject\": \"Add checkout metrics\""
}

function test_code_fetch_commits_filters_by_author() {
  local workspace

  workspace="$(create_code_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm code fetch-commits --force --authors Bob --output json

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "\"commits\": 1"
}
