---
name: lint
description: "Linting and code quality workflow for Software Metrics Machine. Covers ESLint 9.x flat config, Prettier formatting, lint-staged (auto-fix on commit), per-workspace configs, TypeScript strict mode, and all lint commands. USE FOR: lint, eslint, prettier, format, code style, linting, lint fix, auto-fix, check style, code quality, lint-staged, typecheck, type-check, tsc noEmit. DO NOT USE FOR: writing tests (use tdd skill), building (use build commands), commit hooks setup."
---

# Lint Skill — Software Metrics Machine

## Tooling Stack

| Tool | Version | Role |
|------|---------|------|
| ESLint | 9.x | Flat config (`eslint.config.mjs`) |
| Prettier | — | Formatting (`.prettierrc.json`) |
| lint-staged | — | Auto-fix staged files on commit |
| TypeScript | 6.x | `tsc --noEmit` for type checking |

## Commands

```bash
pnpm lint                          # ESLint across all workspaces (via turbo)
pnpm typecheck                     # tsc --noEmit across all workspaces (via turbo)
pnpm --filter @smmachine/core lint # single workspace
pnpm --filter @smmachine/cli lint
pnpm run lint -- --fix <path>      # fix specific file
```

## ESLint Configuration (Root — `eslint.config.mjs`)

### Config objects:

1. **Global ignores**: `dist/**`, `node_modules/**`, `.next/**`
2. **Main config** (`**/src/**/*.ts`, ignores `*.d.ts`):
   - Parser: `@typescript-eslint/parser` with `project: true`
   - Rules:
     - `@typescript-eslint/no-explicit-any`: **error**
     - `@typescript-eslint/no-unused-vars`: **error** (prefix with `_` to ignore: `_unusedParam`)
     - `@typescript-eslint/explicit-function-return-type`: **warn**
     - `@typescript-eslint/no-floating-promises`: **error**
     - `prettier/prettier`: **error**
     - `no-console`: **warn** (allows `console.warn`, `console.error`)
3. **Test config** (`**/__tests__/**/*.ts`, `**/*.test.ts`, `**/*.config.ts`):
   - Same base rules but `no-explicit-any`: **off**
   - No `project: true` (avoids parser issues with test files)

## Per-Workspace Configs

Each workspace has its own `eslint.config.mjs`:

| Workspace | Config |
|-----------|--------|
| `packages/core` | Workspace-specific |
| `packages/utils` | Workspace-specific |
| `apps/cli` | CLI-specific |
| `apps/rest` | Imports root config |
| `apps/webapp` | Uses `eslint-config-next` (core-web-vitals + typescript) |
| Root | Primary shared config |

## Prettier (`.prettierrc.json`)

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

## lint-staged (`.lintstagedrc.json`)

Auto-fix runs on every commit via husky/lint-staged:

| Pattern | Action |
|---------|--------|
| `*.{ts,tsx}` | `eslint --fix` + `prettier --write` |
| `*.{json,md}` | `prettier --write` |

## Mandatory Pre-Change Checks

Before submitting any change, verify:

```bash
pnpm lint          # must pass (zero errors AND zero warnings)
pnpm typecheck     # must pass
pnpm build         # must pass
pnpm test          # must pass
```

This is enforced by the developer agent as the mandatory build verification step.

**Lint is a hard gate**: if `pnpm lint` reports any errors OR warnings, you MUST resolve every one of them before considering the task complete. Treat warnings with the same severity as errors. When the lint output includes fixable issues, run `pnpm lint -- --fix <path>` (or `pnpm --filter <workspace> lint -- --fix <path>` for a single workspace) to auto-fix them, then re-run `pnpm lint` to confirm there are zero issues remaining. If auto-fix cannot resolve an issue, edit the source manually until `pnpm lint` is clean.

## TypeScript Strict Mode

- `strict: true` in all `tsconfig.json` files
- `noUncheckedIndexedAccess`: true in some workspaces
- Type checking via `tsc --noEmit` (not part of the build step)
- Type errors fail CI

## Guidelines

- Never use `as any` or `@ts-ignore` unless absolutely necessary and commented
- Use `@typescript-eslint/no-explicit-any: error` — prefer `unknown` with proper narrowing
- Use `@typescript-eslint/no-floating-promises: error` — always `await` or `.catch()` promises
- Warnings are NOT tolerated — resolve all warnings and errors before completing any task
- Errors block the pipeline
- Running `pnpm lint --filter <workspace>` lints only a specific workspace
