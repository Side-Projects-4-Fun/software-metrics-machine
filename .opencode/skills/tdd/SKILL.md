---
name: tdd
description: "Test-Driven Development workflow for Software Metrics Machine. Covers test frameworks (Vitest 4.x for CLI/REST/core/utils, Jest 30.x for webapp), test patterns (describe/it, builder pattern, mocks via vi.fn), test commands, coverage requirements, and the Red-Green-Refactor cycle. USE FOR: write tests, run tests, test this, add tests, testing, coverage, TDD, test-driven development, vitest, jest, test pattern, test convention. DO NOT USE FOR: linting (use lint skill), building (use build commands directly), debugging production issues."
---

# TDD Skill — Software Metrics Machine

## Test Frameworks

| Workspace | Framework | Config |
|-----------|-----------|--------|
| `packages/core` | Vitest 4.x | `vitest.config.ts` (extends `vitest.base.config.ts`) |
| `packages/utils` | Vitest 4.x | `vitest.config.ts` (extends `vitest.base.config.ts`) |
| `apps/cli` | Vitest 4.x | `vitest.config.ts` |
| `apps/rest` | Vitest 4.x | `vitest.config.ts` |
| `apps/webapp` | Jest 30.x | `jest.config.ts` (via `next/jest`) |

### Vitest base config (`vitest.base.config.ts`)
- `pool: 'forks'`, `fileParallelism: false`
- Test pattern: `**/__tests__/**/*.test.ts`
- Coverage: v8 provider, excludes `node_modules/`, `dist/`, test files
- `testTimeout: 20000`
- Globals enabled (`describe`, `it`, `expect`, `vi`)

### Webapp Jest config
- Environment: `jsdom`
- Setup: `jest.setup.ts`
- Module alias: `@/` maps to `<rootDir>/`
- Imports via `next/jest`

## Test Commands

```bash
pnpm test                          # all workspaces (via turbo)
pnpm --filter @smmachine/core test # single workspace
pnpm --filter @smmachine/cli test
pnpm --filter @smmachine/rest test
pnpm --filter @smmachine/webapp test
pnpm --filter @smmachine/utils test
pnpm --filter @smmachine/core exec vitest run --coverage  # with coverage
pnpm --filter @smmachine/core exec vitest run --reporter=verbose
```

## Test Location Convention

Tests live in `__tests__/` directories alongside their source:

```
packages/core/__tests__/
  domain-services.test.ts
  providers.test.ts
  infrastructure.test.ts
  providers/github/
    github-pr-client.test.ts
    pull-request-filters-repository.test.ts
    ...
```

## Test Patterns

### Structure
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ServiceName', () => {
  let service: ServiceName;
  let mockRepo: IRepository;

  beforeEach(() => {
    mockRepo = { /* vi.fn() mocks */ };
    service = new ServiceName(mockRepo);
  });

  it('should ...', async () => {
    const result = await service.doSomething();
    expect(result).toBeDefined();
  });
});
```

### Mocking
- Use `vi.fn()` for mock functions
- Use `vi.fn(async () => value)` for async mocks
- **ALL mocked data and mocks MUST go through builders** — never inline mock data or repository mocks directly in test files
- Use in-memory repository builders (`ReadPullRequestsRepositoryBuilder`, `PipelinesRepositoryBuilder`, `RepositoryBuilder<T>`) — these create real implementations, not mocks. If your test needs to spy on method calls, wrap with `vi.spyOn()` in the test itself.

### Builder Pattern (REQUIRED)
All test data and mocks MUST be created through builders. Do NOT inline mock objects or raw data in test files — this avoids repeating setup across files.

**Domain data builders** (in `packages/core/__tests__/builders/builders.ts`):
```typescript
import {
  PullRequestBuilder, PipelineRunBuilder, CommitBuilder,
  PullRequestJsonResponseBuilder, PullRequestCommentJsonResponseBuilder,
} from './builders/builders';

// Domain types
const pr = new PullRequestBuilder()
  .withAuthor('Alice')
  .withTitle('Feature X')
  .withCreatedAt('2024-01-01T00:00:00Z')
  .withMergedAt('2024-01-05T00:00:00Z')
  .withComments(3)
  .build();

// GitHub API response types (replaces ad-hoc createPullRequest() helpers)
const rawPr = new PullRequestJsonResponseBuilder()
  .withAuthor('alice')
  .withLabels([{ id: '1', node_id: '', url: '', name: 'bug', color: '', default: false, description: '' }])
  .withCreatedAt('2026-05-10T00:00:00Z')
  .build();

