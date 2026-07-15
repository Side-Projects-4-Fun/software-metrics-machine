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

function seed_code_analysis_workspace() {
  local workspace="$1"
  local project_dir="${workspace}/github_acme_widgets"
  local codemaat_dir="${project_dir}/codemaat"
  local git_dir="${project_dir}/git"

  mkdir -p "${workspace}/repo/src" "${codemaat_dir}" "${git_dir}"

  cat >"${workspace}/repo/src/nested.ts" <<'TS'
export function pairs(rows: Array<{ columns: string[] }>) {
  for (const row of rows) {
    for (const column of row.columns) {
      console.log(column);
    }
  }
}
TS

  cat >"${codemaat_dir}/abs-churn.csv" <<'CSV'
date,added,deleted,commits
2026-03-01,10,2,1
2026-03-02,7,3,2
CSV

  cat >"${codemaat_dir}/coupling.csv" <<'CSV'
entity,coupled,degree,average-revs
src/checkout.ts,src/cart.ts,75,4
src/payment.ts,src/cart.ts,45,2
CSV

  cat >"${codemaat_dir}/entity-churn.csv" <<'CSV'
entity,added,deleted,commits
src/checkout.ts,10,2,1
src/cart.ts,7,3,2
CSV

  cat >"${codemaat_dir}/entity-effort.csv" <<'CSV'
entity,total-revs
src/cart.ts,5
src/checkout.ts,3
CSV

  cat >"${codemaat_dir}/entity-ownership.csv" <<'CSV'
entity,author,added,deleted
src/cart.ts,Alice,7,3
src/checkout.ts,Bob,10,2
CSV

  cat >"${git_dir}/commits.json" <<'JSON'
[
  {
    "hash": "1111111111111111111111111111111111111111",
    "author": "Alice",
    "email": "alice@example.com",
    "subject": "Pair on cart flow",
    "timestamp": "2026-03-03T10:00:00Z",
    "coAuthors": ["Bob"],
    "files": ["src/cart.ts"]
  },
  {
    "hash": "2222222222222222222222222222222222222222",
    "author": "Carol",
    "email": "carol@example.com",
    "subject": "Document checkout",
    "timestamp": "2026-03-04T10:00:00Z",
    "coAuthors": [],
    "files": []
  }
]
JSON
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

function test_code_big_o_analyzes_repository_source_file() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_code_analysis_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm code big-o --file src/nested.ts --output json

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "\"filePath\": \"src/nested.ts\""
  assert_smm_output_contains "\"classification\": \"O(n^2)\""
  assert_smm_output_contains "\"lineNumber\": 2"
}

function test_code_summary_reports_pairing_insights_from_commits_store() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_code_analysis_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm code summary --output json

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "\"pairingIndexPercentage\": 50"
  assert_smm_output_contains "\"totalAnalyzedCommits\": 2"
  assert_smm_output_contains "\"pairedCommits\": 1"
  assert_smm_output_contains "\"coAuthor\": \"Bob\""
}

function test_code_codemaat_fetch_help_renders_successfully() {
  run_smm code codemaat-fetch --help

  assert_smm_success
  assert_smm_output_contains "Usage:"
  assert_smm_output_contains "codemaat-fetch"
  assert_smm_output_contains "--start-date"
}

function test_code_codemaat_fetch_help_includes_group_depth_option() {
  run_smm code codemaat-fetch --help

  assert_smm_success
  assert_smm_output_contains "--group-depth"
}

function test_code_codemaat_fetch_help_includes_threshold_options() {
  run_smm code codemaat-fetch --help

  assert_smm_success
  assert_smm_output_contains "--min-revs"
  assert_smm_output_contains "--min-shared-revs"
  assert_smm_output_contains "--min-coupling"
}

function test_code_codemaat_fetch_reports_threshold_params_in_output() {
  local workspace

  workspace="$(create_code_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm code codemaat-fetch --start-date 2026-03-01 --end-date 2026-03-31 --group-depth 4 --min-revs 7 --min-shared-revs 9 --min-coupling 33 --force --output json

  unset SMM_STORE_DATA_AT

  assert_smm_output_contains "CodeMaat coupling thresholds: min_revs=7 min_shared_revs=9 min_coupling=33"
  assert_smm_success
}

function test_code_churn_reads_codemaat_churn_csv() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_code_analysis_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm code churn --start-date 2026-03-02 --output json

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "\"date\": \"2026-03-02\""
  assert_smm_output_contains "\"added\": 7"
  assert_smm_output_not_contains "\"date\": \"2026-03-01\""
}

function test_code_coupling_reads_codemaat_coupling_csv() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_code_analysis_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm code coupling --output json

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "\"entity\": \"src/checkout.ts\""
  assert_smm_output_contains "\"coupled\": \"src/cart.ts\""
  assert_smm_output_contains "\"degree\": 75"
}

function test_code_entity_churn_reports_total_churn() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_code_analysis_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm code entity-churn --top 1

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "=== Entity Churn Metrics ==="
  assert_smm_output_contains "Top Entities: 1"
  assert_smm_output_contains "Total Churn: 22"
}

function test_code_entity_effort_reads_codemaat_entity_effort_csv() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_code_analysis_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm code entity-effort --top 1 --output json

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "\"entityEffort\""
  assert_smm_output_contains "\"entity\": \"src/cart.ts\""
  assert_smm_output_contains "\"total-revs\": 5"
  assert_smm_output_not_contains "\"entity\": \"src/checkout.ts\""
}

function test_code_entity_ownership_filters_by_entity() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_code_analysis_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm code entity-ownership --entity cart --output json

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "\"ownership\""
  assert_smm_output_contains "\"entity\": \"src/cart.ts\""
  assert_smm_output_contains "\"author\": \"Alice\""
  assert_smm_output_not_contains "\"entity\": \"src/checkout.ts\""
}

function test_code_pairing_index_reports_pairing_percentage() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_code_analysis_workspace "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm code pairing-index --min-shared 1 --output json

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "\"pairingIndex\""
  assert_smm_output_contains "\"pairingIndexPercentage\": 50"
  assert_smm_output_contains "\"pairedCommits\": 1"
}
