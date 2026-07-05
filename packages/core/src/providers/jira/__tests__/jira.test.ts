import { vi, describe, it, expect, beforeEach, afterEach, type MockInstance } from 'vitest';
import axios from 'axios';
import { JiraIssuesClient } from '../../..';
import { MockLoggerBuilder } from '../../../test/mock-logger-builder';

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
      const makeIssue = (key: string) => ({
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

  describe('fetchIssueChanges', () => {
    it('should call the issue endpoint with expand=changelog and return histories', async () => {
      const histories = [{ id: '1', items: [] }];
      getMock.mockResolvedValueOnce({ data: { changelog: { histories } } });

      const result = await client.fetchIssueChanges('PROJ-1');

      expect(getMock).toHaveBeenCalledWith(
        '/rest/api/3/issue/PROJ-1',
        expect.objectContaining({ params: { expand: 'changelog' } })
      );
      expect(result).toEqual(histories);
    });
  });

  describe('fetchIssueComments', () => {
    it('should call the comment endpoint and return comments', async () => {
      const comments = [{ id: '42', body: 'LGTM' }];
      getMock.mockResolvedValueOnce({ data: { comments } });

      const result = await client.fetchIssueComments('PROJ-1');

      expect(getMock).toHaveBeenCalledWith('/rest/api/3/issue/PROJ-1/comment');
      expect(result).toEqual(comments);
    });
  });
});
