#!/usr/bin/env node
/**
 * GitLab REST API mock for e2e testing.
 *
 * Returns canned GitLab API v4 responses for merge requests, notes,
 * pipelines, pipeline details, and jobs. Supports pagination via the
 * `page` query parameter and `--hostname` for self-hosted instances.
 *
 * The script is invoked as a `glab` binary replacement so the GitLab
 * provider's `execFile('glab', ['api', ...])` calls resolve to this mock
 * instead of a real `glab` installation.
 *
 * Usage: node mock-gitlab-api.mjs api [--hostname <host>] <endpoint>
 */

import { parseArgs } from 'node:util';

// ---------------------------------------------------------------------------
// Canned GitLab API v4 responses
// ---------------------------------------------------------------------------

const mergeRequestsPage1 = [
  {
    id: 1001,
    iid: 7,
    project_id: 42,
    title: 'Add checkout flow',
    description: 'Implements checkout metrics',
    state: 'merged',
    created_at: '2026-01-05T09:00:00Z',
    updated_at: '2026-01-07T09:00:00Z',
    merged_at: '2026-01-07T09:00:00Z',
    closed_at: null,
    web_url: 'https://gitlab.com/acme/widgets/-/merge_requests/7',
    author: { id: 501, username: 'alice', name: 'Alice' },
    labels: ['feature'],
  },
  {
    id: 1002,
    iid: 8,
    project_id: 42,
    title: 'Refine cart metrics',
    description: 'Cart analytics improvements',
    state: 'opened',
    created_at: '2026-01-12T09:00:00Z',
    updated_at: '2026-01-12T11:00:00Z',
    merged_at: null,
    closed_at: null,
    web_url: 'https://gitlab.com/acme/widgets/-/merge_requests/8',
    author: { id: 502, username: 'bob', name: 'Bob' },
    labels: ['analytics'],
  },
];

const mergeRequestsPage2 = [];

const notesPage1 = [
  {
    id: 9001,
    body: 'Please add a regression test for the checkout flow.',
    created_at: '2026-01-05T13:00:00Z',
    updated_at: '2026-01-05T13:05:00Z',
    web_url:
      'https://gitlab.com/acme/widgets/-/merge_requests/7#note_9001',
    author: { id: 601, username: 'reviewer', name: 'Reviewer' },
  },
];

const notesPage2 = [];

const notesForMr8 = [
  {
    id: 9002,
    body: 'Looks good to me.',
    created_at: '2026-01-12T14:00:00Z',
    updated_at: '2026-01-12T14:05:00Z',
    web_url:
      'https://gitlab.com/acme/widgets/-/merge_requests/8#note_9002',
    author: { id: 602, username: 'maintainer', name: 'Maintainer' },
  },
];

const pipelinesPage1 = [
  {
    id: 2001,
    iid: 41,
    ref: 'main',
    sha: 'abc123def456',
    status: 'success',
    source: 'push',
    created_at: '2026-02-03T10:00:00Z',
    updated_at: '2026-02-03T10:10:00Z',
    started_at: '2026-02-03T10:00:00Z',
    finished_at: '2026-02-03T10:10:00Z',
    web_url: 'https://gitlab.com/acme/widgets/-/pipelines/2001',
  },
  {
    id: 2002,
    iid: 42,
    ref: 'main',
    sha: 'def456abc123',
    status: 'failed',
    source: 'push',
    created_at: '2026-02-04T11:00:00Z',
    updated_at: '2026-02-04T11:20:00Z',
    started_at: '2026-02-04T11:00:00Z',
    finished_at: '2026-02-04T11:20:00Z',
    web_url: 'https://gitlab.com/acme/widgets/-/pipelines/2002',
  },
];

const pipelinesPage2 = [];

