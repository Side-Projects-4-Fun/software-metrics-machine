import { SonarqubeComponentMeasure } from '../../..';
import { IRepository } from '../../../infrastructure';
import {
  CodeMetric,
  SonarqubeComponentTreeMeasure,
  SonarqubeMeasure,
  TimestampedEntry,
  TimestampedStore,
  extractLatestData,
} from '../types';
import {
  matchesPathPattern,
  normalizePatternList,
} from '../../../domain/code/pattern-filters';

type StoredMeasure = {
  metric?: string;
  key?: string;
  name?: string;
  value?: string | number;
};

export type SonarqubeMeasureFilters = {
  measures?: string | string[];
};

export type SonarqubeComponentTreeFilters = {
  component?: string;
  depth?: number;
  metrics?: string | string[];
  ignore_files?: string | string[];
  include_files?: string | string[];
  remove_folders?: boolean;
};

export class SonarqubeRepositoryJson {
  constructor(
    private measuresJsonRepository: IRepository<TimestampedStore<SonarqubeComponentMeasure>>,
    private componentTreeJsonRepository: IRepository<TimestampedStore<SonarqubeComponentTreeMeasure[]>>,
    private historicalMeasuresJsonRepository?: IRepository<TimestampedStore<CodeMetric[]>>
  ) {}

  async loadAll(
    options?: SonarqubeMeasureFilters | string[]
  ): Promise<SonarqubeComponentMeasure | null> {
    const store = await this.measuresJsonRepository.load();
    return this.filterComponentMeasure(extractLatestData(store), options);
  }

  async loadMeasurements(
    options?: SonarqubeMeasureFilters | string[]
  ): Promise<SonarqubeMeasure[]> {
    const data = await this.loadAll(options);
    if (!data) {
      return [];
    }
    return data.measures.map((m: StoredMeasure) => ({
      metric: m.metric ?? m.key ?? m.name ?? '',
      value: String(m.value ?? ''),
    }));
  }

  async loadAllMeasurementEntries(): Promise<TimestampedEntry<SonarqubeMeasure[]>[]> {
    const store = await this.measuresJsonRepository.load();
    if (!store) return [];

    const entries = Array.isArray(store.entries) ? store.entries : [];
    return entries.map((entry: TimestampedEntry<SonarqubeComponentMeasure>) => ({
      fetchedAt: entry.fetchedAt,
      data: (entry.data?.measures || []).map((m: StoredMeasure) => ({
        metric: m.metric ?? m.key ?? m.name ?? '',
        value: String(m.value ?? ''),
      })),
    }));
  }

  async loadComponentTree(
    options?: SonarqubeComponentTreeFilters
  ): Promise<SonarqubeComponentTreeMeasure[]> {
    const store = await this.componentTreeJsonRepository.load();
    return this.filterComponentTree(extractLatestData(store) || [], options);
  }

  async loadAllComponentTreeEntries(
    options?: SonarqubeComponentTreeFilters
  ): Promise<TimestampedEntry<SonarqubeComponentTreeMeasure[]>[]> {
    const store = await this.componentTreeJsonRepository.load();
    if (!store) return [];

    const entries = Array.isArray(store.entries) ? store.entries : [];
    return entries.map((entry: TimestampedEntry<SonarqubeComponentTreeMeasure[]>) => ({
      fetchedAt: entry.fetchedAt,
      data: this.filterComponentTree(Array.isArray(entry.data) ? entry.data : [], options),
    }));
  }

  async loadHistoricalMeasures(
    options?: SonarqubeMeasureFilters | string[]
  ): Promise<CodeMetric[]> {
    const store = await this.historicalMeasuresJsonRepository?.load();
    return this.filterHistoricalMeasures(extractLatestData(store ?? null) || [], options);
  }

  async loadCoverageHistory(): Promise<CodeMetric[]> {
    return this.loadHistoricalMeasures({ measures: 'coverage' });
  }

  async loadAllHistoricalMeasureEntries(
    options?: SonarqubeMeasureFilters | string[]
  ): Promise<TimestampedEntry<CodeMetric[]>[]> {
    const store = await this.historicalMeasuresJsonRepository?.load();
    if (!store) return [];

    const entries = Array.isArray(store.entries) ? store.entries : [];
    return entries.map((entry: TimestampedEntry<CodeMetric[]>) => ({
      fetchedAt: entry.fetchedAt,
      data: this.filterHistoricalMeasures(Array.isArray(entry.data) ? entry.data : [], options),
    }));
  }

  private filterComponentMeasure(
    measure: SonarqubeComponentMeasure | null,
    options?: SonarqubeMeasureFilters | string[]
  ): SonarqubeComponentMeasure | null {
    if (!measure) {
      return null;
    }

    const measures = this.normalizeMeasures(options);
    if (measures.length === 0) {
      return measure;
    }

    return {
      ...measure,
      measures: (measure.measures || []).filter((item) => measures.includes(item.metric)),
    };
  }

  private normalizeMeasures(options?: SonarqubeMeasureFilters | string[]): string[] {
    const value = Array.isArray(options) ? options : options?.measures;
    return normalizePatternList(value);
  }

  private filterHistoricalMeasures(
    measures: CodeMetric[],
    options?: SonarqubeMeasureFilters | string[]
  ): CodeMetric[] {
    const measureFilters = this.normalizeMeasures(options);
    if (measureFilters.length === 0) {
      return measures;
    }

    return measures.filter((measure) => {
      const metric = measure.metric ?? measure.key.split('_')[0] ?? measure.name;
      return measureFilters.includes(metric);
    });
  }

  private filterComponentTree(
    components: SonarqubeComponentTreeMeasure[],
    options?: SonarqubeComponentTreeFilters
  ): SonarqubeComponentTreeMeasure[] {
    const ignorePatterns = normalizePatternList(options?.ignore_files);
    const includePatterns = normalizePatternList(options?.include_files);
    const metricFilters = normalizePatternList(options?.metrics);
    const removeFolders = options?.remove_folders || false;

    return components
      .filter((component) => {
        const componentType = component.type || component.qualifier;
        if (removeFolders && (componentType === 'DIR' || componentType === 'TRK')) {
          return false;
        }

        const key = component.key || '';
        const name = component.name || '';

        if (includePatterns.length > 0) {
          const matchesInclude = includePatterns.some(
            (pattern) => this.matchesPattern(key, pattern) || this.matchesPattern(name, pattern)
          );
          if (!matchesInclude) {
            return false;
          }
        }

        return !ignorePatterns.some(
          (pattern) => this.matchesPattern(key, pattern) || this.matchesPattern(name, pattern)
        );
      })
      .map((component) => {
        if (metricFilters.length === 0) {
          return component;
        }

        return {
          ...component,
          measures: (component.measures || []).filter((measure) =>
            metricFilters.includes(measure.key)
          ),
        };
      });
  }

  private matchesPattern(entity: string, pattern: string): boolean {
    if (!entity) {
      return false;
    }

    return matchesPathPattern(entity, pattern);
  }
}
