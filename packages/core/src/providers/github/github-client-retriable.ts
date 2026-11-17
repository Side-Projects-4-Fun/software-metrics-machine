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

  private isRateLimitError(error: unknown): error is AxiosError<unknown> {
    return (
      axios.isAxiosError(error) &&
      (error.response?.status === 429 || error.response?.status === 403)
    );
  }

  private isRetryableNetworkError(error: unknown): error is AxiosError<unknown> {
    if (!axios.isAxiosError(error)) {
      return false;
    }

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

      if (error.message && /socket hang up|network error/i.test(error.message)) {
        return true;
      }
    }

    if (error.response && (error.response.status === 502 || error.response.status === 503)) {
      return true;
    }

    return false;
  }

  private async waitForRetry(retryCount: number): Promise<void> {
    const maxWaitSeconds = 600;
    const baseSeconds = 5;
    const waitSeconds = Math.min(maxWaitSeconds, Math.pow(2, retryCount) * baseSeconds);

    this.logger.warn(
      `Transient network error, retrying in ${waitSeconds}s (attempt ${retryCount + 1})...`
    );
    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
  }
}
