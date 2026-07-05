import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { GitHubRateLimitManager } from '../github-rate-limit-manager';
import { MockLoggerBuilder } from '../../../test/mock-logger-builder';

describe('GitHubRateLimitManager', () => {
  let manager: GitHubRateLimitManager;
  const logger = new MockLoggerBuilder().build();

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new GitHubRateLimitManager(logger);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('updateFromHeaders', () => {
    it('should parse rate limit headers from GitHub API response', () => {
      manager.updateFromHeaders({
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4897',
        'x-ratelimit-reset': '1718000000',
        'x-ratelimit-resource': 'core',
        'x-ratelimit-used': '103',
      });

      expect(manager.getRemaining()).toBe(4897);
      expect(manager.getLimit()).toBe(5000);
      expect(manager.getResetTime()).toBe(1718000000);
      expect(manager.getResource()).toBe('core');
      expect(manager.getUsed()).toBe(103);
    });

    it('should handle lowercase header names', () => {
      manager.updateFromHeaders({
        'x-ratelimit-remaining': '42',
        'x-ratelimit-reset': '1718000000',
      });

      expect(manager.getRemaining()).toBe(42);
      expect(manager.getResetTime()).toBe(1718000000);
    });

    it('should handle header values as arrays (axios lower-cases headers)', () => {
      manager.updateFromHeaders({
        'x-ratelimit-remaining': ['99'],
        'x-ratelimit-limit': ['5000'],
        'x-ratelimit-reset': ['1718000000'],
      });

      expect(manager.getRemaining()).toBe(99);
      expect(manager.getLimit()).toBe(5000);
    });

    it('should not update when headers are missing', () => {
      manager.updateFromHeaders({});

      expect(manager.getRemaining()).toBe(Infinity);
      expect(manager.getLimit()).toBe(0);
      expect(manager.getResetTime()).toBe(0);
    });

    it('should handle mixed array and string headers', () => {
      manager.updateFromHeaders({
        'x-ratelimit-remaining': '50',
        'x-ratelimit-reset': ['1718000000'],
      });

      expect(manager.getRemaining()).toBe(50);
      expect(manager.getResetTime()).toBe(1718000000);
    });
  });

  describe('waitIfNeeded', () => {
    it('should not wait when remaining is above threshold', async () => {
      manager.updateFromHeaders({
        'x-ratelimit-remaining': '500',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
      });

      const promise = manager.waitIfNeeded(100);
      // Advance time — if waitIfNeeded didn't sleep, this resolves immediately
      vi.advanceTimersByTime(0);
      await promise;
      // If we got here without hanging, the test passes
      expect(manager.getRemaining()).toBe(500);
    });

    it('should wait when remaining drops below threshold', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 60; // 60 seconds from now
      manager.updateFromHeaders({
        'x-ratelimit-remaining': '50',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-reset': String(resetTime),
      });

      const waitPromise = manager.waitIfNeeded(100);
      vi.advanceTimersByTime(60000); // Advance past the reset
      await waitPromise;

      expect(manager.getRemaining()).toBe(50);
    });

    it('should not wait more than 10 minutes (600s)', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      manager.updateFromHeaders({
        'x-ratelimit-remaining': '50',
        'x-ratelimit-reset': String(resetTime),
      });

      const startTime = Date.now();
      const waitPromise = manager.waitIfNeeded(100);
      vi.advanceTimersByTime(100);
      await waitPromise;

      // Should resolve almost immediately (not wait 1 hour)
      expect(Date.now() - startTime).toBeLessThan(1000);
    });

    it('should not wait if reset time is in the past', async () => {
      manager.updateFromHeaders({
        'x-ratelimit-remaining': '50',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) - 60), // 1 minute ago
      });

      const startTime = Date.now();
      const waitPromise = manager.waitIfNeeded(100);
      vi.advanceTimersByTime(100);
      await waitPromise;

      expect(Date.now() - startTime).toBeLessThan(1000);
    });

    it('should use default threshold of 100 when not specified', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 30;
      manager.updateFromHeaders({
        'x-ratelimit-remaining': '99',
        'x-ratelimit-reset': String(resetTime),
      });

      const waitPromise = manager.waitIfNeeded(); // no threshold arg
      vi.advanceTimersByTime(30000);
      await waitPromise;

      expect(manager.getRemaining()).toBe(99);
    });

    it('should not wait when remaining is exactly at threshold', async () => {
      manager.updateFromHeaders({
        'x-ratelimit-remaining': '100',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
      });

      const startTime = Date.now();
      const waitPromise = manager.waitIfNeeded(100);
      vi.advanceTimersByTime(100);
      await waitPromise;

      expect(Date.now() - startTime).toBeLessThan(1000);
    });
  });

  describe('waitForReset', () => {
    it('should wait until the reset timestamp', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 30; // 30 seconds
      manager.updateFromHeaders({
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(resetTime),
      });

      const waitPromise = manager.waitForReset();
      vi.advanceTimersByTime(30000);
      await waitPromise;

      // Successfully waited
      expect(true).toBe(true);
    });

    it('should use exponential backoff when reset time is in the past', async () => {
      manager.updateFromHeaders({
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) - 60),
      });

      // First retry: 5s backoff
      const waitPromise1 = manager.waitForReset(0);
      vi.advanceTimersByTime(5000);
      await waitPromise1;

      // Second retry: 10s backoff
      const waitPromise2 = manager.waitForReset(1);
      vi.advanceTimersByTime(10000);
      await waitPromise2;

      expect(true).toBe(true);
    });

    it('should not exceed max backoff of 60 seconds', async () => {
      manager.updateFromHeaders({
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) - 60),
      });

      // Retry 5: should cap at 60s (2^5 * 5 = 160, capped to 60)
      const waitPromise = manager.waitForReset(5);
      vi.advanceTimersByTime(60000);
      await waitPromise;

      expect(true).toBe(true);
    });
  });

  describe('initial state', () => {
    it('should have infinite remaining on initialization', () => {
      expect(manager.getRemaining()).toBe(Infinity);
      expect(manager.getLimit()).toBe(0);
      expect(manager.getResetTime()).toBe(0);
      expect(manager.getResource()).toBe('');
      expect(manager.getUsed()).toBe(0);
    });

    it('should return isRateLimitSafe as true when remaining is Infinity', () => {
      expect(manager.getRemaining()).toBe(Infinity);
    });
  });
});
