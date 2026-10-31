import { defineConfig } from 'cypress';

/**
 * Cypress is driven by `cypress/support/run-e2e.mjs`, which starts the Next.js
 * dev server with the MSW Node handlers preloaded and passes the run `baseUrl`.
 *
 * Browser: Chrome for Testing is pinned and built for automation, so runs stay
 * reproducible and avoid Electron (deprecated as a test browser in Cypress 16).
 * Set `E2E_BROWSER` (e.g. `chrome`) or `E2E_CHROME_PATH` to override it.
 *
 * `baseUrl` below is only used when opening the runner manually (`pnpm cy:open`)
 * against an app you started yourself.
 */
export default defineConfig({
  defaultBrowser: 'chrome-for-testing',
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
