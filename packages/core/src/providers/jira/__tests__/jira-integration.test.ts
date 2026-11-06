import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { JiraIssuesClient } from '../jira-client';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';

const JIRA_URL = 'https://jira.example.com';
const SEARCH_URL = `${JIRA_URL}/rest/api/3/search/jql`;
const logger = new MockLoggerBuilder().build();

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

function createClient(project = 'PROJ'): JiraIssuesClient {
  return new JiraIssuesClient(JIRA_URL, 'user@example.com', 'api-token', project, logger);
}

function createJiraIssue(key: string): Record<string, unknown> {
  return {
    key,
    fields: {
      summary: `Summary ${key}`,
      status: { name: 'Done' },
      created: '2026-05-01T10:00:00.000Z',
      updated: '2026-05-02T11:00:00.000Z',
      assignee: { displayName: 'Alice' },
      labels: ['backend'],
    },
  };
}

function createJiraIssues(count: number, offset: number): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, index) => createJiraIssue(`PROJ-${offset + index}`));
}

describe('JiraIssuesClient with MSW', () => {
  describe('fetchIssues', () => {
    it('maps a Jira issue response to the domain shape', async () => {
      server.use(
        http.get(SEARCH_URL, () =>
          HttpResponse.json({ issues: [createJiraIssue('PROJ-1')], total: 1 })
        )
      );

      const issues = await createClient().fetchIssues();

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        id: 'PROJ-1',
        key: 'PROJ-1',
        title: 'Summary PROJ-1',
        status: 'Done',
        createdAt: '2026-05-01T10:00:00.000Z',
        updatedAt: '2026-05-02T11:00:00.000Z',
        assignee: 'Alice',
        labels: ['backend'],
        provider: 'jira',
        url: 'https://jira.example.com/browse/PROJ-1',
      });
    });

    it('builds JQL from the configured project and every filter', async () => {
      let receivedJql = '';
      server.use(
        http.get(SEARCH_URL, ({ request }) => {
          receivedJql = new URL(request.url).searchParams.get('jql') ?? '';
          return HttpResponse.json({ issues: [], total: 0 });
        })
      );

      await createClient().fetchIssues({
        startDate: '2024-01-01',
        endDate: '2024-03-31',
        status: 'Done',
        labels: ['backend', 'urgent'],
      });

      expect(receivedJql).toBe(
        'project = "PROJ" AND created >= "2024-01-01" AND created <= "2024-03-31" AND status = "Done" AND labels in ("backend", "urgent")'
      );
    });

    it('formats datetime filters for Jira JQL', async () => {
      let receivedJql = '';
      server.use(
        http.get(SEARCH_URL, ({ request }) => {
          receivedJql = new URL(request.url).searchParams.get('jql') ?? '';
          return HttpResponse.json({ issues: [], total: 0 });
        })
      );

      await createClient().fetchIssues({
        startDate: '2026-01-05T08:30:00+01:00',
        endDate: '2026-01-05T17:45:00+01:00',
      });

      expect(receivedJql).toBe(
        'project = "PROJ" AND created >= "2026-01-05 08:30" AND created <= "2026-01-05 17:45"'
      );
    });

    it('paginates until all issues are fetched', async () => {
      let calls = 0;
      server.use(
        http.get(SEARCH_URL, ({ request }) => {
          calls += 1;
          const startAt = Number(new URL(request.url).searchParams.get('startAt') ?? '0');

          if (startAt === 0) {
            return HttpResponse.json({ issues: createJiraIssues(100, 0), total: 150 });
          }

          return HttpResponse.json({ issues: createJiraIssues(50, 100), total: 150 });
        })
      );

      const issues = await createClient().fetchIssues();

      expect(calls).toBe(2);
      expect(issues).toHaveLength(150);
    });

    it('maps a 401 response to an authentication error', async () => {
      server.use(
        http.get(SEARCH_URL, () =>
          HttpResponse.json({ errorMessages: ['Unauthorized'] }, { status: 401 })
        )
      );

      await expect(createClient().fetchIssues()).rejects.toThrow(
        'Jira authentication failed. Check email and token.'
      );
    });

    it('maps a 404 response to an actionable error', async () => {
      server.use(http.get(SEARCH_URL, () => new HttpResponse(null, { status: 404 })));

      await expect(createClient().fetchIssues()).rejects.toThrow(
        'Jira project or issue not found, or API endpoint not accessible.'
      );
    });
  });

  describe('fetchComments', () => {
    it('fetches and maps comments for a single issue', async () => {
      server.use(
        http.get(`${JIRA_URL}/rest/api/3/issue/PROJ-1/comment`, () =>
          HttpResponse.json({
            comments: [
              {
                id: '42',
                author: { displayName: 'Alice' },
                body: 'LGTM',
                created: '2026-05-01T10:00:00.000Z',
                updated: '2026-05-01T11:00:00.000Z',
                self: 'https://jira.example.com/rest/api/3/issue/PROJ-1/comment/42',
              },
            ],
            total: 1,
          })
        )
      );

      const comments = await createClient().fetchComments({ issueKey: 'PROJ-1' });

      expect(comments).toEqual([
        {
          id: '42',
          issueKey: 'PROJ-1',
          author: 'Alice',
          body: 'LGTM',
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-01T11:00:00.000Z',
          url: 'https://jira.example.com/rest/api/3/issue/PROJ-1/comment/42',
          provider: 'jira',
        },
      ]);
    });

    it('flattens Atlassian Document Format bodies to plain text', async () => {
      server.use(
        http.get(`${JIRA_URL}/rest/api/3/issue/PROJ-1/comment`, () =>
          HttpResponse.json({
            comments: [
              {
                id: '7',
                body: {
                  type: 'doc',
                  content: [
                    { type: 'paragraph', content: [{ type: 'text', text: 'Line one' }] },
                    { type: 'paragraph', content: [{ type: 'text', text: 'Line two' }] },
                  ],
                },
                created: '2026-05-01T10:00:00.000Z',
              },
            ],
            total: 1,
          })
        )
      );

      const comments = await createClient().fetchComments({ issueKey: 'PROJ-1' });

      expect(comments[0].body).toBe('Line one\nLine two');
    });

    it('fetches comments across issues matching the updated window', async () => {
      let receivedJql = '';
      server.use(
        http.get(SEARCH_URL, ({ request }) => {
          receivedJql = new URL(request.url).searchParams.get('jql') ?? '';
          return HttpResponse.json({ issues: [createJiraIssue('PROJ-1')], total: 1 });
        }),
        http.get(`${JIRA_URL}/rest/api/3/issue/PROJ-1/comment`, () =>
          HttpResponse.json({
            comments: [
              { id: '10', body: 'inside', created: '2026-05-03T00:00:00.000Z' },
              { id: '11', body: 'outside', created: '2026-04-01T00:00:00.000Z' },
            ],
            total: 2,
          })
        )
      );

      const comments = await createClient().fetchComments({
        startDate: '2026-05-01',
        endDate: '2026-05-31',
      });

      expect(receivedJql).toBe(
        'project = "PROJ" AND updated >= "2026-05-01" AND updated <= "2026-05-31"'
      );
      expect(comments.map((comment) => comment.id)).toEqual(['10']);
    });
  });
});
