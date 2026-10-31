# Cypress E2E Journeys

Happy-path user journeys for the webapp: the dashboard, the reports list/detail and the engineering health
report. Every spec asserts what a user sees, not implementation details.

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

## Layout

```
cypress/
├── e2e/
│   ├── dashboard.cy.ts            # /dashboard → insights overview
│   ├── reports.cy.ts              # /reports → report detail → back
│   └── engineering-health.cy.ts   # /engineering-health scorecards
├── mocks/
│   ├── rest-fixtures.mjs          # REST payloads (single source of truth)
│   ├── handlers.mjs               # MSW handlers for the payloads
│   └── server-preload.mjs         # msw/node server loaded into Next.js
└── support/
    ├── e2e.ts                     # Cypress support file
    └── run-e2e.mjs                # boots Next.js + MSW, runs Cypress, cleans up
```

## Adding a journey

1. Add the REST payload to `cypress/mocks/rest-fixtures.mjs` — the key is the endpoint path (`/pipelines/summary`),
   the value must match the type in `apps/webapp/server/api/*.ts`.
2. `handlers.mjs` picks it up automatically; no handler edit needed.
3. Write the spec in `cypress/e2e/`. Assert on user-visible content (headings, card text, aria labels) and prefer
   role/aria selectors over CSS classes.
4. Run it: `pnpm --filter @smmachine/webapp cy:run cypress/e2e/<spec>.cy.ts`.

Unhandled requests to the mocked host are reported as `[MSW] Warning: ...` in the run output — treat them as a
missing fixture rather than ignoring them.

## Notes

- No `cy.wait(ms)`: Cypress retries assertions; the runner already waits for the app to answer before starting.
- No browser-level interception of REST calls: it cannot see server component fetches.
- The stub is read-only apart from `PUT /filters`, which echoes the saved document back.
