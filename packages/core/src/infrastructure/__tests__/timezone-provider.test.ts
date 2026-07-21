import { describe, it, expect } from 'vitest';
import { TimeZoneProvider } from '../timezone-provider';

describe('TimeZoneProvider', () => {
  it('uses timezone day boundaries for date-only values', () => {
    const provider = new TimeZoneProvider('UTC');

    expect(provider.getStartOfDayBoundary('2026-01-05').toISOString()).toBe(
      '2026-01-05T00:00:00.000Z'
    );
    expect(provider.getEndOfDayBoundary('2026-01-05').toISOString()).toBe(
      '2026-01-05T23:59:59.999Z'
    );
  });

  it('keeps full datetime values as exact filter boundaries', () => {
    const provider = new TimeZoneProvider('UTC');

    expect(provider.getStartOfDayBoundary('2026-01-05T08:30:00+01:00').toISOString()).toBe(
      '2026-01-05T07:30:00.000Z'
    );
    expect(provider.getEndOfDayBoundary('2026-01-05T17:45:00+01:00').toISOString()).toBe(
      '2026-01-05T16:45:00.000Z'
    );
  });

  describe('getWeekKey (ISO 8601 week numbering)', () => {
    const provider = new TimeZoneProvider('UTC');

    it('returns ISO week 1 for a Thursday in early January', () => {
      // 2026-01-01 is a Thursday -> ISO 2026-W01
      expect(provider.getWeekKey('2026-01-01T12:00:00Z')).toBe('2026-W01');
    });

    it('returns the correct week for a mid-year Wednesday', () => {
      // 2026-07-01 is a Wednesday -> ISO 2026-W27
      expect(provider.getWeekKey('2026-07-01T12:00:00Z')).toBe('2026-W27');
    });

    it('rolls a late-December Tuesday into the next year', () => {
      // 2024-12-31 is a Tuesday -> ISO 2025-W01
      expect(provider.getWeekKey('2024-12-31T12:00:00Z')).toBe('2025-W01');
    });

    it('supports the last possible week (W53) for a long year', () => {
      // 2026 is a long year (starts on Thursday) -> 2026-12-31 is ISO 2026-W53
      expect(provider.getWeekKey('2026-12-31T12:00:00Z')).toBe('2026-W53');
    });

    it('keeps a Sunday in the same ISO week as the preceding Monday', () => {
      // 2026-06-28 (Sunday) belongs to the same ISO week as 2026-06-22 (Monday)
      expect(provider.getWeekKey('2026-06-22T12:00:00Z')).toBe('2026-W26');
      expect(provider.getWeekKey('2026-06-28T12:00:00Z')).toBe('2026-W26');
    });
  });
});
