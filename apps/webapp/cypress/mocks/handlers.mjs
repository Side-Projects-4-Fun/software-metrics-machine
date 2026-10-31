import { http, HttpResponse } from 'msw';
import { REST_BASE_URL, restResponses } from './rest-fixtures.mjs';

/**
 * MSW handlers for every REST endpoint the Cypress journeys touch.
 *
 * The webapp requests its data from `SMM_REST_BASE_URL` in server components,
 * so these handlers run in the Next.js Node process (see
 * `server-preload.mjs`) rather than in the browser.
 */
export const handlers = [
  ...Object.entries(restResponses).map(([pathname, body]) =>
    http.get(`${REST_BASE_URL}${pathname}`, () => HttpResponse.json(body)),
  ),

  // Saved filters/reports document writes (only exercised if a journey saves).
  http.put(`${REST_BASE_URL}/filters`, async ({ request }) =>
    HttpResponse.json(await request.json()),
  ),
];
