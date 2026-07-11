import { describe, expect, it, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { GithubWorkflowJobClient } from '../github-workflow-job-client';
import { GitHubRateLimitManager } from '../github-rate-limit-manager';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';

async function runWithTimers<T>(action: () => Promise<T>): Promise<T> {
  vi.useFakeTimers();

  try {
    const outcomePromise = action().then(
      (value) => ({ status: 'fulfilled' as const, value }),
      (error) => ({ status: 'rejected' as const, error })
    );

    for (let i = 0; i < 20; i++) {
      await vi.advanceTimersByTimeAsync(1000);
    }

    const outcome = await outcomePromise;
    if (outcome.status === 'rejected') {
      throw outcome.error;
    }

    return outcome.value;
  } finally {
    vi.useRealTimers();
  }
}

describe('GithubWorkflowJobClient rate limit integration', () => {
  let mockGet: ReturnType<typeof vi.fn>;
  let rateLimitManager: GitHubRateLimitManager;
  const logger = new MockLoggerBuilder().build();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet = vi.fn();
    vi.spyOn(axios, 'create').mockReturnValue({ get: mockGet } as any);
    rateLimitManager = new GitHubRateLimitManager(logger);
  });

  it('should call waitIfNeeded before fetching jobs page', async () => {
    const waitSpy = vi.spyOn(rateLimitManager, 'waitIfNeeded');
    mockGet.mockResolvedValue({
      data: { jobs: [] },
      headers: {},
    });

    const client = new GithubWorkflowJobClient('token', 'owner', 'repo', rateLimitManager, logger);
    const result = await client.fetchJobsPage('123', 1);

    expect(waitSpy).toHaveBeenCalled();
    expect(result.jobs).toEqual([]);
    expect(result.hasNext).toBe(false);
  });

  it('should call updateFromHeaders after a successful jobs fetch', async () => {
    const headersSpy = vi.spyOn(rateLimitManager, 'updateFromHeaders');
    const headers = { 'x-ratelimit-remaining': '4999', 'x-ratelimit-limit': '5000' };
    mockGet.mockResolvedValue({
      data: { jobs: [] },
      headers,
    });

    const client = new GithubWorkflowJobClient('token', 'owner', 'repo', rateLimitManager, logger);
    await client.fetchJobsPage('123', 1);

    expect(headersSpy).toHaveBeenCalledWith(headers);
  });

  it('should retry on 429 and succeed on retry', async () => {
    const waitForResetSpy = vi.spyOn(rateLimitManager, 'waitForReset');

    mockGet
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 429, headers: {} } })
      .mockResolvedValueOnce({
        data: { jobs: [] },
        headers: {},
      });

    const client = new GithubWorkflowJobClient('token', 'owner', 'repo', rateLimitManager, logger);
    const result = await runWithTimers(() => client.fetchJobsPage('123', 1));

    expect(waitForResetSpy).toHaveBeenCalled();
    expect(result.jobs).toEqual([]);
  });

  it('should retry on 403 and succeed on retry', async () => {
    const waitForResetSpy = vi.spyOn(rateLimitManager, 'waitForReset');

    mockGet
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 403, headers: {} } })
      .mockResolvedValueOnce({
        data: { jobs: [] },
        headers: {},
      });

    const client = new GithubWorkflowJobClient('token', 'owner', 'repo', rateLimitManager, logger);
    const result = await runWithTimers(() => client.fetchJobsPage('123', 1));

    expect(waitForResetSpy).toHaveBeenCalled();
    expect(result.jobs).toEqual([]);
  });

  it('should throw after 3 consecutive 429 errors', async () => {
    const waitForResetSpy = vi.spyOn(rateLimitManager, 'waitForReset');
    const error = { isAxiosError: true, response: { status: 429, headers: {} } };

    mockGet.mockRejectedValue(error);

    const client = new GithubWorkflowJobClient('token', 'owner', 'repo', rateLimitManager, logger);
    await expect(runWithTimers(() => client.fetchJobsPage('123', 1))).rejects.toThrow();

    // Called 2 times (attempt 0, 1) — on attempt 2 it throws without waiting
    expect(waitForResetSpy).toHaveBeenCalledTimes(2);
  });

  it('should NOT retry on 401 — pass through', async () => {
    const waitForResetSpy = vi.spyOn(rateLimitManager, 'waitForReset');
    const error = {
      isAxiosError: true,
      response: { status: 401, statusText: 'Unauthorized' },
      message: 'Unauthorized',
    };

    mockGet.mockRejectedValue(error);

    const client = new GithubWorkflowJobClient('token', 'owner', 'repo', rateLimitManager, logger);
    await expect(client.fetchJobsPage('123', 1)).rejects.toThrow();

    expect(waitForResetSpy).not.toHaveBeenCalled();
  });

  it('should NOT retry on 500 — pass through', async () => {
    const waitForResetSpy = vi.spyOn(rateLimitManager, 'waitForReset');
    const error = { isAxiosError: true, response: { status: 500 }, message: 'Server Error' };

    mockGet.mockRejectedValue(error);

    const client = new GithubWorkflowJobClient('token', 'owner', 'repo', rateLimitManager, logger);
    await expect(client.fetchJobsPage('123', 1)).rejects.toThrow();

    expect(waitForResetSpy).not.toHaveBeenCalled();
  });
});
