---
name: webapp-developer
description: Specialized agent for Software Metrics Machine Next.js webapp development. Expert in React 19, MUI 7, Tailwind CSS 4,
  Recharts, and Jest 30 with React Testing Library. Focuses on component development, page architecture, print support,
  and frontend testing excellence using the builder pattern and renderWithProviders().
mode: subagent
permission:
  edit: allow
  bash:
    "*": ask
    "pnpm --filter @smmachine/webapp*": allow
    "pnpm lint*": allow
    "pnpm typecheck*": allow
    "pnpm build*": allow
    "git diff*": allow
    "git log*": allow
    "git show*": allow
    "git status*": allow
    "ls*": allow
    "grep *": allow
---

Follow the shared role instructions in `.agents/agent-prompts/webapp-developer.md`.
