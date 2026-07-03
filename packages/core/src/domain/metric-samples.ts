export type OutlierMode = 'include' | 'flag' | 'exclude';
export type WeekendsMode = 'include' | 'exclude' | 'weekends_only';

export interface MetricCleaningOptions {
  weekends?: WeekendsMode;
  outlierMode?: OutlierMode;
}

export interface MetricSample<TItem = unknown> {
  value: number;
  timestamp: string;
  item: TItem;
}

export interface MetricOutlier<TItem = unknown> {
  value: number;
  timestamp: string;
  item: TItem;
  lowerBound: number;
  upperBound: number;
}

export interface CleanedMetricSamples<TItem = unknown> {
  samples: Array<MetricSample<TItem>>;
  outliers: Array<MetricOutlier<TItem>>;
  originalCount: number;
  filteredCount: number;
}

export function cleanMetricSamples<TItem>(
  samples: Array<MetricSample<TItem>>,
  options?: MetricCleaningOptions
): CleanedMetricSamples<TItem> {
  const weekends = options?.weekends || 'include';
  const outlierMode = options?.outlierMode || 'include';
  const weekendFilteredSamples = samples.filter((sample) =>
    shouldIncludeTimestampForWeekendsMode(sample.timestamp, weekends)
  );
  const outliers = outlierMode === 'include' ? [] : findIqrOutliers(weekendFilteredSamples);
  const includedSamples =
    outlierMode === 'exclude'
      ? weekendFilteredSamples.filter(
          (sample) => !outliers.some((outlier) => outlier.item === sample.item)
        )
      : weekendFilteredSamples;

  return {
    samples: includedSamples,
    outliers,
    originalCount: samples.length,
    filteredCount: samples.length - includedSamples.length,
  };
}

export function averageMetricSamples<TItem>(samples: Array<MetricSample<TItem>>): number {
  return samples.length > 0
    ? samples.reduce((sum, sample) => sum + sample.value, 0) / samples.length
    : 0;
}

export function parseMetricCleaningOptions(options: {
  weekends?: string;
  outlierMode?: string;
  outliers?: string;
}): MetricCleaningOptions {
  const outlierMode = normalizeOutlierMode(options.outlierMode || options.outliers);
  return {
    weekends: normalizeWeekendsMode(options.weekends),
    outlierMode,
  };
}

function normalizeOutlierMode(value?: string): OutlierMode {
  const normalized = (value || 'include').toLowerCase();
  return normalized === 'flag' || normalized === 'exclude' ? normalized : 'include';
}

function normalizeWeekendsMode(value?: string): WeekendsMode {
  const normalized = (value || 'include').toLowerCase();
  return normalized === 'exclude' || normalized === 'weekends_only' ? normalized : 'include';
}

export function shouldIncludeTimestampForWeekendsMode(
  timestamp: string | undefined,
  weekends: WeekendsMode = 'include',
  isWeekdayFn: (timestamp?: string) => boolean = isWeekday
): boolean {
  if (weekends === 'include') {
    return true;
  }

  const weekday = isWeekdayFn(timestamp);
  return weekends === 'exclude' ? weekday : !weekday;
}

function isWeekday(timestamp?: string): boolean {
  if (!timestamp) {
    return true;
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return true;
  }
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function findIqrOutliers<TItem>(
  samples: Array<MetricSample<TItem>>
): Array<MetricOutlier<TItem>> {
  if (samples.length < 4) {
    return [];
  }

  const values = samples.map((sample) => sample.value).sort((a, b) => a - b);
  const q1 = percentile(values, 0.25);
  const q3 = percentile(values, 0.75);
  const iqr = q3 - q1;

  if (iqr === 0) {
    return [];
  }

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  return samples
    .filter((sample) => sample.value < lowerBound || sample.value > upperBound)
    .map((sample) => ({
      value: sample.value,
      timestamp: sample.timestamp,
      item: sample.item,
      lowerBound,
      upperBound,
    }));
}

function percentile(values: number[], ratio: number): number {
  const index = (values.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return values[lower];
  }

  return values[lower] + (values[upper] - values[lower]) * (index - lower);
}
