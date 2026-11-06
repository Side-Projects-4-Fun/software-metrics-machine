import { vi, describe, it, expect, beforeEach, afterEach, type MockInstance } from 'vitest';
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { GitHubIssuesClient } from '../github-issues-client';
import { GitHubRateLimitManager } from '../github-rate-limit-manager';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';
import type { GitHubIssueJsonResponse } from '../github-response-types';

function createGitHubIssue(
  overrides: Partial<GitHubIssueJsonResponse> = {}
): GitHubIssueJsonResponse {
  return {
    id: 1,
    number: 10,
    title: 'Fix the bug',
    body: 'Body',
    state: 'open',
    html_url: 'https://github.com/owner/repo/issues/10',
    url: 'https://api.github.com/repos/owner/repo/issues/10',
    comments: 0,
    created_at: '2026-05-01T10:00:00.000Z',
    updated_at: '2026-05-02T10:00:00.000Z',
    closed_at: null,
    assignee: { login: 'alice' },
    labels: [{ name: 'bug' }, 'backend'],
    ...overrides,
  };
}

function createIssueBatch(count: number, offset = 0): GitHubIssueJsonResponse[] {
  return Array.from({ length: count }, (_, index) =>
    createGitHubIssue({
      id: offset + index + 1,
      number: offset + index + 1,
      created_at: `2026-05-01T10:${String(index % 60).padStart(2, '0')}:00.000Z`,
    })
  );
}

