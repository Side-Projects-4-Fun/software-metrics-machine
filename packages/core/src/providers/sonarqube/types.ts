export interface CodeMetric {
  key: string;
  name: string;
  metric?: string;
  value: string | number;
  formatter: string;
  timestamp?: string;
}

export interface SonarqubeComponentTreeMeasure {
  key: string;
  name: string;
  type?: string;
  qualifier?: string;
  measures: CodeMetric[];
}

export interface SonarqubeComponent {
  metric: string;
  value: string;
  bestValue: boolean;
}

export interface SonarqubeComponentMeasure {
  id: string;
  key: string;
  name: string;
  qualifier?: string;
  measures: SonarqubeComponent[];
}

export interface SonarqubeMeasure {
  metric: string;
  value: string;
}

export interface TimestampedEntry<T> {
  fetchedAt: string;
  data: T;
}

export interface TimestampedStore<T> {
  entries: TimestampedEntry<T>[];
}

export function extractLatestData<T>(raw: TimestampedStore<T> | null): T | null {
  if (!raw) return null;
  const rawRecord = raw as unknown as { entries?: TimestampedEntry<T>[] };
  if (Array.isArray(rawRecord.entries) && rawRecord.entries.length > 0) {
    return rawRecord.entries[rawRecord.entries.length - 1].data;
  }

  if (!rawRecord.entries) {
    return raw as unknown as T;
  }
  return null;
}
