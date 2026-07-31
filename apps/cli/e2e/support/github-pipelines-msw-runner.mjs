#!/usr/bin/env node
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const importResolved = async (specifier) => import(pathToFileURL(require.resolve(specifier)).href);
const { http, HttpResponse } = await importResolved('msw');
const { setupServer } = await importResolved('msw/node');

const [, , ...cliArgs] = process.argv;

if (cliArgs.length === 0) {
  console.error('Usage: github-pipelines-msw-runner.mjs <cli-args...>');
  process.exit(1);
}

const workflowRuns = [
  {
    id: 2001,
    name: 'Deploy',
    path: '.github/workflows/deploy.yml',
    run_number: 41,
    event: 'push',
    status: 'completed',
    conclusion: 'success',
    head_branch: 'main',
    created_at: '2026-02-03T10:00:00Z',
    updated_at: '2026-02-03T10:10:00Z',
    run_started_at: '2026-02-03T10:00:00Z',
    run_attempt: 1,
    html_url: 'https://github.com/acme/widgets/actions/runs/2001',
  },
  {
    id: 2002,
    name: 'Deploy',
    path: '.github/workflows/deploy.yml',
    run_number: 42,
    event: 'push',
    status: 'completed',
    conclusion: 'failure',
    head_branch: 'main',
    created_at: '2026-02-04T11:00:00Z',
    updated_at: '2026-02-04T11:20:00Z',
    run_started_at: '2026-02-04T11:00:00Z',
    run_attempt: 2,
    html_url: 'https://github.com/acme/widgets/actions/runs/2002',
  },
];

const workflowJobs = {
  '2001': [
    {
      id: 5001,
      run_id: 2001,
      name: 'build',
      status: 'completed',
      conclusion: 'success',
      started_at: '2026-02-03T10:00:00Z',
      completed_at: '2026-02-03T10:05:00Z',
      steps: [
        { name: 'Checkout', number: 1, status: 'completed', conclusion: 'success', started_at: '2026-02-03T10:00:00Z', completed_at: '2026-02-03T10:02:00Z' },
        { name: 'Test', number: 2, status: 'completed', conclusion: 'success', started_at: '2026-02-03T10:02:00Z', completed_at: '2026-02-03T10:05:00Z' },
      ],
    },
    {
      id: 5002,
      run_id: 2001,
      name: 'deploy',
      status: 'completed',
      conclusion: 'success',
      started_at: '2026-02-03T10:05:00Z',
      completed_at: '2026-02-03T10:10:00Z',
      steps: [
        { name: 'Release', number: 1, status: 'completed', conclusion: 'success', started_at: '2026-02-03T10:05:00Z', completed_at: '2026-02-03T10:10:00Z' },
      ],
    },
  ],
  '2002': [
    {
      id: 5003,
      run_id: 2002,
      name: 'build',
      status: 'completed',
      conclusion: 'failure',
      started_at: '2026-02-04T11:00:00Z',
      completed_at: '2026-02-04T11:20:00Z',
      steps: [
        { name: 'Checkout', number: 1, status: 'completed', conclusion: 'success', started_at: '2026-02-04T11:00:00Z', completed_at: '2026-02-04T11:05:00Z' },
        { name: 'Test', number: 2, status: 'completed', conclusion: 'failure', started_at: '2026-02-04T11:05:00Z', completed_at: '2026-02-04T11:20:00Z' },
      ],
    },
  ],
};

const server = setupServer(
  http.get('https://api.github.com/repos/acme/widgets/actions/runs', ({ request }) => {
    const url = new URL(request.url);

    if (process.env.DEBUG) {
      console.log(`GET ${url.pathname}${url.search}`);
    }

    return HttpResponse.json({
      total_count: 2,
      workflow_runs: url.searchParams.get('page') === '1' ? workflowRuns : [],
    });
  }),
  http.get('https://api.github.com/repos/acme/widgets/actions/runs/:runId/jobs', ({ request, params }) => {
    const url = new URL(request.url);
    const { runId } = params;

    if (process.env.DEBUG) {
      console.log(`GET ${url.pathname}${url.search}`);
    }

    const jobs = workflowJobs[runId] || [];
    return HttpResponse.json({
      total_count: jobs.length,
      jobs: url.searchParams.get('page') === '1' ? jobs : [],
    });
  })
);

server.listen({ onUnhandledRequest: 'error' });

try {
  const cliBin = process.env.SMM_CLI_BIN;

  if (!cliBin) {
    throw new Error('SMM_CLI_BIN is required');
  }

  process.argv = ['node', cliBin, ...cliArgs];
  const cli = await import(pathToFileURL(cliBin).href);
  await cli.main();
} finally {
  server.close();
}