describe('GitHubIssuesClient', () => {
  let client: GitHubIssuesClient;
  let getMock: MockInstance;
  const logger = new MockLoggerBuilder().build();

  beforeEach(() => {
    getMock = vi.fn();
    vi.spyOn(axios, 'create').mockReturnValue({ get: getMock } as unknown as AxiosInstance);
    client = new GitHubIssuesClient(
      'token',
      'owner',
      'repo',
      new GitHubRateLimitManager(logger),
      logger
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchIssues', () => {
    it('maps GitHub issues to the domain shape', async () => {
      getMock.mockResolvedValueOnce({ data: [createGitHubIssue()] });

      const issues = await client.fetchIssues();

      expect(issues).toEqual([
        {
          id: '1',
          key: '10',
          title: 'Fix the bug',
          description: 'Body',
          status: 'open',
          assignee: 'alice',
          createdAt: '2026-05-01T10:00:00.000Z',
          labels: ['bug', 'backend'],
          provider: 'github',
          url: 'https://github.com/owner/repo/issues/10',
          updatedAt: '2026-05-02T10:00:00.000Z',
          closedAt: undefined,
        },
      ]);
    });

    it('filters out pull requests returned by the issues endpoint', async () => {
      getMock.mockResolvedValueOnce({
        data: [createGitHubIssue(), createGitHubIssue({ id: 2, number: 11, pull_request: {} })],
      });

      const issues = await client.fetchIssues();

      expect(issues).toHaveLength(1);
      expect(issues[0].key).toBe('10');
    });

    it('passes state, label, since and pagination parameters', async () => {
      getMock.mockResolvedValueOnce({ data: [] });

      await client.fetchIssues({
        status: 'closed',
        labels: ['bug', 'backend'],
        startDate: '2026-05-01T00:00:00.000Z',
      });

      expect(getMock).toHaveBeenCalledWith(
        '/repos/owner/repo/issues',
        expect.objectContaining({
          params: expect.objectContaining({
            state: 'closed',
            labels: 'bug,backend',
            since: '2026-05-01T00:00:00.000Z',
            per_page: 100,
            page: 1,
          }),
        })
      );
    });

    it('paginates until a short page is returned', async () => {
      getMock
        .mockResolvedValueOnce({ data: createIssueBatch(100) })
        .mockResolvedValueOnce({ data: createIssueBatch(1, 100) });

      const issues = await client.fetchIssues();

      expect(getMock).toHaveBeenCalledTimes(2);
      expect(issues).toHaveLength(101);
    });

    it('applies the exact creation window client-side', async () => {
      getMock.mockResolvedValueOnce({
        data: [
          createGitHubIssue({ id: 1, created_at: '2026-04-01T00:00:00.000Z' }),
          createGitHubIssue({ id: 2, created_at: '2026-05-10T00:00:00.000Z' }),
          createGitHubIssue({ id: 3, created_at: '2026-06-01T00:00:00.000Z' }),
        ],
      });

      const issues = await client.fetchIssues({
        startDate: '2026-05-01T00:00:00.000Z',
        endDate: '2026-05-31T23:59:59.999Z',
      });

      expect(issues.map((issue) => issue.id)).toEqual(['2']);
    });

    it('maps 401 responses to an authentication error', async () => {
      const axiosError = Object.assign(new Error('Unauthorized'), {
        isAxiosError: true,
        response: { status: 401 },
      });
      getMock.mockRejectedValueOnce(axiosError);
      vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

      await expect(client.fetchIssues()).rejects.toThrow(
        'GitHub authentication failed - invalid token'
      );
    });
  });

  describe('fetchComments', () => {
    it('fetches and maps comments for a single issue', async () => {
      getMock.mockResolvedValueOnce({
        data: [
          {
            id: 42,
            body: 'LGTM',
            html_url: 'https://github.com/owner/repo/issues/10#issuecomment-42',
            issue_url: 'https://api.github.com/repos/owner/repo/issues/10',
            created_at: '2026-05-03T10:00:00.000Z',
            updated_at: '2026-05-03T11:00:00.000Z',
            user: { login: 'alice' },
          },
        ],
      });

      const comments = await client.fetchComments({ issueKey: '#10' });

      expect(getMock).toHaveBeenCalledWith(
        '/repos/owner/repo/issues/10/comments',
        expect.objectContaining({ params: { per_page: 100, page: 1 } })
      );
      expect(comments).toEqual([
        {
          id: '42',
          issueKey: '10',
          author: 'alice',
          body: 'LGTM',
          createdAt: '2026-05-03T10:00:00.000Z',
          updatedAt: '2026-05-03T11:00:00.000Z',
          url: 'https://github.com/owner/repo/issues/10#issuecomment-42',
          provider: 'github',
        },
      ]);
    });

    it('fetches repository-wide comments, excludes PR conversation comments and applies the window', async () => {
      getMock.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            body: 'issue comment',
            html_url: 'https://github.com/owner/repo/issues/10#issuecomment-1',
            issue_url: 'https://api.github.com/repos/owner/repo/issues/10',
            created_at: '2026-05-03T10:00:00.000Z',
            updated_at: '2026-05-03T10:00:00.000Z',
          },
          {
            id: 2,
            body: 'pr comment',
            html_url: 'https://github.com/owner/repo/pull/11#issuecomment-2',
            issue_url: 'https://api.github.com/repos/owner/repo/issues/11',
            created_at: '2026-05-03T10:00:00.000Z',
            updated_at: '2026-05-03T10:00:00.000Z',
          },
          {
            id: 3,
            body: 'outside window',
            html_url: 'https://github.com/owner/repo/issues/12#issuecomment-3',
            issue_url: 'https://api.github.com/repos/owner/repo/issues/12',
            created_at: '2026-04-01T10:00:00.000Z',
            updated_at: '2026-05-03T10:00:00.000Z',
          },
        ],
      });

      const comments = await client.fetchComments({
        startDate: '2026-05-01T00:00:00.000Z',
        endDate: '2026-05-31T23:59:59.999Z',
      });

      expect(getMock).toHaveBeenCalledWith(
        '/repos/owner/repo/issues/comments',
        expect.objectContaining({
          params: expect.objectContaining({
            since: '2026-05-01T00:00:00.000Z',
            per_page: 100,
          }),
        })
      );
      expect(comments.map((comment) => comment.id)).toEqual(['1']);
      expect(comments[0].issueKey).toBe('10');
    });
  });
});
