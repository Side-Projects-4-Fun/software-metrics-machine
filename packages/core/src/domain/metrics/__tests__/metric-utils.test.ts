import { describe, it, expect } from 'vitest';
import { normalizeMetricMethod, VALID_METRIC_METHODS } from '../metric-utils';

describe('normalizeMetricMethod', () => {
  it('returns average when no value is provided', () => {
    expect(normalizeMetricMethod()).toBe('average');
  });

  it('returns average when an empty string is provided', () => {
    expect(normalizeMetricMethod('')).toBe('average');
  });

  it('normalizes an uppercase valid method to lowercase', () => {
    expect(normalizeMetricMethod('MEDIAN')).toBe('median');
  });

  it('normalizes a mixed-case valid method to lowercase', () => {
    expect(normalizeMetricMethod('P90')).toBe('p90');
  });

  it('returns average for an unrecognized method value', () => {
    expect(normalizeMetricMethod('bogus')).toBe('average');
  });

  it('returns the method unchanged when it is already a valid lowercase value', () => {
    expect(normalizeMetricMethod('p95')).toBe('p95');
  });

  it('exposes all seven supported methods', () => {
    expect(VALID_METRIC_METHODS).toEqual(['average', 'median', 'p75', 'p90', 'p95', 'min', 'max']);
  });
});
