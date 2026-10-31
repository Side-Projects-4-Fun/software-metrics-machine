import { defineConfig } from 'cypress';

/**
 * Cypress is driven by `cypress/support/run-e2e.mjs`, which starts the Next.js
 * dev server with the MSW Node handlers preloaded and passes the run `baseUrl`.
 *
 * `baseUrl` below is only used when opening the runner manually (`pnpm cy:open`)
 * against an app you started yourself.
 */
export default defineConfig({
  e2e: {
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    // Next.js compiles routes on first request, which is slower than a warm app.
    pageLoadTimeout: 120_000,
    defaultCommandTimeout: 10_000,
  },
});
