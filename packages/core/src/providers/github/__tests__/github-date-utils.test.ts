import { describe, it, expect } from 'vitest';
import { toISODateString, buildCreatedFilter } from '../github-date-utils';

describe('toISODateString', () => {
  it('should convert YYYY-MM-DD start date to ISO with T00:00:00Z', () => {
    const result = toISODateString('2025-01-01', 'start');
    expect(result).toBe('2025-01-01T00:00:00Z');
  });

  it('should convert YYYY-MM-DD end date to ISO with T23:59:59Z', () => {
    const result = toISODateString('2025-01-01', 'end');
    expect(result).toBe('2025-01-01T23:59:59Z');
  });

  it('should convert MM-DD-YYYY start date to ISO with T00:00:00Z', () => {
    const result = toISODateString('01-06-2026', 'start');
    expect(result).toBe('2026-01-06T00:00:00Z');
  });

  it('should convert MM-DD-YYYY end date to ISO with T23:59:59Z', () => {
    const result = toISODateString('01-06-2026', 'end');
    expect(result).toBe('2026-01-06T23:59:59Z');
  });

  it('should convert MM/DD/YYYY start date to ISO', () => {
    const result = toISODateString('01/06/2026', 'start');
    expect(result).toBe('2026-01-06T00:00:00Z');
  });

  it('should convert ISO date with time to correct start boundary', () => {
    const result = toISODateString('2026-05-15T00:00:00Z', 'start');
    expect(result).toBe('2026-05-15T00:00:00Z');
  });

  it('should return ISO timestamp unchanged when it already includes time', () => {
    const result = toISODateString('2026-05-15T00:00:00Z', 'end');
    expect(result).toBe('2026-05-15T00:00:00Z');
  });

  it('should return original input for unparseable dates', () => {
    const result = toISODateString('not-a-date', 'start');
    expect(result).toBe('not-a-date');
  });

  it('should handle dates near epoch', () => {
    const result = toISODateString('1970-01-01', 'start');
    expect(result).toBe('1970-01-01T00:00:00Z');
  });

  it('should handle single-digit month and day (M-D-YYYY)', () => {
    const result = toISODateString('1-6-2026', 'start');
    expect(result).toBe('2026-01-06T00:00:00Z');
  });

  it('should handle single-digit month and day in US format with slashes', () => {
    const result = toISODateString('1/6/2026', 'end');
    expect(result).toBe('2026-01-06T23:59:59Z');
  });
});

describe('buildCreatedFilter', () => {
  it('should build filter with start and end dates normalized', () => {
    const result = buildCreatedFilter('2026-05-05', '2026-05-15');
    expect(result).toBe('2026-05-05T00:00:00Z..2026-05-15T23:59:59Z');
  });

  it('should build filter with MM-DD-YYYY dates (year 2025, month 01, day 01)', () => {
    const result = buildCreatedFilter('01-01-2025', '12-31-2026');
    expect(result).toBe('2025-01-01T00:00:00Z..2026-12-31T23:59:59Z');
  });

  it('should return undefined when both dates are absent', () => {
    const result = buildCreatedFilter();
    expect(result).toBeUndefined();
  });

  it('should return undefined when both dates are undefined explicitly', () => {
    const result = buildCreatedFilter(undefined, undefined);
    expect(result).toBeUndefined();
  });

  it('should handle only start date with > prefix', () => {
    const result = buildCreatedFilter('2025-01-01');
    expect(result).toBe('>2025-01-01T00:00:00Z');
  });

  it('should handle only end date with < prefix', () => {
    const result = buildCreatedFilter(undefined, '2026-01-06');
    expect(result).toBe('<2026-01-06T23:59:59Z');
  });
});
