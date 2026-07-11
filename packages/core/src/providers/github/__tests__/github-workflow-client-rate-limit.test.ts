import { describe, expect, it, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { GithubWorkflowClient } from '../../..';
import { GitHubRateLimitManager } from '../../..';
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

describe('GithubWorkflowClient rate limit integration', () => {
  let mockGet: ReturnType<typeof vi.fn>;
  let rateLimitManager: GitHubRateLimitManager;
  const logger = new MockLoggerBuilder().build();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet = vi.fn();
    vi.spyOn(axios, 'create').mockReturnValue({ get: mockGet } as any);
    rateLimitManager = new GitHubRateLimitManager(logger);
  });

  it('should call waitIfNeeded before fetching workflow runs page', async () => {
    const waitSpy = vi.spyOn(rateLimitManager, 'waitIfNeeded');
    mockGet.mockResolvedValue({
      data: { workflow_runs: [] },
      headers: {},
    });

    const client = new GithubWorkflowClient('token', 'owner', 'repo', rateLimitManager, logger);
    await client.fetchWorkflows();

    expect(waitSpy).toHaveBeenCalled();
  });

  it('should call updateFromHeaders after a successful workflow fetch', async () => {
    const headersSpy = vi.spyOn(rateLimitManager, 'updateFromHeaders');
    const headers = { 'x-ratelimit-remaining': '4999', 'x-ratelimit-limit': '5000' };
    mockGet.mockResolvedValue({
      data: { workflow_runs: [] },
      headers,
    });

    const client = new GithubWorkflowClient('token', 'owner', 'repo', rateLimitManager, logger);
    await client.fetchWorkflows();

    expect(headersSpy).toHaveBeenCalledWith(headers);
  });

  it('should retry fetchWorkflowRunsPage on 429 and succeed on retry', async () => {
    const waitForResetSpy = vi.spyOn(rateLimitManager, 'waitForReset');

    mockGet
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 429, headers: {} } })
      .mockResolvedValueOnce({
        data: { workflow_runs: [] },
        headers: {},
      });

    const client = new GithubWorkflowClient('token', 'owner', 'repo', rateLimitManager, logger);
    const result = await runWithTimers(() => client.fetchWorkflows());

    expect(waitForResetSpy).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('should retry on 403 and succeed on retry', async () => {
    const waitForResetSpy = vi.spyOn(rateLimitManager, 'waitForReset');

    mockGet
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 403, headers: {} } })
      .mockResolvedValueOnce({
        data: { workflow_runs: [] },
        headers: {},
      });

    const client = new GithubWorkflowClient('token', 'owner', 'repo', rateLimitManager, logger);
    const result = await runWithTimers(() => client.fetchWorkflows());

    expect(waitForResetSpy).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('should throw after 3 consecutive 429 errors on fetchWorkflowRunsPage', async () => {
    const waitForResetSpy = vi.spyOn(rateLimitManager, 'waitForReset');
    const error = { isAxiosError: true, response: { status: 429, headers: {} } };

    mockGet.mockRejectedValue(error);

    const client = new GithubWorkflowClient('token', 'owner', 'repo', rateLimitManager, logger);
    await expect(runWithTimers(() => client.fetchWorkflows())).rejects.toThrow();

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

    const client = new GithubWorkflowClient('token', 'owner', 'repo', rateLimitManager, logger);
    await expect(client.fetchWorkflows()).rejects.toThrow();

    expect(waitForResetSpy).not.toHaveBeenCalled();
  });

  it('should NOT retry on 500 — pass through', async () => {
    const waitForResetSpy = vi.spyOn(rateLimitManager, 'waitForReset');
    const error = { isAxiosError: true, response: { status: 500 }, message: 'Server Error' };

    mockGet.mockRejectedValue(error);

    const client = new GithubWorkflowClient('token', 'owner', 'repo', rateLimitManager, logger);
    await expect(client.fetchWorkflows()).rejects.toThrow();

    expect(waitForResetSpy).not.toHaveBeenCalled();
  });

  it('should call waitIfNeeded before each page when fetching by day', async () => {
    const waitSpy = vi.spyOn(rateLimitManager, 'waitIfNeeded');
    // Two days, one page each
    mockGet.mockResolvedValue({
      data: { workflow_runs: [] },
      headers: {},
    });

    const client = new GithubWorkflowClient('token', 'owner', 'repo', rateLimitManager, logger);
    await client.fetchWorkflows({
      startDate: '2026-05-10T00:00:00Z',
      endDate: '2026-05-11T23:59:59Z',
      byDay: true,
    });

    // Called once per day
    expect(waitSpy).toHaveBeenCalled();
  });
});
