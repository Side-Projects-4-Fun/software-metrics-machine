import type { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import axios from 'axios';
import type { Logger } from '@smmachine/utils';
import type { GitHubRateLimitManager } from './github-rate-limit-manager';

export class GithubClientRetriable {
  logger: Logger;

  constructor(
    private readonly axiosInstance: AxiosInstance,
    private rateLimitManager: GitHubRateLimitManager,
    logger: Logger
  ) {
    this.logger = logger;
  }

  /**
   * Wrapper around axios.get that respects GitHub rate limits and retries
   * transient network errors.
   * - Proactively pauses before request if remaining is low
   * - Updates rate limit state from response headers
   * - Retries on 429/403 with rate-limit-aware backoff (max 3 attempts)
   * - Retries on transient network errors (socket hang up, timeout, etc.)
   *   with exponential backoff (max 3 attempts)
   */
  async rateLimitedGet<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (this.rateLimitManager) {
        await this.rateLimitManager.waitIfNeeded();
      }

      try {
        const response = await this.axiosInstance.get<T>(url, config);

        if (this.rateLimitManager && response.headers) {
          this.rateLimitManager.updateFromHeaders(
            response.headers as Record<string, string | string[] | undefined>
          );
        }

        return response;
      } catch (error) {
        if (this.isRateLimitError(error)) {
          if (attempt < maxRetries - 1 && this.rateLimitManager) {
            await this.rateLimitManager.waitForReset(attempt);
            continue;
          }

          this.logger.error(
            `Rate limit error after ${maxRetries} retries: ${error.response?.status}`
          );
          throw error;
        }

        if (this.isRetryableNetworkError(error)) {
          if (attempt < maxRetries - 1) {
            await this.waitForRetry(attempt);
            continue;
          }

          this.logger.error(`Network error after ${maxRetries} retries: ${error.message}`);
          throw error;
        }

        throw error;
      }
    }

    throw new Error('rateLimitedGet: unexpected exit from retry loop');
  }

  /**
   * Check if the error is a retryable rate limit error (429 or 403).
   * Acts as a type guard so callers can access `AxiosError` properties
   * without casting.
   */
  private isRateLimitError(error: unknown): error is AxiosError<unknown> {
    return (
      axios.isAxiosError(error) &&
      (error.response?.status === 429 || error.response?.status === 403)
    );
  }

  /**
   * Check if the error is a transient network error that can be retried.
   *
   * Retries the following:
   * - Network-level errors with no HTTP response (socket hang up / ECONNRESET,
   *   connection timeout / ETIMEDOUT, connection refused / ECONNREFUSED,
   *   DNS failure / ENOTFOUND)
   * - Generic network errors (ERR_NETWORK)
   * - Server-side errors (502 Bad Gateway, 503 Service Unavailable) which
   *   GitHub may return during transient outages
   *
   * Acts as a type guard so callers can access `AxiosError` properties
   * without casting.
   */
  private isRetryableNetworkError(error: unknown): error is AxiosError<unknown> {
    if (!axios.isAxiosError(error)) {
      return false;
    }

    // Network errors without a response (connection-level issues)
    if (!error.response) {
      const retryableCodes = [
        'ECONNRESET',
        'ECONNABORTED',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'ENOTFOUND',
        'ERR_NETWORK',
      ];
      if (error.code && retryableCodes.includes(error.code)) {
        return true;
      }
      // Also catch generic socket/network error messages
      if (error.message && /socket hang up|network error/i.test(error.message)) {
        return true;
      }
    }

    // Server errors that may be transient
    if (error.response && (error.response.status === 502 || error.response.status === 503)) {
      return true;
    }

    return false;
  }

  /**
   * Wait with exponential backoff before retrying a network error.
   * Backoff sequence: 5s, 10s, 20s, ... capped at 600s.
   */
  private async waitForRetry(retryCount: number): Promise<void> {
    const maxWaitSeconds = 600; // 10 minutes
    const baseSeconds = 5;
    const waitSeconds = Math.min(maxWaitSeconds, Math.pow(2, retryCount) * baseSeconds);

    this.logger.warn(
      `Transient network error, retrying in ${waitSeconds}s (attempt ${retryCount + 1})...`
    );
    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
  }
}
