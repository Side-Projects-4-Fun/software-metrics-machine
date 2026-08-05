#!/usr/bin/env node
/**
 * GitLab API mock runner for e2e testing.
 *
 * Creates a temporary `glab` shim on PATH that delegates to the GitLab API
 * mock (`mock-gitlab-api.mjs`), then invokes the SMM CLI so that the GitLab
 * provider fetches from the mocked GitLab API instead of a real instance.
 *
 * Usage: node gitlab-api-runner.mjs <cli-args...>
 */

import { mkdtempSync, chmodSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , ...cliArgs] = process.argv;

if (cliArgs.length === 0) {
  console.error('Usage: gitlab-api-runner.mjs <cli-args...>');
  process.exit(1);
}

const mockDir = mkdtempSync(join(tmpdir(), 'smm-gitlab-api-mock-'));
const mockGlabPath = join(mockDir, 'glab');
const mockScriptPath = resolve(import.meta.dirname, 'mock-gitlab-api.mjs');

writeFileSync(
  mockGlabPath,
  `#!/usr/bin/env bash\nexec node "${mockScriptPath}" "$@"\n`
);
chmodSync(mockGlabPath, 0o755);

process.env.PATH = `${mockDir}:${process.env.PATH}`;

if (process.env.DEBUG) {
  console.error(`[gitlab-api-runner] mock glab shim at ${mockGlabPath}`);
}

try {
  const cliBin = process.env.SMM_CLI_BIN;

  if (!cliBin) {
    throw new Error('SMM_CLI_BIN is required');
  }

  process.argv = ['node', cliBin, ...cliArgs];
  const cli = await import(pathToFileURL(cliBin).href);
  await cli.main();
} finally {
  rmSync(mockDir, { recursive: true, force: true });
}
