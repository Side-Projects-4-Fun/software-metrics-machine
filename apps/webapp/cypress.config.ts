import { defineConfig } from 'cypress';

export default defineConfig({
  defaultBrowser: 'chrome-for-testing',
  e2e: {
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,

    video: Boolean(process.env.CI),
    videoCompression: 32,
    screenshotOnRunFailure: true,

    pageLoadTimeout: 120_000,
    defaultCommandTimeout: 10_000,
  },
});
