# CLI e2e tests

These tests use bashunit and execute the built CLI binary.

Run them from the CLI package:

```bash
pnpm run test:e2e
```

The runner expects `bashunit` at `apps/cli/lib/bashunit`, or through `BASHUNIT_BIN=/path/to/bashunit`.

Tests live under `commands/` and should expose `test_*` functions.

Use `support/bootstrap.sh` for shared helpers:

```bash
function test_my_command() {
  run_smm my-command --help

  assert_smm_success
  assert_smm_output_contains "Usage:"
}
```

Tests that need GitHub data should use the MSW runner instead of calling the real API:

```bash
function test_fetch() {
  workspace="$(create_smm_e2e_workspace)"
  export SMM_STORE_DATA_AT="${workspace}"
  export DEBUG=true

  run_smm_with_github_prs_msw prs fetch --force

  unset DEBUG
  unset SMM_STORE_DATA_AT
  assert_smm_success
}
```
