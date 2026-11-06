import { vi, describe, it, expect, beforeEach, afterEach, type MockInstance } from 'vitest';
import axios from 'axios';
import { JiraIssuesClient } from '../../..';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';

describe('JiraIssuesClient', () => {
  let client: JiraIssuesClient;
  let getMock: MockInstance;
  const logger = new MockLoggerBuilder().build();

  beforeEach(() => {
    getMock = vi.fn();
    vi.spyOn(axios, 'create').mockReturnValue({ get: getMock } as any);
    client = new JiraIssuesClient(
      'https://jira.example.com',
      'user@example.com',
      'api-token',
      'PROJECT',
      logger
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchIssues', () => {
    it('should build JQL from options and call the search endpoint', async () => {
      getMock.mockResolvedValueOnce({ data: { issues: [], total: 0 } });

      await client.fetchIssues({ status: 'Done', startDate: '2024-01-01', endDate: '2024-03-31' });

      expect(getMock).toHaveBeenCalledWith(
        '/rest/api/3/search/jql',
        expect.objectContaining({
          params: expect.objectContaining({
            jql: 'project = "PROJECT" AND created >= "2024-01-01" AND created <= "2024-03-31" AND status = "Done"',
          }),
        })
      );
    });

    it('should format datetime filters for Jira JQL', async () => {
      getMock.mockResolvedValueOnce({ data: { issues: [], total: 0 } });

      await client.fetchIssues({
        startDate: '2026-01-05T08:30:00+01:00',
        endDate: '2026-01-05T17:45:00+01:00',
      });

      expect(getMock).toHaveBeenCalledWith(
        '/rest/api/3/search/jql',
        expect.objectContaining({
          params: expect.objectContaining({
            jql: 'project = "PROJECT" AND created >= "2026-01-05 08:30" AND created <= "2026-01-05 17:45"',
          }),
        })
      );
    });

    it('should map Jira response to domain Issue shape', async () => {
      getMock.mockResolvedValueOnce({
        data: {
          issues: [
            {
              key: 'PROJ-1',
              fields: {
                summary: 'Fix the bug',
                status: { name: 'Done' },
                created: '2024-01-15T10:00:00.000Z',
                assignee: { displayName: 'Alice' },
                labels: ['backend'],
              },
            },
          ],
          total: 1,
        },
      });

      const issues = await client.fetchIssues();

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        id: 'PROJ-1',
        key: 'PROJ-1',
        title: 'Fix the bug',
        status: 'Done',
        createdAt: '2024-01-15T10:00:00.000Z',
        assignee: 'Alice',
        labels: ['backend'],
      });
    });

    it('should paginate until all issues are fetched', async () => {
      const makeIssue = (
        key: string
      ): {
        key: string;
        fields: {
          summary: string;
          status: { name: string };
          created: string;
          assignee: null;
          labels: string[];
        };
      } => ({
        key,
        fields: { summary: key, status: { name: 'Open' }, created: '', assignee: null, labels: [] },
      });

      getMock
        .mockResolvedValueOnce({
          data: {
            issues: Array.from({ length: 100 }, (_, i) => makeIssue(`PROJ-${i}`)),
            total: 150,
          },
        })
        .mockResolvedValueOnce({
          data: {
            issues: Array.from({ length: 50 }, (_, i) => makeIssue(`PROJ-${100 + i}`)),
            total: 150,
          },
        });

      const issues = await client.fetchIssues();

      expect(getMock).toHaveBeenCalledTimes(2);
      expect(issues).toHaveLength(150);
    });

    it('should throw an auth error on 401', async () => {
      const axiosError = Object.assign(new Error('Unauthorized'), {
        isAxiosError: true,
        response: { status: 401 },
      });
      getMock.mockRejectedValueOnce(axiosError);
      vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

      await expect(client.fetchIssues()).rejects.toThrow(
        'Jira authentication failed. Check email and token.'
      );
    });
  });

  describe('fetchComments', () => {
    it('should fetch and map comments for a single issue', async () => {
      getMock.mockResolvedValueOnce({
        data: {
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
        },
      });

      const result = await client.fetchComments({ issueKey: 'PROJ-1' });

      expect(getMock).toHaveBeenCalledWith(
        '/rest/api/3/issue/PROJ-1/comment',
        expect.objectContaining({ params: { startAt: 0, maxResults: 100 } })
      );
      expect(result).toEqual([
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
      getMock.mockResolvedValueOnce({
        data: {
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
        },
      });

      const result = await client.fetchComments({ issueKey: 'PROJ-1' });

      expect(result[0].body).toBe('Line one\nLine two');
    });

    it('fetches comments across issues matching the updated window', async () => {
      getMock
        .mockResolvedValueOnce({
          data: {
            issues: [
              {
                key: 'PROJ-1',
                fields: {
                  summary: 'Issue',
                  status: { name: 'Open' },
                  created: '2026-01-01T00:00:00.000Z',
                  updated: '2026-05-02T00:00:00.000Z',
                },
              },
            ],
            total: 1,
          },
        })
        .mockResolvedValueOnce({
          data: {
            comments: [
              { id: '10', body: 'inside', created: '2026-05-03T00:00:00.000Z' },
              { id: '11', body: 'outside', created: '2026-04-01T00:00:00.000Z' },
            ],
            total: 2,
          },
        });

      const result = await client.fetchComments({
        startDate: '2026-05-01',
        endDate: '2026-05-31',
      });

      expect(getMock).toHaveBeenNthCalledWith(
        1,
        '/rest/api/3/search/jql',
        expect.objectContaining({
          params: expect.objectContaining({
            jql: 'project = "PROJECT" AND updated >= "2026-05-01" AND updated <= "2026-05-31"',
          }),
        })
      );
      expect(result.map((comment) => comment.id)).toEqual(['10']);
    });
  });
});
