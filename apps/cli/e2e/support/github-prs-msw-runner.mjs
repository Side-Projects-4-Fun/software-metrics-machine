#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const [, , ...cliArgs] = process.argv;

if (cliArgs.length === 0) {
  console.error('Usage: github-prs-msw-runner.mjs <cli-args...>');
  process.exit(1);
}

const pullRequests = [
  {
    url: 'https://api.github.com/repos/acme/widgets/pulls/42',
    id: '42',
    node_id: 'PR_kwDO42',
    html_url: 'https://github.example/acme/widgets/pull/42',
    diff_url: 'https://github.example/acme/widgets/pull/42.diff',
    patch_url: 'https://github.example/acme/widgets/pull/42.patch',
    issue_url: 'https://api.github.com/repos/acme/widgets/issues/42',
    number: '42',
    state: 'closed',
    locked: false,
    title: 'Add checkout metrics',
    body: 'Fetch command fixture',
    created_at: '2026-01-02T03:04:05Z',
    updated_at: '2026-01-03T03:04:05Z',
    closed_at: '2026-01-04T03:04:05Z',
    merged_at: '2026-01-04T03:04:05Z',
    labels: [
      {
        id: '7',
        node_id: 'LA_kwDO7',
        url: 'https://api.github.com/repos/acme/widgets/labels/feature',
        name: 'feature',
        color: '0e8a16',
        default: false,
        description: 'Feature work',
      },
    ],
    user: {
      login: 'octocat',
      id: 1,
      node_id: 'MDQ6VXNlcjE=',
      avatar_url: 'https://github.example/images/octocat.png',
      gravatar_id: '',
      url: 'https://github.example/users/octocat',
      html_url: 'https://github.example/octocat',
      followers_url: 'https://github.example/octocat/followers',
      following_url: 'https://github.example/octocat/following{/other_user}',
      gists_url: 'https://github.example/octocat/gists{/gist_id}',
      starred_url: 'https://github.example/octocat/starred{/owner}{/repo}',
      subscriptions_url: 'https://github.example/octocat/subscriptions',
      organizations_url: 'https://github.example/octocat/orgs',
      repos_url: 'https://github.example/octocat/repos',
      events_url: 'https://github.example/octocat/events{/privacy}',
      received_events_url: 'https://github.example/octocat/received_events',
      type: 'User',
      user_view_type: 'public',
      site_admin: false,
    },
  },
];

const server = setupServer(
  http.get('https://api.github.com/repos/acme/widgets/pulls', ({ request }) => {
    const url = new URL(request.url);

    if (process.env.DEBUG) {
      console.log(`GET ${url.pathname}${url.search}`);
    }

    return HttpResponse.json(url.searchParams.get('page') === '1' ? pullRequests : []);
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
