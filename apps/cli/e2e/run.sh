#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_DIR="${ROOT_DIR}/e2e/commands"

export SMM_CLI_BIN="${SMM_CLI_BIN:-${ROOT_DIR}/dist/index.cjs}"

if [[ ! -x "${SMM_CLI_BIN}" ]]; then
  echo "CLI binary not found or not executable: ${SMM_CLI_BIN}" >&2
  echo "Run: pnpm --filter @smmachine/cli build" >&2
  exit 1
fi

BASHUNIT_BIN="${BASHUNIT_BIN:-${ROOT_DIR}/lib/bashunit}"

if [[ ! -x "${BASHUNIT_BIN}" ]]; then
  echo "bashunit binary not found or not executable: ${BASHUNIT_BIN}" >&2
  echo "Install bashunit at apps/cli/lib/bashunit, or set BASHUNIT_BIN." >&2
  exit 1
fi

exec "${BASHUNIT_BIN}" "${TEST_DIR}"
