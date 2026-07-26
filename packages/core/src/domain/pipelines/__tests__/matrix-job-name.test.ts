import { describe, expect, it } from 'vitest';
import { normalizeMatrixJobName } from '../matrix-job-name';

describe('normalizeMatrixJobName', () => {
  it('strips a trailing matrix index from a job name', () => {
    expect(normalizeMatrixJobName('test (1)')).toBe('test');
    expect(normalizeMatrixJobName('test (42)')).toBe('test');
  });

  it('collapses all parallel matrix legs onto the same base name', () => {
    const legs = ['test (1)', 'test (2)', 'test (3)'].map(normalizeMatrixJobName);
    expect(legs).toEqual(['test', 'test', 'test']);
  });

  it('leaves non-matrix names unchanged (after trimming)', () => {
    expect(normalizeMatrixJobName('test')).toBe('test');
    expect(normalizeMatrixJobName('build')).toBe('build');
  });

  it('only strips the trailing index, preserving meaningful parentheses earlier in the name', () => {
    expect(normalizeMatrixJobName('deploy (prod) (1)')).toBe('deploy (prod)');
    expect(normalizeMatrixJobName('Run on (linux) (12)')).toBe('Run on (linux)');
  });

  it('does not strip a trailing word (only digits are matrix indices)', () => {
    expect(normalizeMatrixJobName('deploy (prod)')).toBe('deploy (prod)');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeMatrixJobName('  test (1)  ')).toBe('test');
  });

  it('handles empty/undefined/null input by returning an empty string', () => {
    expect(normalizeMatrixJobName('')).toBe('');
    expect(normalizeMatrixJobName(undefined)).toBe('');
    expect(normalizeMatrixJobName(null)).toBe('');
  });
});
