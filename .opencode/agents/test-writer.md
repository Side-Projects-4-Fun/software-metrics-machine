---
name: test-writer
description: Writes and runs Vitest/Jest tests in Software Metrics Machine following the builder-pattern and TDD conventions
mode: subagent
permission:
  bash:
    "*": ask
    "pnpm test*": allow
    "pnpm --filter*": allow
    "pnpm run test*": allow
    "pnpm vitest*": allow
---

Follow the shared role instructions in `.agents/agent-prompts/test-writer.md`.
