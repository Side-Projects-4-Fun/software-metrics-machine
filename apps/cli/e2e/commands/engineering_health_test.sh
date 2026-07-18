#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"

function run_seeded_engineering_health_command() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"
  seed_sqlite_pipelines_fixture "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm "$@"

  unset SMM_STORE_DATA_AT
}

function test_engineering_health_help_renders_successfully() {
  run_smm engineering-health --help

  assert_smm_success
  assert_smm_output_contains "Usage:"
  assert_smm_output_contains "engineering-health"
  assert_smm_output_contains "evaluate"
}

function test_engineering_health_evaluate_renders_text_output() {
  run_seeded_engineering_health_command \
    engineering-health evaluate \
    --metric pipeline-duration \
    --start-date 2026-02-01 \
    --end-date 2026-02-28

  assert_smm_success
  assert_smm_output_contains "Engineering Health"
  assert_smm_output_contains "Metric: pipeline-duration (delivery)"
  assert_smm_output_contains "Value: 15.00 minutes"
  assert_smm_output_contains "Trend: Insufficient data to compare periods."
  assert_smm_output_contains "Target: Average pipeline duration below ten minutes."
  assert_smm_output_contains "Recommendation: Metric is outside target and needs attention."
}

function test_engineering_health_evaluate_renders_json_output() {
  run_seeded_engineering_health_command \
    engineering-health evaluate \
    --metric pipeline-duration \
    --start-date 2026-02-01 \
    --end-date 2026-02-28 \
    --compare-start-date 2026-01-01 \
    --compare-end-date 2026-01-31 \
    --output json

  assert_smm_success
  assert_smm_output_contains '"generatedAt"'
  assert_smm_output_contains '"id": "pipeline-duration"'
  assert_smm_output_contains '"category": "delivery"'
  assert_smm_output_contains '"value": 15'
  assert_smm_output_contains '"unit": "minutes"'
  assert_smm_output_contains '"sampleSize": 2'
  assert_smm_output_contains '"trend": "degrading"'
  assert_smm_output_contains '"delta": 15'
  assert_smm_output_contains '"previous": 0'
  assert_smm_output_contains '"summary": "Metric degraded by 15.00 minutes."'
  assert_smm_output_contains '"operator": "lt"'
  assert_smm_output_contains '"description": "Average pipeline duration below ten minutes."'
  assert_smm_output_contains '"level": "critical"'
  assert_smm_output_contains '"summary": "Metric is outside target and needs attention."'
}
