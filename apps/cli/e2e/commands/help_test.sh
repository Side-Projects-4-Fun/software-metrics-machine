#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"

function test_command_help_pages_render_successfully() {
  local commands=(
    "change-requests"
    "pipelines"
    "code"
    "issues"
    "sonarqube"
    "dashboard"
    "tools"
    "health-check"
    "mcp"
    "architecture"
    "engineering-health"
    "metrics"
    "filters"
    "project"
  )

  for command in "${commands[@]}"; do
    run_smm "${command}" --help

    assert_smm_output_contains "Usage:"
    assert_smm_success
  done
}
