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
});
