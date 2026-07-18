#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"

function tune_engineering_health_pipelines_fixture() {
  local workspace="$1"

  node - "${workspace}" <<'NODE'
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const [workspace] = process.argv.slice(2);
const dbPath = path.join(workspace, 'github_acme_widgets', 'smm.sqlite');
const db = new DatabaseSync(dbPath);

try {
  const row = db
    .prepare('SELECT payload FROM workflow_jobs WHERE namespace = ? AND id = ?')
    .get('github/pipeline-jobs', '5001');

  if (!row || !row.payload) {
    process.exit(0);
  }

  const payload = JSON.parse(String(row.payload));
  payload.completed_at = '2026-02-03T10:10:00Z';

  if (Array.isArray(payload.steps)) {
    payload.steps = payload.steps.map((step) =>
      step && step.name === 'Test'
        ? { ...step, completed_at: '2026-02-03T10:10:00Z' }
        : step
    );
  }

  const encoded = JSON.stringify(payload);

  db.prepare(
    'UPDATE workflow_jobs SET completed_at = ?, payload = ? WHERE namespace = ? AND id = ?'
  ).run(
    '2026-02-03T10:10:00Z',
    encoded,
    'github/pipeline-jobs',
    '5001'
  );
} finally {
  db.close();
}
NODE
}

function run_seeded_engineering_health_command() {
  local workspace

  workspace="$(create_smm_e2e_workspace)"

  cat >"${workspace}/smm_config.json" <<JSON
{
  "projects": [
    {
      "git_provider": "github",
      "github_token": "test-token",
      "github_repository": "acme/widgets",
      "git_repository_location": "${workspace}/repo",
      "log_level": "DEBUG",
      "deployment_frequency_targets": [
        { "pipeline": ".github/workflows/deploy.yml", "job": "build" }
      ]
    }
  ]
}
JSON

  seed_sqlite_pipelines_fixture "${workspace}"
  tune_engineering_health_pipelines_fixture "${workspace}"
  export SMM_STORE_DATA_AT="${workspace}"

  run_smm "$@"

  unset SMM_STORE_DATA_AT
}

function test_engineering_health_help_renders_successfully() {
  run_smm engineering-health --help

  assert_smm_output_contains "Usage:"
  assert_smm_output_contains "engineering-health"
  assert_smm_output_contains "evaluate"
  assert_smm_success
}

function test_engineering_health_evaluate_renders_text_output() {
  run_seeded_engineering_health_command \
    engineering-health evaluate \
    --metric pipeline-duration \
    --start-date 2026-02-01 \
    --end-date 2026-02-28

  assert_smm_output_contains "Engineering Health"
  assert_smm_output_contains "Metric: pipeline-duration (delivery)"
  assert_smm_output_contains "Value: 15.00 minutes"
  assert_smm_output_contains "Trend: Insufficient data to compare periods."
  assert_smm_output_contains "Target: Average pipeline duration below ten minutes."
  assert_smm_output_contains "Recommendation: Metric is outside target and needs attention."
  assert_smm_success
}

function test_engineering_health_evaluate_renders_json_output() {
  run_seeded_engineering_health_command \
    engineering-health evaluate \
    --metric pipeline-duration \
    --pr-labels feature \
    --start-date 2026-02-01 \
    --end-date 2026-02-28 \
    --compare-start-date 2026-01-01 \
    --compare-end-date 2026-01-31 \
    --output json

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
  assert_smm_success
}

function test_engineering_health_evaluate_applies_pr_labels_to_output() {
  run_seeded_engineering_health_command \
    engineering-health evaluate \
    --metric review-time \
    --pr-labels feature \
    --start-date 2026-01-01 \
    --end-date 2026-01-31 \
    --output json

  assert_smm_output_contains '"id": "review-time"'
  assert_smm_output_contains '"category": "collaboration"'
  assert_smm_output_contains '"value": 0'
  assert_smm_output_contains '"unit": "days"'
  assert_smm_output_contains '"sampleSize": 0'
  assert_smm_success
}
