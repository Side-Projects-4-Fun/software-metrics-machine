import { formatMetricNotation } from '@/lib/metrics/metric-catalog';

describe('formatMetricNotation', () => {
  it('starts a new line after each clause semicolon', () => {
    expect(formatMetricNotation('a = b; c = d; e = f')).toBe('a = b;\nc = d;\ne = f');
  });

  it('keeps single-clause notation on one line', () => {
    expect(formatMetricNotation('a = b')).toBe('a = b');
  });

  it('trims extra spaces around clause breaks', () => {
    expect(formatMetricNotation('a = b;   c = d')).toBe('a = b;\nc = d');
  });
});
