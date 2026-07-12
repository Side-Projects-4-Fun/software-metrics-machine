#!/usr/bin/env bash
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/support/bootstrap.sh"

function run_smm_mcp_request() {
  local request="$1"
  SMM_E2E_OUTPUT="$(echo "${request}" | "${SMM_CLI_BIN}" mcp server start 2>/dev/null)"
  SMM_E2E_STATUS=$?
}

function test_mcp_server_initialize_responds_with_protocol_info() {
  run_smm_mcp_request '{"jsonrpc":"2.0","id":1,"method":"initialize"}'

  assert_smm_success
  assert_smm_output_contains '"jsonrpc":"2.0"'
  assert_smm_output_contains '"id":1'
  assert_smm_output_contains '"protocolVersion":"2025-06-18"'
  assert_smm_output_contains '"serverInfo"'
  assert_smm_output_contains '"name":"software-metrics-machine"'
}

function test_mcp_server_ping_responds_with_empty_result() {
  run_smm_mcp_request '{"jsonrpc":"2.0","id":2,"method":"ping"}'

  assert_smm_success
  assert_smm_output_contains '"id":2'
  assert_smm_output_contains '"result":{}'
}

function test_mcp_server_tools_list_returns_available_tools() {
  run_smm_mcp_request '{"jsonrpc":"2.0","id":3,"method":"tools/list"}'

  assert_smm_success
  assert_smm_output_contains '"id":3'
  assert_smm_output_contains '"tools"'
}

function test_mcp_server_unknown_method_returns_error() {
  run_smm_mcp_request '{"jsonrpc":"2.0","id":4,"method":"unknown"}'

  assert_smm_success
  assert_smm_output_contains '"id":4'
  assert_smm_output_contains '"error"'
  assert_smm_output_contains '"code":-32601'
  assert_smm_output_contains '"message":"Method not found: unknown"'
}

function test_mcp_server_invalid_json_returns_parse_error() {
  run_smm_mcp_request 'not-json'

  assert_smm_success
  assert_smm_output_contains '"error"'
  assert_smm_output_contains '"code":-32700'
}

function test_mcp_server_invalid_rpc_request_returns_invalid_request_error() {
  run_smm_mcp_request '{"jsonrpc":"2.0","method":123}'

  assert_smm_success
  assert_smm_output_contains '"error"'
  assert_smm_output_contains '"code":-32600'
  assert_smm_output_contains '"message":"Invalid JSON-RPC request"'
}
