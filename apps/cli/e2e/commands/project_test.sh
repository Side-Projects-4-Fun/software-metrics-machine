#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"

function test_project_help_renders_successfully() {
  run_smm project --help

  assert_smm_output_contains "Usage:"
  assert_smm_output_contains "configure"
  assert_smm_output_contains "list"
  assert_smm_output_contains "delete"
  assert_smm_success
}

function test_project_configure_help_renders_successfully() {
  run_smm project configure --help

  assert_smm_output_contains "Usage:"
  assert_smm_output_contains "configure"
  assert_smm_success
}

function test_project_list_renders_configured_projects() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm project list

  unset SMM_STORE_DATA_AT

  assert_smm_output_contains "Configured projects:"
  assert_smm_output_contains "acme/widgets"
  assert_smm_output_contains "(github)"
  assert_smm_success
}

function test_project_list_prints_hint_when_data_dir_is_missing() {
  local empty_config_home

  empty_config_home="$(mktemp -d "${SMM_REPO_ROOT}/tmp/e2e/smm-project-config-home.XXXXXX")"

  unset SMM_STORE_DATA_AT
  export XDG_CONFIG_HOME="${empty_config_home}"

  run_smm project list

  unset XDG_CONFIG_HOME

  assert_smm_output_contains "smm project configure"
  assert_smm_success
}

function test_project_list_resolves_data_dir_from_user_settings() {
  local workspace
  local config_home
  local settings_dir

  workspace="$(create_smm_e2e_workspace)"
  config_home="$(mktemp -d "${SMM_REPO_ROOT}/tmp/e2e/smm-project-config-home.XXXXXX")"
  settings_dir="${config_home}/smm"

  mkdir -p "${settings_dir}"
  cat >"${settings_dir}/config.json" <<JSON
{
  "store_data_at": "${workspace}"
}
JSON

  unset SMM_STORE_DATA_AT
  export XDG_CONFIG_HOME="${config_home}"

  run_smm project list

  unset XDG_CONFIG_HOME

  assert_smm_output_contains "Configured projects:"
  assert_smm_output_contains "acme/widgets"
  assert_smm_output_contains "(github)"
  assert_smm_success
}

# Verifies that `smm project configure` clones the repository when the user
# leaves the local repository path empty, using a tiny public GitHub repo so
# the clone is fast and deterministic in shape.
#
# Skips gracefully when `expect` is unavailable (e.g. some CI images) so the
# suite stays green; the clone-when-empty logic is also covered by unit tests.
function test_project_configure_clones_repository_when_path_left_empty() {
  if ! command -v expect >/dev/null 2>&1; then
    assert_smm_equals "expect available" "expect available (skipped: expect not installed)"
    return
  fi

  local workspace
  local repo_dir
  local config_file

  workspace="$(mktemp -d "${SMM_REPO_ROOT}/tmp/e2e/smm-clone-e2e.XXXXXX")"
  config_file="${workspace}/smm_config.json"
  repo_dir="${workspace}/repos/octocat_Hello-World"

  run_smm_project_configure_clone "${workspace}" "octocat/Hello-World"

  assert_smm_success
  assert_smm_output_contains "No repository path provided. Cloning octocat/Hello-World"
  assert_smm_output_contains "Repository cloned to:"
  assert_smm_file_exists "${config_file}"
  assert_smm_file_contains "${config_file}" "octocat/Hello-World"
  assert_smm_file_contains "${config_file}" "${repo_dir}"
  assert_smm_file_exists "${repo_dir}/.git/HEAD"
}

function test_project_delete_help_renders_successfully() {
  run_smm project delete --help

  assert_smm_output_contains "Usage:"
  assert_smm_output_contains "delete"
  assert_smm_output_contains "--repository"
  assert_smm_output_contains "--provider"
  assert_smm_output_contains "--yes"
  assert_smm_success
}

function test_project_delete_removes_project_non_interactively() {
  local workspace
  local config_file

  workspace="$(create_smm_e2e_workspace)"
  config_file="${workspace}/smm_config.json"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm project delete --provider github --repository acme/widgets --yes

  unset SMM_STORE_DATA_AT

  assert_smm_output_contains "Project \"github/acme/widgets\" deleted."
  assert_smm_file_contains "${config_file}" "projects"
  assert_smm_file_not_contains "${config_file}" "acme/widgets"
  assert_smm_success
}

function test_project_delete_reports_missing_project() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm project delete --provider gitlab --repository acme/widgets --yes

  unset SMM_STORE_DATA_AT

  assert_smm_output_contains "No project found for \"gitlab/acme/widgets\""
  assert_smm_failure
}

function test_project_delete_requires_provider_with_repository() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm project delete --repository acme/widgets --yes

  unset SMM_STORE_DATA_AT

  assert_smm_output_contains "--provider is required when --repository is provided"
  assert_smm_failure
}

function test_project_delete_prints_hint_when_data_dir_is_missing() {
  local empty_config_home

  empty_config_home="$(mktemp -d "${SMM_REPO_ROOT}/tmp/e2e/smm-project-config-home.XXXXXX")"

  unset SMM_STORE_DATA_AT
  export XDG_CONFIG_HOME="${empty_config_home}"

  run_smm project delete

  unset XDG_CONFIG_HOME

  assert_smm_output_contains "smm project configure"
  assert_smm_success
}
