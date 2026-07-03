import { describe, expect, it } from 'vitest';
import {
  averageMetricSamples,
  cleanMetricSamples,
  parseMetricCleaningOptions,
} from '../src/domain/metric-samples';

describe('metric sample cleaning', () => {
  it('excludes weekend samples before computing averages when requested', () => {
    const cleaned = cleanMetricSamples(
      [
        { value: 10, timestamp: '2026-06-26T12:00:00Z', item: 'friday' },
        { value: 90, timestamp: '2026-06-27T12:00:00Z', item: 'saturday' },
        { value: 20, timestamp: '2026-06-29T12:00:00Z', item: 'monday' },
      ],
      { weekends: 'exclude' }
    );

    expect(cleaned.samples.map((sample) => sample.item)).toEqual(['friday', 'monday']);
    expect(averageMetricSamples(cleaned.samples)).toBe(15);
  });

  it('includes weekend samples by default', () => {
    const cleaned = cleanMetricSamples([
      { value: 10, timestamp: '2026-06-26T12:00:00Z', item: 'friday' },
      { value: 90, timestamp: '2026-06-27T12:00:00Z', item: 'saturday' },
    ]);

    expect(cleaned.samples.map((sample) => sample.item)).toEqual(['friday', 'saturday']);
  });

  it('keeps only weekend samples when requested', () => {
    const cleaned = cleanMetricSamples(
      [
        { value: 10, timestamp: '2026-06-26T12:00:00Z', item: 'friday' },
        { value: 90, timestamp: '2026-06-27T12:00:00Z', item: 'saturday' },
        { value: 80, timestamp: '2026-06-28T12:00:00Z', item: 'sunday' },
        { value: 20, timestamp: '2026-06-29T12:00:00Z', item: 'monday' },
      ],
      { weekends: 'weekends_only' }
    );

    expect(cleaned.samples.map((sample) => sample.item)).toEqual(['saturday', 'sunday']);
    expect(averageMetricSamples(cleaned.samples)).toBe(85);
  });

  it('parses weekends_only as a weekends cleaning mode', () => {
    expect(parseMetricCleaningOptions({ weekends: 'weekends_only' }).weekends).toBe(
      'weekends_only'
    );
  });

  it('flags IQR outliers without removing them by default', () => {
    const cleaned = cleanMetricSamples(
      [
        { value: 10, timestamp: '2026-06-22T12:00:00Z', item: 'a' },
        { value: 11, timestamp: '2026-06-23T12:00:00Z', item: 'b' },
        { value: 12, timestamp: '2026-06-24T12:00:00Z', item: 'c' },
        { value: 13, timestamp: '2026-06-25T12:00:00Z', item: 'd' },
        { value: 100, timestamp: '2026-06-26T12:00:00Z', item: 'e' },
      ],
      { outlierMode: 'flag' }
    );

    expect(cleaned.samples).toHaveLength(5);
    expect(cleaned.outliers).toHaveLength(1);
    expect(cleaned.outliers[0].item).toBe('e');
  });

  it('excludes IQR outliers when requested', () => {
    const cleaned = cleanMetricSamples(
      [
        { value: 10, timestamp: '2026-06-22T12:00:00Z', item: 'a' },
        { value: 11, timestamp: '2026-06-23T12:00:00Z', item: 'b' },
        { value: 12, timestamp: '2026-06-24T12:00:00Z', item: 'c' },
        { value: 13, timestamp: '2026-06-25T12:00:00Z', item: 'd' },
        { value: 100, timestamp: '2026-06-26T12:00:00Z', item: 'e' },
      ],
      { outlierMode: 'exclude' }
    );

    expect(cleaned.samples.map((sample) => sample.item)).toEqual(['a', 'b', 'c', 'd']);
    expect(cleaned.outliers.map((sample) => sample.item)).toEqual(['e']);
  });
});