const comment = new PullRequestCommentJsonResponseBuilder()
  .withAuthor('reviewer')
  .withBody('Looks good')
  .withCreatedAt('2026-05-10T01:00:00Z')
  .build();
```

**In-memory repository builders** (in `packages/core/__tests__/builders/builders.ts`):
```typescript
import {
  ReadPullRequestsRepositoryBuilder,
  PipelinesRepositoryBuilder,
  RepositoryBuilder,
} from './builders/builders';

// IReadPullRequestsRepository (real in-memory impl)
const prRepo = new ReadPullRequestsRepositoryBuilder()
  .withPullRequests([prDetails1, prDetails2])
  .build();
const service = new PRsService(prRepo);

// IPipelinesRepository (real in-memory impl)
const pipelineRepo = new PipelinesRepositoryBuilder()
  .withPipelineRuns([run1, run2])
  .build();
const pipelinesService = new PipelinesService(pipelineRepo);

// Generic IRepository<T> (real in-memory impl)
const commitRepo = new RepositoryBuilder<Commit>()
  .withLoadAll([commit1, commit2])
  .build();
const pairingService = new PairingIndexService(commitRepo);

// If spying is needed, use vi.spyOn() in the test — builders never use vi.fn():
const spy = vi.spyOn(prRepo, 'loadPrsWithFilters');
```
```

### Assertions
- Prefer specific expectations over generic ones
- Validate field types, ranges, and formats (e.g. regex for date strings)
- Use `expect.objectContaining()` and `expect.arrayContaining()` for partial matching

### Webapp: user events (Jest + React Testing Library)

Prefer `userEvent` over `fireEvent` for simulating user interactions. `userEvent` fires the full sequence of events a real user would trigger (focus, keyDown, keyUp, etc.) while `fireEvent` only dispatches a single event.

```typescript
import userEvent from '@testing-library/user-event';

// Keyboard: focus the element, then dispatch
screen.getByRole('button', { name: /Next/ }).focus();
await userEvent.keyboard('{ArrowRight}');

// Clicks, typing, etc.
await userEvent.click(screen.getByRole('button', { name: /Save/ }));
await userEvent.type(screen.getByLabelText('Name'), 'hello');
```

Keep `fireEvent` only when `userEvent` cannot simulate the scenario (rare edge cases).

## Coverage

Coverage config is inherited from `vitest.base.config.ts`:
- Provider: `v8`
- Reporters: `text`, `json`, `html`, `lcov`
- Coverage excludes: `node_modules/`, `dist/`, `**/__tests__/**`, `**/*.test.ts`, `**/*.d.ts`

Run with: `pnpm --filter <workspace> exec vitest run --coverage`

## Red-Green-Refactor Workflow

1. **Red** — Write a failing test first (assert the expected behavior before implementing)
2. **Green** — Write minimal code to make the test pass
3. **Refactor** — Clean up the implementation while keeping tests green

## Guidelines

- Write tests for all new features and bug fixes
- Use `describe`/`it` blocks (not `test`)
- Tests must be deterministic (no reliance on external APIs or network)
- Integration tests go in `__tests__/providers/<name>/*.integration.test.ts` or `.test.ts`
- Prefix unused callback params with `_` (consistent with ESLint rule)
- Do NOT add `"type": "module"` to `packages/core` or `packages/utils` — this breaks Vitest
- **All test data and in-memory repositories MUST go through builders** — never create inline data objects or ad-hoc helper functions like `createPullRequest()`. Always use the builders in `packages/core/__tests__/builders/builders.ts`. If a builder doesn't exist for your type, add one — don't create inline helpers.
- **Builders must NEVER use `vi.fn()`** — they create real objects (plain data objects, in-memory implementations). If a test needs to spy on method calls or mock specific behavior, use `vi.spyOn()` or `vi.fn()` directly in the test file.
- When adding a new builder, follow the naming convention: `{TypeName}Builder` with `with{FieldName}()` methods returning `this` for chaining, and a `build(): TypeName` method that returns a shallow clone (`{ ...this.data }`).
- Source-level builders (like `PipelineGitHubRunBuilder` in `packages/core/src/test/`) are acceptable for production code, but test-only builders belong in `packages/core/__tests__/builders/builders.ts`.
