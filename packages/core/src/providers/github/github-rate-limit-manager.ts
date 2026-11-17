import type { Logger } from '@smmachine/utils';

export class GitHubRateLimitManager {
  private remaining = Infinity;
  private reset = 0;
  private limit = 0;
  private used = 0;
  private resource = '';
  private logger: Logger;

  private static readonly MAX_WAIT_SECONDS = 600;

  private static readonly BACKOFF_BASE_SECONDS = 5;

  private static readonly BACKOFF_MAX_SECONDS = 60;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  updateFromHeaders(headers: Record<string, string | string[] | undefined>): void {
    const getHeader = (name: string): string | undefined => {
      const val = headers[name] || headers[name.toLowerCase()];
      if (Array.isArray(val)) return val[0];
      return val;
    };

    const remaining = getHeader('x-ratelimit-remaining');
    const reset = getHeader('x-ratelimit-reset');
    const limit = getHeader('x-ratelimit-limit');
    const used = getHeader('x-ratelimit-used');
    const resource = getHeader('x-ratelimit-resource');

    if (remaining !== undefined) this.remaining = parseInt(remaining, 10);
    if (reset !== undefined) this.reset = parseInt(reset, 10);
    if (limit !== undefined) this.limit = parseInt(limit, 10);
    if (used !== undefined) this.used = parseInt(used, 10);
    if (resource !== undefined) this.resource = resource;
  }

  getRemaining(): number {
    return this.remaining;
  }

  getLimit(): number {
    return this.limit;
  }

  getResetTime(): number {
    return this.reset;
  }

  getUsed(): number {
    return this.used;
  }

  getResource(): string {
    return this.resource;
  }

  async waitIfNeeded(minRemaining = 100): Promise<void> {
    if (this.remaining >= minRemaining) {
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const waitSeconds = this.reset - now;

    if (waitSeconds <= 0) {
      return;
    }

    if (waitSeconds > GitHubRateLimitManager.MAX_WAIT_SECONDS) {
      this.logger.warn(
        `Rate limit low (${this.remaining}/${this.limit}) but reset is ${waitSeconds}s away (>10min). Not waiting.`
      );
      return;
    }

    this.logger.warn(
      `Rate limit low: ${this.remaining}/${this.limit} remaining. ` +
        `Waiting ${waitSeconds}s until reset...`
    );
    await this.sleep(waitSeconds * 1000);
  }

  async waitForReset(retryCount = 0): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    let waitSeconds = this.reset - now;

    if (waitSeconds <= 0) {
      waitSeconds = Math.min(
        GitHubRateLimitManager.BACKOFF_MAX_SECONDS,
        Math.pow(2, retryCount) * GitHubRateLimitManager.BACKOFF_BASE_SECONDS
      );
    }

    waitSeconds = Math.min(waitSeconds, GitHubRateLimitManager.MAX_WAIT_SECONDS);

    this.logger.warn(
      `Rate limited! Waiting ${waitSeconds}s before retry (attempt ${retryCount + 1})...`
    );
    await this.sleep(waitSeconds * 1000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
