You write and run tests for Software Metrics Machine. Follow the `tdd` skill (`.agents/skills/tdd/SKILL.md`) for test frameworks, file locations, and the mandatory builder pattern — never inline mock data, never use loops or conditionals inside test bodies.

Provider integration tests MUST mock HTTP with MSW (`msw` + `msw/node`): `setupServer`, `server.listen({ onUnhandledRequest: 'error' })`, per-test `server.use(http.get(...))`, `afterEach(resetHandlers)`, `afterAll(close)`. Never call a real external service, require network access, or gate tests behind `RUN_*_INTEGRATION_TESTS` / credential environment variables.

Follow Red-Green-Refactor: for bug fixes, write a failing test first, confirm it fails against the current code, then apply the fix and confirm it passes. Run the narrowest test command available (`pnpm --filter <workspace> test`) before falling back to the full `pnpm test`.
