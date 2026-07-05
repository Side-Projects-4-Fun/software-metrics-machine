#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"

function test_root_help_displays_available_commands() {
  run_smm --help

  assert_smm_success
  assert_smm_output_contains "Software Metrics Machine"
  assert_smm_output_contains "Commands:"
}

function test_root_version_prints_without_error() {
  run_smm --version

  assert_smm_success
  assert_smm_output_not_contains "error"
}
