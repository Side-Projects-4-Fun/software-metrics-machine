/**
 * Self-contained Cypress journey runner.
 *
 * The webapp fetches its data in server components, so a browser-level
 * interceptor (cy.intercept / MSW in the browser) can never see those requests.
 * Instead this runner:
 *
 *   1. boots the real Next.js dev server with `NODE_OPTIONS=--import` loading
 *      `cypress/mocks/server-preload.mjs`, which registers the MSW handlers for
 *      the REST API inside the Next.js Node process
 *   2. sets `SMM_REST_BASE_URL` to the reserved `REST_BASE_URL` host that MSW
 *      answers, so no request ever leaves the process
 *   3. waits until the webapp answers, then runs the Cypress specs in Chrome for
 *      Testing (see `resolveBrowser`)
 *   4. always tears the server down, and exits with the Cypress exit code
 *
 * Usage:
 *
 *   pnpm cy:run                               # runs every spec
 *   pnpm cy:run cypress/e2e/dashboard.cy.ts   # runs a single spec
 *   E2E_BROWSER=chrome pnpm cy:run            # uses an installed browser instead
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

import { REST_BASE_URL } from '../mocks/rest-fixtures.mjs';

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const preloadPath = path.join(projectRoot, 'cypress/mocks/server-preload.mjs');
const localBrowserMarker = path.join(
  path.resolve(projectRoot, '../..'),
  'tmp/chrome/default-browser-path',
);
const webappPort = Number(process.env.E2E_WEBAPP_PORT ?? 3100);
const webappUrl = `http://127.0.0.1:${webappPort}`;
const READINESS_TIMEOUT_MS = 180_000;
const READINESS_INTERVAL_MS = 1_000;

function log(message) {
  console.log(`[e2e] ${message}`);
}

/**
 * Resolution order for the test browser:
 *
 *   1. `E2E_CHROME_PATH` — explicit Chrome for Testing binary
 *   2. `E2E_BROWSER`     — any Cypress browser name or path (e.g. `chrome`)
 *   3. `tmp/chrome/default-browser-path` — written by `cy:install-browser`
 *   4. `defaultBrowser` from `cypress.config.ts` (Chrome for Testing)
 */
function resolveBrowser() {
  if (process.env.E2E_CHROME_PATH) {
    return process.env.E2E_CHROME_PATH;
  }

  if (process.env.E2E_BROWSER) {
    return process.env.E2E_BROWSER;
  }

  if (existsSync(localBrowserMarker)) {
    const executablePath = readFileSync(localBrowserMarker, 'utf8').trim();

    if (executablePath && existsSync(executablePath)) {
      return executablePath;
    }
  }

  return undefined;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForWebapp() {
  const deadline = Date.now() + READINESS_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(webappUrl, { redirect: 'manual' });

      if (response.status < 500) {
        return;
      }
    } catch {
      // server not accepting connections yet
    }

    await delay(READINESS_INTERVAL_MS);
  }

  throw new Error(`Webapp did not become ready at ${webappUrl} within ${READINESS_TIMEOUT_MS}ms`);
}

function stopProcess(child, name) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const forceKillTimer = setTimeout(() => {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    }, 5_000);

    child.once('exit', () => {
      clearTimeout(forceKillTimer);
      resolve();
    });

    log(`stopping ${name}`);

    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  });
}

function startWebapp() {
  const nextBin = require.resolve('next/dist/bin/next');
  const importFlag = `--import=${pathToFileURL(preloadPath).href}`;
  const nodeOptions = [process.env.NODE_OPTIONS, importFlag].filter(Boolean).join(' ');

  const child = spawn(process.execPath, [nextBin, 'dev', '--port', String(webappPort)], {
    cwd: projectRoot,
    detached: true,
    env: {
      ...process.env,
      NODE_OPTIONS: nodeOptions,
      SMM_REST_BASE_URL: REST_BASE_URL,
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const prefixLines = (stream, label) => {
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      for (const line of chunk.split('\n').filter(Boolean)) {
        log(`${label} ${line}`);
      }
    });
  };

  prefixLines(child.stdout, '[webapp]');
  prefixLines(child.stderr, '[webapp:err]');

  return child;
}

async function run() {
  const cypress = (await import('cypress')).default;
  const browser = resolveBrowser();
  let webapp;

  const cleanup = async () => {
    await stopProcess(webapp, 'webapp');
  };

  const signalHandler = () => {
    void cleanup().then(() => {
      process.exit(130);
    });
  };

  process.once('SIGINT', signalHandler);
  process.once('SIGTERM', signalHandler);

  try {
    log(`MSW preload: ${preloadPath}`);
    webapp = startWebapp();

    const exitedEarly = new Promise((_, reject) => {
      webapp.once('exit', (code) => {
        reject(new Error(`Webapp dev server exited before becoming ready (code ${code}).`));
      });
    });

    await Promise.race([waitForWebapp(), exitedEarly]);
    log(`Webapp ready on ${webappUrl}`);
    log(`Browser: ${browser ?? 'chrome-for-testing (from cypress.config.ts)'}`);

    const result = await cypress.run({
      config: { baseUrl: webappUrl },
      spec: process.argv[2],
      ...(browser ? { browser } : {}),
    });

    const failures = result.totalFailed ?? 0;
    const passed = result.totalPassed ?? 0;

    log(`Cypress finished: ${passed} passed, ${failures} failed`);

    await cleanup();
    process.exitCode = failures > 0 || result.status === 'failed' ? 1 : 0;
  } catch (error) {
    console.error('[e2e] run failed', error);
    await cleanup();
    process.exitCode = 1;
  } finally {
    process.removeListener('SIGINT', signalHandler);
    process.removeListener('SIGTERM', signalHandler);
  }
}

void run();
