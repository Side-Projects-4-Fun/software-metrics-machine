#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"

function seed_architecture_workspace() {
  local workspace="$1"
  seed_sqlite_architecture_fixture "${workspace}"
}

function test_architecture_list_snapshots_renders_empty_when_no_snapshots() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm architecture list-snapshots

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "No snapshots found"
}

function test_architecture_list_snapshots_renders_cached_snapshots() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_architecture_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm architecture list-snapshots

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "snap-1"
  assert_smm_output_contains "42"
  assert_smm_output_contains "container"
  assert_smm_output_contains "context"
}

function test_architecture_export_renders_view_json() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_architecture_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm architecture export --snapshot-id snap-1 --view container

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "Web Application"
  assert_smm_output_contains "REST API"
  assert_smm_output_contains "webapp"
  assert_smm_output_contains "api"
}

function test_architecture_export_renders_mermaid_output() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_architecture_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm architecture export --snapshot-id snap-1 --view container --format mermaid

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "flowchart LR"
  assert_smm_output_contains "Web Application"
  assert_smm_output_contains "REST API"
}

function test_architecture_generate_creates_snapshot_from_git_repo() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"

  git -C "${workspace}/repo" init --initial-branch=main >/dev/null 2>&1
  git -C "${workspace}/repo" config user.name "Test"
  git -C "${workspace}/repo" config user.email "test@test.com"
  git -C "${workspace}/repo" config commit.gpgsign false

  printf '{"a":1}' >"${workspace}/repo/package.json"
  git -C "${workspace}/repo" add -A
  git -C "${workspace}/repo" commit -m "init" >/dev/null 2>&1

  export SMM_STORE_DATA_AT="${workspace}"

  run_smm architecture generate

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "Architecture Snapshot Generated"
  assert_smm_output_contains "Project: acme/widgets"
  assert_smm_output_contains "Commits considered: 1"
  assert_smm_output_contains "Views:"
}

function test_architecture_export_fails_for_missing_snapshot() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm architecture export --snapshot-id nonexistent --view container

  unset SMM_STORE_DATA_AT

  assert_smm_failure
  assert_smm_output_contains "No architecture view found"
}
