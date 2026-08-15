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
- Setup: `jest.setup.ts` (provides global mocks for `next/navigation` and `next/headers`)
- Module alias: `@/` maps to `<rootDir>/`
- Imports via `next/jest`
- `clearMocks: true` — mock call/instance state is auto-cleared between tests; do NOT call `jest.clearAllMocks()` manually
- `testPathIgnorePatterns` excludes `__tests__/builders/` and `__tests__/utils/` from test discovery

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

### Assertions
- Prefer specific expectations over generic ones
- Validate field types, ranges, and formats (e.g. regex for date strings)
- Use `expect.objectContaining()` and `expect.arrayContaining()` for partial matching
- **Never use meaningless assertions** like `expect(container).toBeInTheDocument()` or `expect(document.body).toBeInTheDocument()` — they always pass and verify nothing. Assert the actual rendered content, element state, or role instead.

### Webapp test conventions (REQUIRED)

#### Builder pattern for webapp test data
All webapp test data MUST be created through the builders in `apps/webapp/__tests__/builders/builders.ts`. Do NOT inline config objects, report entries, saved filters, or filter state directly in test files.

```typescript
import {
  DashboardConfigurationBuilder,
  SavedFilterBuilder,
  ReportEntryBuilder,
  DashboardFiltersBuilder,
} from '../builders/builders';

// DashboardGlobalConfiguration — replaces inline mockConfig objects
const config = new DashboardConfigurationBuilder()
  .withGithubRepository('acme/widgets')
  .withDeploymentFrequencyTargets([{ pipeline: '.github/workflows/deploy.yml', job: 'deploy' }])
  .build();

// SavedFilterEntry — replaces inline filter objects and makeFilter() helpers
const filter = new SavedFilterBuilder()
  .withId('f-pipelines')
  .withName('CI Main')
  .withSection('pipelines')
  .withFilters(new DashboardFiltersBuilder().withStartDate('2026-01-01').build())
  .build();

// ReportEntry — replaces inline report objects and makeReport() helpers
const report = new ReportEntryBuilder()
  .withId('r1')
  .withName('Sprint 42')
  .withSections([{ section: 'pipelines', savedFilterId: 'f-pipelines' }])
  .withDateWindows([{ startDate: '2026-06-01', endDate: '2026-06-07', label: 'Week 1' }])
  .build();
```

When adding a new builder, follow the naming convention: `{TypeName}Builder` with `with{FieldName}()` methods returning `this` for chaining, and a `build(): TypeName` method that returns a shallow clone.

#### Shared provider setup
All webapp tests that render components MUST use `renderWithProviders()` from `apps/webapp/__tests__/utils/test-providers.tsx`. This mounts all required providers (ConfigurationProvider, ProjectsProvider, FiltersProvider, LinkBuilderProvider) in one call.

```typescript
import { renderWithProviders } from '../utils/test-providers';

// Default — uses DashboardConfigurationBuilder defaults
renderWithProviders(<MyComponent />);

// With options
renderWithProviders(<MyComponent />, {
  config: new DashboardConfigurationBuilder().withGithubRepository('acme/widgets').build(),
  initialFilters: new DashboardFiltersBuilder().withStartDate('2026-01-01').build(),
  projects: [{ github_repository: 'acme/widgets' }],
  initialActiveProject: 'acme/widgets',
});
```

Do NOT manually wrap components with individual providers in test files — use `renderWithProviders()` to avoid repetition and ensure all required context is present.

#### Global mocks (jest.setup.ts)
`jest.setup.ts` provides global mocks for `next/navigation` and `next/headers`. Do NOT re-declare `jest.mock('next/navigation', ...)` or `jest.mock('next/headers', ...)` in individual test files. If a test needs custom mock return values (e.g. `usePathname` returning a specific path), use `jest.requireMock('next/navigation')` to access and configure the existing mock:

```typescript
const navigation = jest.requireMock('next/navigation');
navigation.usePathname.mockReturnValue('/dashboard/pipelines');
```

#### Mock clearing
The Jest config has `clearMocks: true` which auto-clears all mock calls, instances, and results before every test. Do NOT call `jest.clearAllMocks()` or `mockFn.mockClear()` manually in `beforeEach` blocks. Keep `beforeEach` only for setting up mock return values.

#### userEvent over fireEvent
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

#### userEvent timeout (jsdom)
`userEvent.type()` simulates per-character typing which is slow under jsdom. Tests that perform multiple sequential `userEvent.type()` or `userEvent.click()` calls may exceed the default 5000ms Jest timeout. Set a higher per-test timeout for these tests:

```typescript
it('persists manual window dateWindows', async () => {
  // ... multiple userEvent.type() calls ...
}, 15000); // increase timeout for slow jsdom typing
```

#### Console suppression utility
When a test intentionally triggers `console.error` (e.g. testing error boundaries or context-missing throws), use the shared `suppressConsoleError()` utility instead of inline `jest.spyOn`:

```typescript
import { suppressConsoleError } from '../utils/suppress-console';

it('throws when used outside provider', () => {
  const suppression = suppressConsoleError();
  expect(() => renderHook(() => useFilters())).toThrow('useFilters must be used within a FiltersProvider');
  suppression.restore();
});
```

#### User flow tests
User flow tests live in `apps/webapp/__tests__/dashboard-pages/` and test complete user journeys across multiple components (e.g. report creation, multi-window editing, dashboard navigation). They verify behavior at the journey level rather than implementation details, giving confidence to refactor components without breaking tests. Flow tests MUST use `renderWithProviders()` and builders for all test data.

#### No `as never` or `as unknown` type casts
Do NOT use `as never` or `as unknown` to bypass TypeScript when mocking API return values. If mock data shape doesn't match the API type, either adjust the mock data to match or add a properly typed builder. Type casts hide type mismatches and make refactoring harder.

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
- Do NOT mock components under `@/components/` or reactjs hooks. 
- Do NOT use map, filters, foor loops in test code. Use builders to create test data and repositories instead. Prefer jest.each, vitest.each, or parameterized tests for multiple scenarios.
