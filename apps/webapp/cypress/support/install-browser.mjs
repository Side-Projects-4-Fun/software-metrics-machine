/**
 * Installs Chrome for Testing into the repo-scoped `tmp/chrome` folder and
 * records the binary path so `run-e2e.mjs` picks it up automatically.
 *
 * Cypress cannot download browsers itself, and Chrome for Testing is not
 * installed by default, so this is the one-time local setup for the default
 * browser in `cypress.config.ts`.
 *
 * Usage:
 *
 *   pnpm --filter @smmachine/webapp cy:install-browser        # latest stable
 *   pnpm --filter @smmachine/webapp cy:install-browser 156    # pinned major
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const installDir = path.join(path.resolve(projectRoot, '../..'), 'tmp/chrome');
const version = process.argv[2] ?? 'stable';

mkdirSync(installDir, { recursive: true });

console.log(`[e2e] installing Chrome for Testing (${version}) into ${installDir}`);

const output = execFileSync(
  'npx',
  ['--yes', '@puppeteer/browsers', 'install', `chrome@${version}`, '--path', installDir],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
);

const installedLine = output
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .reverse()
  .find((line) => line.startsWith('chrome@'));

if (!installedLine) {
  throw new Error(`Could not read the installed Chrome for Testing path from:\n${output}`);
}

const executablePath = installedLine.replace(/^chrome@\S+\s+/, '');
const markerPath = path.join(installDir, 'default-browser-path');

writeFileSync(markerPath, `${executablePath}\n`, 'utf8');

console.log(`[e2e] Chrome for Testing ready: ${executablePath}`);
console.log(`[e2e] recorded in ${markerPath} — "pnpm cy:run" will use it automatically`);
