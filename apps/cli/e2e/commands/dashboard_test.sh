#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"

function test_dashboard_serve_starts_rest_and_webapp_servers() {
  local workspace pid_file log_file rest_port webapp_port host dashboard_pid

  if [[ ! -f "${SMM_REPO_ROOT}/dist/rest/main.cjs" ]] || [[ ! -d "${SMM_REPO_ROOT}/apps/webapp/.next" ]]; then
    return 0
  fi

  workspace="$(create_smm_e2e_workspace)"
  pid_file="${workspace}/dashboard.pid"
  log_file="${workspace}/dashboard.log"
  rest_port=5081
  webapp_port=5080
  host="127.0.0.1"

  (
    cd "${SMM_REPO_ROOT}" || exit 1
    SMM_STORE_DATA_AT="${workspace}" \
      nohup "${SMM_CLI_BIN}" dashboard serve \
        --rest-port "${rest_port}" \
        --webapp-port "${webapp_port}" \
        --host "${host}" \
        >"${log_file}" 2>&1 </dev/null &
    echo "$!" >"${pid_file}"
  )

  dashboard_pid="$(cat "${pid_file}")"

  sleep 5

  SMM_E2E_OUTPUT="$(<"${log_file}")"
  assert_smm_output_contains "Starting bundled dashboard services"
  assert_smm_output_contains "Host: ${host}"
  assert_smm_output_contains "REST API: http://${host}:${rest_port}"
  assert_smm_output_contains "Webapp: http://${host}:${webapp_port}"

  kill -TERM "${dashboard_pid}" 2>/dev/null || true
  wait "${dashboard_pid}" 2>/dev/null || true
  rm -f "${pid_file}"
}