const jobsPage1 = [
  {
    id: 5001,
    name: 'build',
    stage: 'build',
    ref: 'main',
    commit: { id: 'abc123def456' },
    status: 'success',
    created_at: '2026-02-03T10:00:00Z',
    started_at: '2026-02-03T10:00:00Z',
    finished_at: '2026-02-03T10:05:00Z',
    web_url: 'https://gitlab.com/acme/widgets/-/jobs/5001',
    pipeline: {
      id: 2001,
      web_url: 'https://gitlab.com/acme/widgets/-/pipelines/2001',
    },
  },
  {
    id: 5002,
    name: 'deploy',
    stage: 'deploy',
    ref: 'main',
    commit: { id: 'abc123def456' },
    status: 'success',
    created_at: '2026-02-03T10:05:00Z',
    started_at: '2026-02-03T10:05:00Z',
    finished_at: '2026-02-03T10:10:00Z',
    web_url: 'https://gitlab.com/acme/widgets/-/jobs/5002',
    pipeline: {
      id: 2001,
      web_url: 'https://gitlab.com/acme/widgets/-/pipelines/2001',
    },
  },
  {
    id: 5003,
    name: 'build',
    stage: 'build',
    ref: 'main',
    commit: { id: 'def456abc123' },
    status: 'failed',
    created_at: '2026-02-04T11:00:00Z',
    started_at: '2026-02-04T11:00:00Z',
    finished_at: '2026-02-04T11:20:00Z',
    web_url: 'https://gitlab.com/acme/widgets/-/jobs/5003',
    pipeline: {
      id: 2002,
      web_url: 'https://gitlab.com/acme/widgets/-/pipelines/2002',
    },
  },
];

const jobsPage2 = [];

// ---------------------------------------------------------------------------
// Response matching by GitLab API endpoint
// ---------------------------------------------------------------------------

function getResponse(endpoint, page) {
  const notesMatchMr7 = /\/merge_requests\/7\/notes/.test(endpoint);
  const notesMatchMr8 = /\/merge_requests\/8\/notes/.test(endpoint);
  const notesMatchAnyMr = /\/merge_requests\/\d+\/notes/.test(endpoint);

  if (notesMatchMr7) {
    return page === '1' ? notesPage1 : [];
  }
  if (notesMatchMr8) {
    return page === '1' ? notesForMr8 : [];
  }
  if (notesMatchAnyMr) {
    return [];
  }

  const detailMatch = endpoint.match(/\/pipelines\/(\d+)$/);
  if (detailMatch) {
    const pipelineId = parseInt(detailMatch[1], 10);
    const pipeline = [pipelinesPage1, pipelinesPage2]
      .flat()
      .find((p) => p.id === pipelineId);
    if (pipeline) {
      return {
        ...pipeline,
        name: 'CI Pipeline',
      };
    }
    return {};
  }

  if (/\/pipelines\/\d+\/jobs/.test(endpoint)) {
    return page === '1' ? jobsPage1 : [];
  }

  if (/\/merge_requests/.test(endpoint)) {
    return page === '1' ? mergeRequestsPage1 : [];
  }

  if (/\/pipelines/.test(endpoint)) {
    return page === '1' ? pipelinesPage1 : [];
  }

  console.error(`[gitlab-api-mock] unmatched endpoint: ${endpoint}`);
  return [];
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

try {
  const { values, positionals } = parseArgs({
    options: {
      hostname: { type: 'string' },
    },
    allowPositionals: true,
  });

  const endpoint = positionals[positionals.length - 1] || '';
  const hostname = values.hostname || 'gitlab.com';

  const url = new URL(`https://${hostname}${endpoint}`);
  const page = url.searchParams.get('page') || '1';

  if (process.env.DEBUG) {
    console.error(
      `[gitlab-api-mock] hostname=${hostname} page=${page} endpoint=${endpoint}`
    );
  }

  const response = getResponse(endpoint, page);
  process.stdout.write(JSON.stringify(response));
} catch (error) {
  console.error('gitlab-api-mock error:', error.message);
  process.exit(1);
}
