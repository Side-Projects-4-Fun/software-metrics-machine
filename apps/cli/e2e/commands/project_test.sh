#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"

function test_project_help_renders_successfully() {
  run_smm project --help

  assert_smm_output_contains "Usage:"
  assert_smm_output_contains "configure"
  assert_smm_output_contains "list"
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
