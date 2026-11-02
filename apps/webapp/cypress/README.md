# Cypress E2E Journeys

Happy-path user journeys for the webapp: the dashboard, the reports list/detail, the engineering health
report and the layout drawers. Every spec asserts what a user sees, not implementation details.

## Why MSW runs in Node, not in the browser

The webapp never calls the REST API from the browser: pages are React Server Components that fetch
`SMM_REST_BASE_URL` from `apps/webapp/server/api/client.ts` inside the Next.js Node process (the same is true for
server actions such as the saved-filter lookups). A browser service worker — the classic `msw/browser` setup —
therefore cannot observe those requests.

The suite runs MSW in Node instead:

```
cypress/support/run-e2e.mjs
  └─ spawns `next dev` with NODE_OPTIONS=--import cypress/mocks/server-preload.mjs
       ├─ server-preload.mjs calls setupServer(...handlers) (msw/node)
       └─ SMM_REST_BASE_URL=http://smm-rest-stub.local
            └─ every request is answered by handlers.mjs — nothing hits the network
```

`REST_BASE_URL` is a reserved host that never resolves; MSW answers it before any socket is opened.

## Running

```bash
# Everything (boots the app + MSW, then runs all specs)
pnpm --filter @smmachine/webapp cy:run
pnpm --filter @smmachine/webapp test:e2e   # same thing

# A single spec
pnpm --filter @smmachine/webapp cy:run cypress/e2e/dashboard.cy.ts

# Interactive runner against your own dev server (real REST API on :8000)
pnpm --filter @smmachine/webapp dev        # terminal 1
pnpm --filter @smmachine/webapp cy:open    # terminal 2
```

The first run on a fresh clone needs the Cypress binary (build scripts are not auto-approved in this repo):

```bash
pnpm --filter @smmachine/webapp exec cypress install
```

## Browser: Chrome for Testing

`cypress.config.ts` sets `defaultBrowser: 'chrome-for-testing'`. Chrome for Testing is pinned, never auto-updates, and
is built for automation — stable Chrome silently changes between runs, and Cypress 16 deprecates Electron as a test
browser. Cypress cannot download browsers itself, so install it once:

```bash
pnpm --filter @smmachine/webapp cy:install-browser        # latest stable
pnpm --filter @smmachine/webapp cy:install-browser 156    # pinned major
```

The installer writes the binary into `tmp/chrome/` (git-ignored) and records its path, which `run-e2e.mjs` picks up
automatically. Resolution order:

1. `E2E_CHROME_PATH` — explicit Chrome for Testing binary
2. `E2E_BROWSER` — any browser Cypress knows (`chrome`, `firefox`, …) or a path
3. `tmp/chrome/default-browser-path` — written by `cy:install-browser`
4. `defaultBrowser` from `cypress.config.ts`

CI installs Chrome for Testing with `browser-actions/setup-chrome` and passes the binary path through
`E2E_CHROME_PATH`.

## Layout

```
cypress/
├── e2e/
│   ├── dashboard.cy.ts            # /dashboard → insights overview
│   ├── reports.cy.ts              # /reports → report detail → back
│   ├── engineering-health.cy.ts   # /engineering-health scorecards
│   └── layout.cy.ts               # closed/open drawer hit-testing
├── pages/
│   └── app-shell.page.ts          # page object: drawers, content, hit-testing
├── mocks/
│   ├── rest-fixtures.mjs          # REST payloads (single source of truth)
│   ├── handlers.mjs               # MSW handlers for the payloads
│   └── server-preload.mjs         # msw/node server loaded into Next.js
└── support/
    ├── e2e.ts                     # Cypress support file
    ├── install-browser.mjs        # installs Chrome for Testing into tmp/chrome
    └── run-e2e.mjs                # boots Next.js + MSW, runs Cypress, cleans up
```

## Selectors: page objects and `data-testid` only

Specs never hold selectors. They call a page object from `cypress/pages/`, and the page object is the only
place that knows how a component is structured.

- **`data-testid` is the contract.** A page object may only use `[data-testid="…"]`. No CSS classes, no MUI
  internals (`.MuiDrawer-root`), no text matching. Refactoring a component's markup must not touch a spec.
- **Missing a test id? Add it, don't work around it.** Render it in the component next to the behaviour it
  exposes. MUI rejects arbitrary `data-*` keys on slot props by design, so slot roots (for example the
  persistent `Drawer` docked root, which carries the `pointer-events` guard) are declared in
  `types/mui-data-attributes.d.ts` via MUI's documented `DataAttributesOverrides` augmentation.
- **One page object per screen or shell.** `AppShellPage` covers the drawers and the main content of every
  dashboard route; add a sibling file when a new screen needs its own interactions.

## Journeys assert the initial layout, not React state

The persistent drawers apply their `pointer-events` guard on the server render, so the layout journeys read
the state a route starts in and hit-test it with `document.elementFromPoint`. The Cypress browser does not
reliably finish hydration in dev mode, and a `cy.click()` dispatched before hydration never reaches a React
handler, so a journey that depends on it can silently assert stale state.

- Pick the route whose initial layout shows the state under test: `/dashboard/pipelines/` starts with the
  filters panel open, `/engineering-health/` starts with it closed (`initialFiltersOpen={false}`).
- Cover open/close transitions in Jest (`__tests__/app-shell.test.tsx`), where React runs normally.
- Navigation clicks on anchors are safe — the browser follows `href` even without hydration.

## Adding a journey

1. Add the REST payload to `cypress/mocks/rest-fixtures.mjs` — the key is the endpoint path (`/pipelines/summary`),
   the value must match the type in `apps/webapp/server/api/*.ts`.
2. `handlers.mjs` picks it up automatically; no handler edit needed.
3. Add the missing `data-testid` to the component, then the matching accessor/action to the page object in
   `cypress/pages/`. The spec imports the page object and only calls its methods.
4. Run it: `pnpm --filter @smmachine/webapp cy:run cypress/e2e/<spec>.cy.ts`.

Unhandled requests to the mocked host are reported as `[MSW] Warning: ...` in the run output — treat them as a
missing fixture rather than ignoring them.

## Notes

- No `cy.wait(ms)`: Cypress retries assertions; the runner already waits for the app to answer before starting.
- No browser-level interception of REST calls: it cannot see server component fetches.
- The stub is read-only apart from `PUT /filters`, which echoes the saved document back.
- Runs target Chrome for Testing, not Electron or the auto-updating Chrome channel.
