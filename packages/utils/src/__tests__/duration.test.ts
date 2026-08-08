import { describe, it, expect } from 'vitest';
import { formatDuration } from '../duration';

describe('formatDuration', () => {
  describe('minutes input', () => {
    it('returns "0 min" for exactly zero', () => {
      expect(formatDuration(0, 'minutes')).toBe('0 min');
    });

    it('returns "< 1 min" for a fraction of a minute', () => {
      expect(formatDuration(0.5, 'minutes')).toBe('< 1 min');
    });

    it('rounds to whole minutes for values under 1 hour', () => {
      expect(formatDuration(42, 'minutes')).toBe('42 min');
    });

    it('rounds 42.7 minutes to 43 min', () => {
      expect(formatDuration(42.7, 'minutes')).toBe('43 min');
    });

    it('shows hours and minutes for values between 1h and 24h', () => {
      expect(formatDuration(150, 'minutes')).toBe('2h 30m');
    });

    it('shows just hours when minutes remainder is zero', () => {
      expect(formatDuration(120, 'minutes')).toBe('2h');
    });

    it('shows days and hours for values over 24h', () => {
      expect(formatDuration(2880, 'minutes')).toBe('2d');
    });

    it('shows days and remaining hours for non-day multiples', () => {
      expect(formatDuration(3000, 'minutes')).toBe('2d 2h');
    });
  });

  describe('hours input', () => {
    it('converts 0.7 hours (42 min) to "42 min"', () => {
      expect(formatDuration(0.7, 'hours')).toBe('42 min');
    });

    it('converts 3.5 hours to "3h 30m"', () => {
      expect(formatDuration(3.5, 'hours')).toBe('3h 30m');
    });

    it('converts 24 hours to "1d"', () => {
      expect(formatDuration(24, 'hours')).toBe('1d');
    });

    it('converts 168 hours (1 week) to "7d"', () => {
      expect(formatDuration(168, 'hours')).toBe('7d');
    });
  });

  describe('days input', () => {
    it('converts 0.001 days (~1.4 min) to "1 min"', () => {
      expect(formatDuration(0.001, 'days')).toBe('1 min');
    });

    it('converts 0.0001 days (~0.14 min) to "< 1 min"', () => {
      expect(formatDuration(0.0001, 'days')).toBe('< 1 min');
    });

    it('converts 0.04 days (~58 min) to "58 min"', () => {
      expect(formatDuration(0.04, 'days')).toBe('58 min');
    });

    it('converts 2 days to "2d"', () => {
      expect(formatDuration(2, 'days')).toBe('2d');
    });

    it('converts 2.5 days to "2d 12h"', () => {
      expect(formatDuration(2.5, 'days')).toBe('2d 12h');
    });

    it('converts 14 days to "14d"', () => {
      expect(formatDuration(14, 'days')).toBe('14d');
    });
  });

  describe('edge cases', () => {
    it('returns "—" for NaN', () => {
      expect(formatDuration(Number.NaN, 'minutes')).toBe('—');
    });

    it('returns "—" for Infinity', () => {
      expect(formatDuration(Number.POSITIVE_INFINITY, 'hours')).toBe('—');
    });

    it('returns "—" for negative values', () => {
      expect(formatDuration(-5, 'minutes')).toBe('—');
    });
  });
});
