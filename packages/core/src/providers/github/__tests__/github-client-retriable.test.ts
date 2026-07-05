import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { GithubClientRetriable } from '../github-client-retriable';
import { GitHubRateLimitManager } from '../github-rate-limit-manager';
import { MockLoggerBuilder } from '../../../test/mock-logger-builder';

/**
 * Helper to run an operation with fake timers so retry backoffs complete
 * in milliseconds instead of waiting for real wall-clock delays.
 */
async function runWithTimers<T>(action: () => Promise<T>): Promise<T> {
  vi.useFakeTimers();

  try {
    const outcomePromise = action().then(
      (value) => ({ status: 'fulfilled' as const, value }),
      (error) => ({ status: 'rejected' as const, error })
    );

    // Step time forward to cover retry backoff windows without real waiting.
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

describe('GithubClientRetriable', () => {
  let mockGet: ReturnType<typeof vi.fn>;
  let rateLimitManager: GitHubRateLimitManager;
  let client: GithubClientRetriable;
  const logger = new MockLoggerBuilder().build();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet = vi.fn();
    vi.spyOn(axios, 'create').mockReturnValue({ get: mockGet } as any);
    rateLimitManager = new GitHubRateLimitManager(logger);
    const instance = axios.create();
    client = new GithubClientRetriable(instance, rateLimitManager, logger);
    (instance as any).get = mockGet;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rate limited errors', () => {
    it('should retry on 429 and succeed on retry', async () => {
      const waitForResetSpy = vi.spyOn(rateLimitManager, 'waitForReset');

      mockGet
        .mockRejectedValueOnce({ isAxiosError: true, response: { status: 429, headers: {} } })
        .mockResolvedValueOnce({
          data: { result: 'success' },
          headers: {},
        });

      const result = await runWithTimers(() => client.rateLimitedGet('/test'));

      expect(waitForResetSpy).toHaveBeenCalled();
      expect(result.data).toEqual({ result: 'success' });
    });

    it('should retry on 403 and succeed on retry', async () => {
      const waitForResetSpy = vi.spyOn(rateLimitManager, 'waitForReset');

      mockGet
        .mockRejectedValueOnce({ isAxiosError: true, response: { status: 403, headers: {} } })
        .mockResolvedValueOnce({
          data: { result: 'success' },
          headers: {},
        });

      const result = await runWithTimers(() => client.rateLimitedGet('/test'));

      expect(waitForResetSpy).toHaveBeenCalled();
      expect(result.data).toEqual({ result: 'success' });
    });

    it('should throw after 3 consecutive 429 errors', async () => {
      const waitForResetSpy = vi.spyOn(rateLimitManager, 'waitForReset');
      const error = { isAxiosError: true, response: { status: 429, headers: {} } };

      mockGet.mockRejectedValue(error);

      await expect(runWithTimers(() => client.rateLimitedGet('/test'))).rejects.toThrow();

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

      await expect(client.rateLimitedGet('/test')).rejects.toThrow();

      expect(waitForResetSpy).not.toHaveBeenCalled();
    });
  });

  describe('network errors', () => {
    it('should retry on ECONNRESET (socket hang up) and succeed on retry', async () => {
      const waitForResetSpy = vi.spyOn(rateLimitManager, 'waitForReset');

      mockGet
        .mockRejectedValueOnce({
          isAxiosError: true,
          code: 'ECONNRESET',
          message: 'socket hang up',
          response: undefined,
        })
        .mockResolvedValueOnce({
          data: { result: 'success' },
          headers: {},
        });

      const result = await runWithTimers(() => client.rateLimitedGet('/test'));

      // Should NOT call rate limit waitForReset — network errors use their own backoff
      expect(waitForResetSpy).not.toHaveBeenCalled();
      expect(result.data).toEqual({ result: 'success' });
    });

    it('should retry on ETIMEDOUT and succeed on retry', async () => {
      mockGet
        .mockRejectedValueOnce({
          isAxiosError: true,
          code: 'ETIMEDOUT',
          message: 'timeout of 30000ms exceeded',
          response: undefined,
        })
        .mockResolvedValueOnce({
          data: { result: 'success' },
          headers: {},
        });

      const result = await runWithTimers(() => client.rateLimitedGet('/test'));

      expect(result.data).toEqual({ result: 'success' });
    });

    it('should retry on ECONNREFUSED and succeed on retry', async () => {
      mockGet
        .mockRejectedValueOnce({
          isAxiosError: true,
          code: 'ECONNREFUSED',
          message: 'connect ECONNREFUSED',
          response: undefined,
        })
        .mockResolvedValueOnce({
          data: { result: 'success' },
          headers: {},
        });

      const result = await runWithTimers(() => client.rateLimitedGet('/test'));

      expect(result.data).toEqual({ result: 'success' });
    });

    it('should retry on ENOTFOUND and succeed on retry', async () => {
      mockGet
        .mockRejectedValueOnce({
          isAxiosError: true,
          code: 'ENOTFOUND',
          message: 'getaddrinfo ENOTFOUND api.github.com',
          response: undefined,
        })
        .mockResolvedValueOnce({
          data: { result: 'success' },
          headers: {},
        });

      const result = await runWithTimers(() => client.rateLimitedGet('/test'));

      expect(result.data).toEqual({ result: 'success' });
    });

    it('should retry on generic Network Error message and succeed', async () => {
      mockGet
        .mockRejectedValueOnce({
          isAxiosError: true,
          message: 'Network Error',
          code: 'ERR_NETWORK',
          response: undefined,
        })
        .mockResolvedValueOnce({
          data: { result: 'success' },
          headers: {},
        });

      const result = await runWithTimers(() => client.rateLimitedGet('/test'));

      expect(result.data).toEqual({ result: 'success' });
    });

    it('should retry on 502 Bad Gateway and succeed on retry', async () => {
      mockGet
        .mockRejectedValueOnce({
          isAxiosError: true,
          response: { status: 502, statusText: 'Bad Gateway' },
          message: 'Request failed with status code 502',
        })
        .mockResolvedValueOnce({
          data: { result: 'success' },
          headers: {},
        });

      const result = await runWithTimers(() => client.rateLimitedGet('/test'));

      expect(result.data).toEqual({ result: 'success' });
    });

    it('should retry on 503 Service Unavailable and succeed on retry', async () => {
      mockGet
        .mockRejectedValueOnce({
          isAxiosError: true,
          response: { status: 503, statusText: 'Service Unavailable' },
          message: 'Request failed with status code 503',
        })
        .mockResolvedValueOnce({
          data: { result: 'success' },
          headers: {},
        });

      const result = await runWithTimers(() => client.rateLimitedGet('/test'));

      expect(result.data).toEqual({ result: 'success' });
    });

    it('should throw after 3 consecutive ECONNRESET errors', async () => {
      const error = {
        isAxiosError: true,
        code: 'ECONNRESET',
        message: 'socket hang up',
        response: undefined,
      };

      mockGet.mockRejectedValue(error);

      await expect(runWithTimers(() => client.rateLimitedGet('/test'))).rejects.toThrow();
    });

    it('should throw after 3 consecutive 502 errors', async () => {
      const error = {
        isAxiosError: true,
        response: { status: 502, statusText: 'Bad Gateway' },
        message: 'Request failed with status code 502',
      };

      mockGet.mockRejectedValue(error);

      await expect(runWithTimers(() => client.rateLimitedGet('/test'))).rejects.toThrow();
    });

    it('should NOT retry on 500 — pass through', async () => {
      const error = {
        isAxiosError: true,
        response: { status: 500, statusText: 'Internal Server Error' },
        message: 'Request failed with status code 500',
      };

      mockGet.mockRejectedValue(error);

      await expect(client.rateLimitedGet('/test')).rejects.toThrow();
    });

    it('should NOT retry on non-Axios errors — pass through', async () => {
      const error = new Error('Something completely unexpected');

      mockGet.mockRejectedValue(error);

      await expect(client.rateLimitedGet('/test')).rejects.toThrow();
    });

    it('should call waitIfNeeded before each network error retry attempt', async () => {
      const waitSpy = vi.spyOn(rateLimitManager, 'waitIfNeeded');

      mockGet
        .mockRejectedValueOnce({
          isAxiosError: true,
          code: 'ECONNRESET',
          message: 'socket hang up',
          response: undefined,
        })
        .mockRejectedValueOnce({
          isAxiosError: true,
          code: 'ECONNRESET',
          message: 'socket hang up',
          response: undefined,
        })
        .mockResolvedValueOnce({
          data: { result: 'success' },
          headers: {},
        });

      await runWithTimers(() => client.rateLimitedGet('/test'));

      // Called before each attempt (3 total: 2 failed + 1 success)
      expect(waitSpy).toHaveBeenCalledTimes(3);
    });

    it('should update headers from rate limit manager on successful retry', async () => {
      const headersSpy = vi.spyOn(rateLimitManager, 'updateFromHeaders');
      const headers = { 'x-ratelimit-remaining': '4999', 'x-ratelimit-limit': '5000' };

      mockGet
        .mockRejectedValueOnce({
          isAxiosError: true,
          code: 'ECONNRESET',
          message: 'socket hang up',
          response: undefined,
        })
        .mockResolvedValueOnce({
          data: { result: 'success' },
          headers,
        });

      await runWithTimers(() => client.rateLimitedGet('/test'));

      expect(headersSpy).toHaveBeenCalledWith(headers);
    });
  });
});
