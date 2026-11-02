/**
 * Cypress E2E support file.
 *
 * The journeys run against the real Next.js app. REST responses are produced by
 * the MSW handlers in `cypress/mocks/handlers.mjs`, loaded into the Next.js Node
 * process by `cypress/support/run-e2e.mjs` through `--import`.
 *
 * Because data is loaded in server components, browser-level API interception
 * (cy.intercept / msw/browser) cannot see those requests — do not reintroduce it
 * here.
 */

/**
 * React 19 development builds report Server Component render timings through
 * `performance.measure`. Cypress hosts the application in a proxied document
 * whose `performance.timeOrigin` lands after the server's, so the derived
 * timestamps go negative and Chrome rejects the measure. It is dev-only
 * instrumentation noise — rendering and hydration still complete.
 *
 * Only these known-noise messages are filtered; every other uncaught
 * application error must keep failing the journey.
 */
const KNOWN_NOISE = ['cannot have a negative time stamp', 'Minified React error #418'];

Cypress.on('uncaught:exception', (error) => !KNOWN_NOISE.some((message) => error.message.includes(message)));

export {};
