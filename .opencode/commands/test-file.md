---
description: Run all tests in a specific file
---

Run the tests in `$ARGUMENTS`.

Determine which workspace owns this file:
- `apps/webapp/**` uses Jest — run `pnpm --filter @smmachine/webapp test -- $ARGUMENTS`.
- Any other workspace (`apps/cli`, `apps/rest`, `packages/core`, `packages/utils`) uses Vitest — run `pnpm --filter <workspace> exec vitest run $ARGUMENTS`.

Report pass/fail results and any failing assertions.
