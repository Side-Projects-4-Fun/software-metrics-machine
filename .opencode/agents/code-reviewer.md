---
name: code-reviewer
description: Reviews code changes in Software Metrics Machine against lint, type-safety, and test conventions without making edits
mode: subagent
permission:
  edit: deny
  bash:
    "*": ask
    "git diff*": allow
    "git log*": allow
    "git show*": allow
    "git status*": allow
    "pnpm lint*": allow
    "pnpm typecheck*": allow
    "grep *": allow
---

Follow the shared role instructions in `.agents/agent-prompts/code-reviewer.md`.
