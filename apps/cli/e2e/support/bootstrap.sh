#!/usr/bin/env bash
set -uo pipefail

SMM_E2E_STATUS=0
SMM_E2E_OUTPUT=''
SMM_E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SMM_REPO_ROOT="$(cd "${SMM_E2E_DIR}/../../.." && pwd)"

run_smm() {
  SMM_E2E_OUTPUT="$("${SMM_CLI_BIN}" "$@" 2>&1)"
  SMM_E2E_STATUS=$?
  return 0
}

assert_smm_equals() {
  local expected="$1"
  local actual="$2"

  if declare -F assert_equals >/dev/null 2>&1; then
    assert_equals "${expected}" "${actual}"
    return
  fi

  [[ "${expected}" == "${actual}" ]]
}

assert_smm_success() {
  assert_smm_equals "0" "${SMM_E2E_STATUS}"
}

assert_smm_failure() {
  if [[ "${SMM_E2E_STATUS}" -eq 0 ]]; then
    assert_smm_equals "non-zero exit status" "0"
  fi
}

assert_smm_output_contains() {
  local expected="$1"

  if [[ "${SMM_E2E_OUTPUT}" == *"${expected}"* ]]; then
    assert_smm_equals "${expected}" "${expected}"
    return
  fi

  assert_smm_equals "${expected}" "${SMM_E2E_OUTPUT}"
}

assert_smm_output_not_contains() {
  local unexpected="$1"

  if [[ "${SMM_E2E_OUTPUT}" != *"${unexpected}"* ]]; then
    assert_smm_equals "output without ${unexpected}" "output without ${unexpected}"
    return
  fi

  assert_smm_equals "output without ${unexpected}" "${SMM_E2E_OUTPUT}"
}

assert_smm_file_exists() {
  local file_path="$1"

  if [[ -f "${file_path}" ]]; then
    assert_smm_equals "${file_path}" "${file_path}"
    return
  fi

  assert_smm_equals "existing file ${file_path}" "missing file ${file_path}"
}

assert_smm_file_contains() {
  local file_path="$1"
  local expected="$2"
  local content=''

  if [[ -f "${file_path}" ]]; then
    content="$(<"${file_path}")"
  fi

  if [[ "${content}" == *"${expected}"* ]]; then
    assert_smm_equals "${expected}" "${expected}"
    return
  fi

  assert_smm_equals "${expected}" "${content}"
}

create_smm_e2e_workspace() {
  local workspace
  local tmp_root="${SMM_REPO_ROOT}/tmp/e2e"

  mkdir -p "${tmp_root}"
  workspace="$(mktemp -d "${tmp_root}/smm-cli-e2e.XXXXXX")"
  mkdir -p "${workspace}/repo"

  cat >"${workspace}/smm_config.json" <<JSON
{
  "projects": [
    {
      "git_provider": "github",
      "github_token": "test-token",
      "github_repository": "acme/widgets",
      "git_repository_location": "${workspace}/repo",
      "log_level": "DEBUG"
    }
  ]
}
JSON

  printf '%s\n' "${workspace}"
}

run_smm_with_github_prs_msw() {
  SMM_E2E_OUTPUT="$(node "${SMM_E2E_DIR}/support/github-prs-msw-runner.mjs" "$@" 2>&1)"
  SMM_E2E_STATUS=$?
  return 0
}
