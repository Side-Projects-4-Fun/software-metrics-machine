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

export {};
