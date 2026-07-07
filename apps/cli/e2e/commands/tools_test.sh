#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"

function sqlite_scalar() {
  local db_path="$1"
  local sql="$2"
  shift 2

  node -e '
const { DatabaseSync } = require("node:sqlite");
const [dbPath, sql, ...params] = process.argv.slice(1);
const db = new DatabaseSync(dbPath);
try {
  const row = db.prepare(sql).get(...params);
  const value = row ? Object.values(row)[0] : "";
  process.stdout.write(String(value ?? ""));
} finally {
  db.close();
}
' "${db_path}" "${sql}" "$@"
}

function test_tools_migrate_json_to_sqlite_persists_existing_json_stores() {
  local workspace
  local project_dir
  local github_dir
  local git_dir
  local sqlite_db

  workspace="$(create_smm_e2e_workspace)"
  project_dir="${workspace}/github_acme_widgets"
  github_dir="${project_dir}/github"
  git_dir="${project_dir}/git"
  sqlite_db="${project_dir}/smm.sqlite"

  mkdir -p "${github_dir}" "${git_dir}"

  cat >"${github_dir}/prs.json" <<'JSON'
[
  {
    "id": 101,
    "number": 7,
    "state": "closed",
    "title": "Add checkout flow",
    "user": { "id": 501, "login": "alice" },
    "created_at": "2026-01-10T09:00:00Z",
    "updated_at": "2026-01-11T09:00:00Z",
    "merged_at": "2026-01-11T10:00:00Z",
    "html_url": "https://github.com/acme/widgets/pull/7"
  },
  {
    "id": 102,
    "number": 8,
    "state": "open",
    "title": "Refine cart metrics",
    "user": { "id": 502, "login": "bob" },
    "created_at": "2026-01-12T09:00:00Z",
    "updated_at": "2026-01-12T11:00:00Z",
    "html_url": "https://github.com/acme/widgets/pull/8"
  }
]
JSON

  cat >"${github_dir}/pr-comments.json" <<'JSON'
[
  {
    "id": 9001,
    "pull_request_url": "https://api.github.com/repos/acme/widgets/pulls/7",
    "user": { "id": 601, "login": "reviewer" },
    "path": "src/cart.ts",
    "created_at": "2026-01-10T10:00:00Z",
    "updated_at": "2026-01-10T10:05:00Z",
    "html_url": "https://github.com/acme/widgets/pull/7#discussion_r9001"
  }
]
JSON

  cat >"${github_dir}/pull-request-filter-options.json" <<'JSON'
{
  "authors": ["alice", "bob"],
  "states": ["open", "closed"]
}
JSON

  cat >"${git_dir}/commits.json" <<'JSON'
[
  {
    "hash": "abc123",
    "author": "Alice",
    "email": "alice@example.com",
    "subject": "Add checkout flow",
    "timestamp": "2026-01-10T08:30:00Z",
    "files": ["src/cart.ts"]
  }
]
JSON

  export SMM_STORE_DATA_AT="${workspace}"

  run_smm tools migrate --from json --to sqlite

  unset SMM_STORE_DATA_AT

  assert_smm_success
  assert_smm_output_contains "Migrating storage from JSON to SQLite"
  assert_smm_output_contains "Migrated pull requests: 2 records"
  assert_smm_output_contains "Migrated pull request comments: 1 records"
  assert_smm_output_contains "Migrated pull request filter options: 1 record"
  assert_smm_output_contains "Migrated commits: 1 records"
  assert_smm_output_contains "Migration complete: 5 records across 4 stores"
  assert_smm_file_exists "${sqlite_db}"

  assert_smm_equals "2" "$(sqlite_scalar "${sqlite_db}" "SELECT COUNT(*) FROM pull_requests WHERE namespace = ?" "github/prs.json")"
  assert_smm_equals "alice" "$(sqlite_scalar "${sqlite_db}" "SELECT author_login FROM pull_requests WHERE namespace = ? AND number = 7" "github/prs.json")"
  assert_smm_equals "1" "$(sqlite_scalar "${sqlite_db}" "SELECT COUNT(*) FROM pull_request_comments WHERE namespace = ?" "github/pr-comments.json")"
  assert_smm_equals "7" "$(sqlite_scalar "${sqlite_db}" "SELECT pull_request_number FROM pull_request_comments WHERE namespace = ? AND id = ?" "github/pr-comments.json" "9001")"
  assert_smm_equals "1" "$(sqlite_scalar "${sqlite_db}" "SELECT COUNT(*) FROM commits WHERE namespace = ?" "git/commits.json")"
  assert_smm_equals "Alice" "$(sqlite_scalar "${sqlite_db}" "SELECT author FROM commits WHERE namespace = ? AND hash = ?" "git/commits.json" "abc123")"
  assert_smm_equals "1" "$(sqlite_scalar "${sqlite_db}" "SELECT COUNT(*) FROM repository_records WHERE namespace = ? AND record_key = ?" "github/pull-request-filter-options.json" "__singleton__")"
  assert_smm_equals "alice" "$(sqlite_scalar "${sqlite_db}" "SELECT json_extract(payload, '$.authors[0]') FROM repository_records WHERE namespace = ?" "github/pull-request-filter-options.json")"
}
