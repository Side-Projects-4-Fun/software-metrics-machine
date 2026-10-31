/**
 * MSW Node preload for the Cypress journeys.
 *
 * `cypress/support/run-e2e.mjs` starts the Next.js dev server with
 * `NODE_OPTIONS=--import <this file>` and `SMM_REST_BASE_URL=REST_BASE_URL`, so
 * every REST call made by the server components or server actions is answered
 * by the MSW handlers below — no HTTP stub process and no app code changes.
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers.mjs';
import { REST_BASE_URL } from './rest-fixtures.mjs';

const server = setupServer(...handlers);

/**
 * Warn only for requests aimed at the mocked REST host — anything else (for
 * example Next.js' own advisory check) is real network traffic that must not be
 * intercepted.
 */
server.listen({
  onUnhandledRequest(request, print) {
    const { hostname } = new URL(request.url);

    if (hostname === new URL(REST_BASE_URL).hostname) {
      print.warning();
    }
  },
});

function stopServer() {
  server.close();
}

process.once('SIGTERM', stopServer);
process.once('SIGINT', stopServer);
process.once('beforeExit', stopServer);
