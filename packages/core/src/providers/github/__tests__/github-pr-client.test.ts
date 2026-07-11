import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { GithubPrsClient, GitHubPullRequestsFetchRepository, type IGithubPrsClient } from '..';
import { PullRequestJsonResponseBuilder } from '../../../test/github-builders';
import { MockLoggerBuilder } from '../../../test/mock-logger-builder';

const logger = new MockLoggerBuilder().build();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRateLimitManager() {
  return {
    waitIfNeeded: vi.fn().mockResolvedValue(undefined),
    updateFromHeaders: vi.fn(),
    waitForReset: vi.fn().mockResolvedValue(undefined),
  };
}

type MockRateLimitManager = ReturnType<typeof createMockRateLimitManager>;

// ---------------------------------------------------------------------------
// GithubPrsClient basic functionality
// ---------------------------------------------------------------------------
describe('GithubPrsClient basic functionality', () => {
  let client: GithubPrsClient;

  beforeEach(() => {
    vi.spyOn(axios, 'create').mockReturnValue({
      get: vi.fn().mockResolvedValue({ data: [] }),
    } as any);
    client = new GithubPrsClient(
      'fake-token',
      'owner',
      'repo',
      createMockRateLimitManager() as any,
      logger
    );
  });

  it('should fetch PRs', async () => {
    const prs = await client.fetchPRs({
      state: 'closed',
    });

    expect(Array.isArray(prs)).toBe(true);
  });

  it('should fetch PR comments', async () => {
    const comments = await client.fetchPRComments(1);

    expect(Array.isArray(comments)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GithubPrsClient rate limit integration
// ---------------------------------------------------------------------------
describe('GithubPrsClient rate limit integration', () => {
  let mockGet: ReturnType<typeof vi.fn>;
  let rateLimitManager: MockRateLimitManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet = vi.fn();
    vi.spyOn(axios, 'create').mockReturnValue({ get: mockGet } as any);
    rateLimitManager = createMockRateLimitManager();
  });

  describe('fetchPRs', () => {
    it('should call waitIfNeeded before making a request', async () => {
      mockGet.mockResolvedValue({ data: [], headers: {} });

      const client = new GithubPrsClient('token', 'owner', 'repo', rateLimitManager as any, logger);
      await client.fetchPRs();

      expect(rateLimitManager.waitIfNeeded).toHaveBeenCalled();
    });

    it('should call updateFromHeaders after a successful response', async () => {
      const headers = { 'x-ratelimit-remaining': '4999', 'x-ratelimit-limit': '5000' };
      mockGet.mockResolvedValue({ data: [], headers });

      const client = new GithubPrsClient('token', 'owner', 'repo', rateLimitManager as any, logger);
      await client.fetchPRs();

      expect(rateLimitManager.updateFromHeaders).toHaveBeenCalledWith(headers);
    });

    it('should retry on 429 and succeed on retry', async () => {
      const headers = {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 30),
      };

      // First call: 429, second call: success with empty page (no more PRs)
      mockGet
        .mockRejectedValueOnce({ isAxiosError: true, response: { status: 429, headers } })
        .mockResolvedValueOnce({ data: [], headers });

      const client = new GithubPrsClient('token', 'owner', 'repo', rateLimitManager as any, logger);
      await client.fetchPRs();

      expect(rateLimitManager.waitForReset).toHaveBeenCalled();
    });

    it('should retry on 403 and succeed on retry', async () => {
      const headers = {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 30),
      };

      mockGet
        .mockRejectedValueOnce({ isAxiosError: true, response: { status: 403, headers } })
        .mockResolvedValueOnce({ data: [], headers });

      const client = new GithubPrsClient('token', 'owner', 'repo', rateLimitManager as any, logger);
      await client.fetchPRs();

      expect(rateLimitManager.waitForReset).toHaveBeenCalled();
    });

    it('should throw after 3 consecutive 429 errors', async () => {
      const error = { isAxiosError: true, response: { status: 429, headers: {} } };

      mockGet.mockRejectedValue(error);

      const client = new GithubPrsClient('token', 'owner', 'repo', rateLimitManager as any, logger);
      await expect(client.fetchPRs()).rejects.toThrow();

      // Called 2 times (attempt 0, 1) — on attempt 2 it throws without waiting
      expect(rateLimitManager.waitForReset).toHaveBeenCalledTimes(2);
    });

    it('should NOT retry on 401 — pass through immediately', async () => {
      const error = {
        isAxiosError: true,
        response: { status: 401, statusText: 'Unauthorized' },
        message: 'Unauthorized',
      };

      mockGet.mockRejectedValue(error);

      const client = new GithubPrsClient('token', 'owner', 'repo', rateLimitManager as any, logger);
      await expect(client.fetchPRs()).rejects.toThrow();

      expect(rateLimitManager.waitForReset).not.toHaveBeenCalled();
    });

    it('should NOT retry on 500 — pass through immediately', async () => {
      const error = { isAxiosError: true, response: { status: 500 }, message: 'Server Error' };

      mockGet.mockRejectedValue(error);

      const client = new GithubPrsClient('token', 'owner', 'repo', rateLimitManager as any, logger);
      await expect(client.fetchPRs()).rejects.toThrow();

      expect(rateLimitManager.waitForReset).not.toHaveBeenCalled();
    });
  });

  describe('fetchPRs sort order', () => {
    function makePR(id: string, createdAt: string): Record<string, string> {
      return { id, number: id, created_at: createdAt, updated_at: createdAt, state: 'open' };
    }

    it('should sort by created DESC (newest first) by default', async () => {
      mockGet.mockResolvedValue({ data: [], headers: {} });

      const client = new GithubPrsClient('token', 'owner', 'repo', rateLimitManager as any, logger);
      await client.fetchPRs();

      const callParams = mockGet.mock.calls[0][1]?.params;
      expect(callParams.sort).toBe('created');
      expect(callParams.direction).toBe('desc');
    });

    it('should include PRs with created_at >= startDate and stop when older', async () => {
      mockGet
        .mockResolvedValueOnce({
          data: [makePR('4', '2026-06-20T12:00:00Z'), makePR('3', '2026-06-15T12:00:00Z')],
          headers: {},
        })
        .mockResolvedValueOnce({
          data: [makePR('2', '2026-06-10T12:00:00Z'), makePR('1', '2026-06-05T12:00:00Z')],
          headers: {},
        });

      const client = new GithubPrsClient('token', 'owner', 'repo', rateLimitManager as any, logger);
      const prs = await client.fetchPRs({ startDate: '2026-06-12T00:00:00Z' });

      // Only PRs created on or after startDate
      expect(prs).toHaveLength(2);
      expect(prs[0].id).toBe('4');
      expect(prs[1].id).toBe('3');
    });
  });

  describe('fetchPRComments', () => {
    it('should call waitIfNeeded before making a request', async () => {
      mockGet.mockResolvedValue({ data: [], headers: {} });

      const client = new GithubPrsClient('token', 'owner', 'repo', rateLimitManager as any, logger);
      await client.fetchPRComments(1);

      expect(rateLimitManager.waitIfNeeded).toHaveBeenCalled();
    });

    it('should call updateFromHeaders after response', async () => {
      const headers = { 'x-ratelimit-remaining': '4998', 'x-ratelimit-limit': '5000' };
      mockGet.mockResolvedValue({ data: [], headers });

      const client = new GithubPrsClient('token', 'owner', 'repo', rateLimitManager as any, logger);
      await client.fetchPRComments(1);

      expect(rateLimitManager.updateFromHeaders).toHaveBeenCalledWith(headers);
    });

    it('should retry on 429 and succeed', async () => {
      mockGet
        .mockRejectedValueOnce({ isAxiosError: true, response: { status: 429, headers: {} } })
        .mockResolvedValueOnce({ data: [], headers: {} });

      const client = new GithubPrsClient('token', 'owner', 'repo', rateLimitManager as any, logger);
      await client.fetchPRComments(1);

      expect(rateLimitManager.waitForReset).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// GitHubPullRequestsFetchRepository
// ---------------------------------------------------------------------------

describe('GitHubPullRequestsFetchRepository', () => {
  it('creates pull request filter options after fetching pull requests', async () => {
    const providerDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-pr-filters-'));
    const bugLabel = {
      id: '1',
      node_id: '',
      url: '',
      name: 'bug',
      color: '',
      default: false,
      description: '',
    };
    const featureLabel = {
      id: '2',
      node_id: '',
      url: '',
      name: 'feature',
      color: '',
      default: false,
      description: '',
    };

    const githubPrsClient: IGithubPrsClient = {
      fetchPRs: vi
        .fn()
        .mockResolvedValue([
          new PullRequestJsonResponseBuilder()
            .withId('1')
            .withAuthor('alice')
            .withLabels([bugLabel])
            .build(),
          new PullRequestJsonResponseBuilder()
            .withId('2')
            .withAuthor('bob')
            .withLabels([featureLabel])
            .build(),
        ]),
      fetchPRComments: vi.fn(),
    };
    const config = {
      getPathFromGitProvider: () => providerDir,
    };

    const repository = new GitHubPullRequestsFetchRepository(
      githubPrsClient,
      config as never,
      logger
    );

    await repository.fetchPRs({ forceRefresh: true });

    const options = JSON.parse(
      await fs.readFile(path.join(providerDir, 'pull-request-filter-options.json'), 'utf-8')
    );

    expect(options).toEqual({
      authors: ['alice', 'bob'],
      labels: ['bug', 'feature'],
    });
  });
});
