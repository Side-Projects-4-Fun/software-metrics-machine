import type { Logger } from '@smmachine/utils';

/**
 * Tracks GitHub API rate limit state from response headers and provides
 * proactive pause / reactive retry utilities — no HTTP library coupling.
 *
 * Key headers:
 *   x-ratelimit-limit:      5000
 *   x-ratelimit-remaining:  4897
 *   x-ratelimit-reset:      1718000000  (Unix epoch seconds)
 *   x-ratelimit-resource:   core
 *   x-ratelimit-used:       103
 *
 * Usage:
 *   1. Call `updateFromHeaders(response.headers)` after every GitHub API response
 *   2. Call `await waitIfNeeded()` before each request to pause when running low
 *   3. On 429/403, call `await waitForReset(retryCount)` to wait then retry
 */
export class GitHubRateLimitManager {
  private remaining = Infinity;
  private reset = 0;
  private limit = 0;
  private used = 0;
  private resource = '';
  private logger: Logger;

  /** Never pause for more than 10 minutes */
  private static readonly MAX_WAIT_SECONDS = 600;

  /** Fallback backoff base in seconds */
  private static readonly BACKOFF_BASE_SECONDS = 5;

  /** Max backoff cap */
  private static readonly BACKOFF_MAX_SECONDS = 60;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  // ── Header parsing ────────────────────────────────────────────────────

  /**
   * Parse GitHub rate-limit headers from an API response.
   * Handles both string and string[] header values (axios lower-cases and
   * may return arrays for repeated headers).
   */
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

  // ── Accessors ─────────────────────────────────────────────────────────

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

  // ── Proactive pause ───────────────────────────────────────────────────

  /**
   * Proactively pause when remaining requests are below `minRemaining`.
   * Sleeps until the rate-limit window resets (or gives up if reset is
   * too far in the future to avoid hanging indefinitely).
   *
   * Call this **before** making a request.
   */
  async waitIfNeeded(minRemaining = 100): Promise<void> {
    if (this.remaining >= minRemaining) {
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const waitSeconds = this.reset - now;

    if (waitSeconds <= 0) {
      return; // Window already reset
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

  // ── Reactive retry wait (429/403) ─────────────────────────────────────

  /**
   * Wait for rate-limit reset after receiving a 429 or 403.
   * Uses the `x-ratelimit-reset` header when available, otherwise falls
   * back to exponential backoff (5s, 10s, 20s, ... capped at 60s).
   *
   * @param retryCount - Zero-based attempt number (0 = first retry).
   */
  async waitForReset(retryCount = 0): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    let waitSeconds = this.reset - now;

    if (waitSeconds <= 0) {
      // No valid reset time — use exponential backoff
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

  // ── Internal ──────────────────────────────────────────────────────────

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
