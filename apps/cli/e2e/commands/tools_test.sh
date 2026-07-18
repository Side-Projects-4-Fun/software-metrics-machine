#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"

function test_tools_json_merge_help_renders_successfully() {
  run_smm tools json-merge --help

  assert_smm_success
  assert_smm_output_contains "Usage:"
  assert_smm_output_contains "json-merge"
  assert_smm_output_contains "--input"
  assert_smm_output_contains "--output"
  assert_smm_output_contains "--pretty"
}

function test_tools_json_merge_merges_object_json_files_into_one() {
  local workspace
  local source_dir

  workspace="$(create_smm_e2e_workspace)"
  source_dir="${workspace}/json-merge"
  mkdir -p "${source_dir}"

  cat >"${source_dir}/file1.json" <<'JSON'
{ "name": "Alice", "role": "developer" }
JSON

  cat >"${source_dir}/file2.json" <<'JSON'
{ "company": "Acme", "project": "widgets" }
JSON

  export SMM_STORE_DATA_AT="${workspace}"

  local original_dir
  original_dir="$(pwd)"
  cd "${source_dir}"
  run_smm tools json-merge --output "${workspace}/merged.json"
  cd "${original_dir}"

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "Merged JSON saved to:"
  assert_smm_output_contains "Total items: 4"
  assert_smm_file_exists "${workspace}/merged.json"
  assert_smm_file_contains "${workspace}/merged.json" "Alice"
  assert_smm_file_contains "${workspace}/merged.json" "Acme"
}

function test_tools_json_merge_merges_array_json_files_into_one() {
  local workspace
  local source_dir

  workspace="$(create_smm_e2e_workspace)"
  source_dir="${workspace}/json-merge-arrays"
  mkdir -p "${source_dir}"

  cat >"${source_dir}/arr1.json" <<'JSON'
[{ "id": 1, "name": "Alice" }]
JSON

  cat >"${source_dir}/arr2.json" <<'JSON'
[{ "id": 2, "name": "Bob" }, { "id": 3, "name": "Charlie" }]
JSON

  export SMM_STORE_DATA_AT="${workspace}"

  local original_dir
  original_dir="$(pwd)"
  cd "${source_dir}"
  run_smm tools json-merge --output "${workspace}/merged-array.json"
  cd "${original_dir}"

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "Merged JSON saved to:"
  assert_smm_output_contains "Total items: 3"
  assert_smm_file_exists "${workspace}/merged-array.json"
  assert_smm_file_contains "${workspace}/merged-array.json" "Alice"
  assert_smm_file_contains "${workspace}/merged-array.json" "Charlie"
}

