---
description: Run the mandatory build verification gate (lint, typecheck, build, test)
agent: build
---

Run the full verification gate for Software Metrics Machine and report any failures with file references:

!`pnpm lint && pnpm typecheck && pnpm build && pnpm test`

Lint must report zero errors and zero warnings. If anything fails, fix it and re-run this exact sequence until it passes.
