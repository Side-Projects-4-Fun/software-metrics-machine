import { Logger } from '@smmachine/utils';
import {
  SonarqubeComponentMeasure,
  SonarqubeComponentTreeMeasure,
  CodeMetric,
  type ISonarqubeMeasuresClient,
} from '..';
import { Configuration, IRepository, RepositoryFactory } from '../../../infrastructure';
import { TimestampedStore, extractLatestData } from '../types';

export interface IQualityMetricsRepository {
  fetchQualityMetrics(options?: { metrics?: string[] }): Promise<SonarqubeComponentMeasure>;
  fetchComponentTree(options?: {
    component?: string;
    depth?: number;
    metrics?: string[];
  }): Promise<SonarqubeComponentTreeMeasure[]>;
  fetchHistoricalMeasures(options?: {
    metrics?: string[];
    startDate?: string;
    endDate?: string;
  }): Promise<CodeMetric[]>;
}

export class SonarqubeFetchMetricsRepository implements IQualityMetricsRepository {
  private measuresJsonRepository: IRepository<TimestampedStore<SonarqubeComponentMeasure>>;
  private componentTreeJsonRepository: IRepository<
    TimestampedStore<SonarqubeComponentTreeMeasure[]>
  >;
  private historicalMeasuresJsonRepository: IRepository<TimestampedStore<CodeMetric[]>>;

  constructor(
    private sonarqubeClient: ISonarqubeMeasuresClient,
    private configuration: Configuration,
    private logger: Logger,
  ) {
    const cacheDir = this.configuration.getSonarqubePath();
    this.measuresJsonRepository = RepositoryFactory.create<
      TimestampedStore<SonarqubeComponentMeasure>
    >(
      `${cacheDir}/measures.json`,
      logger,
      this.configuration
    );
    this.componentTreeJsonRepository = RepositoryFactory.create<
      TimestampedStore<SonarqubeComponentTreeMeasure[]>
    >(`${cacheDir}/component-tree.json`, logger, this.configuration);
    this.historicalMeasuresJsonRepository = RepositoryFactory.create<TimestampedStore<CodeMetric[]>>(
      `${cacheDir}/historical-measures.json`,
      logger,
      this.configuration
    );
  }

  /**
   * Get quality metrics
   */
  async fetchQualityMetrics(options?: { metrics?: string[] }): Promise<SonarqubeComponentMeasure> {
    this.logger.info('Fetching quality metrics from SonarQube...');
    const metrics = await this.sonarqubeClient.fetchComponentMeasures({
      metrics: options?.metrics,
    });

    await this.appendTimestampedEntry(this.measuresJsonRepository, metrics);

    return metrics;
  }

  async fetchComponentTree(options?: {
    component?: string;
    depth?: number;
    metrics?: string[];
  }): Promise<SonarqubeComponentTreeMeasure[]> {
    try {
      this.logger.debug(`Fetching component tree: ${JSON.stringify(options)}`);

      const componentTree = await this.sonarqubeClient.fetchComponentTree({
        component: options?.component,
        depth: options?.depth,
        metrics: options?.metrics,
      });
      await this.appendTimestampedEntry(this.componentTreeJsonRepository, componentTree);

      return componentTree;
    } catch (error) {
      this.logger.error(
        `Failed to fetch component tree: ${error}`,
        error instanceof Error ? error.stack : ''
      );
      throw new Error(
        `Failed to fetch component tree: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async fetchHistoricalMeasures(options?: {
    metrics?: string[];
    startDate?: string;
    endDate?: string;
    forceRefresh?: boolean;
    incrementalUpdate?: boolean;
  }): Promise<CodeMetric[]> {
    try {
      this.logger.debug(`Fetching historical measures: ${JSON.stringify(options)}`);

      const fromDisk = await this.historicalMeasuresJsonRepository.load();
      const cachedData = extractLatestData(fromDisk);
      const cached: CodeMetric[] = Array.isArray(cachedData) ? cachedData : [];

      if (options?.incrementalUpdate) {
        if (cached.length > 0) {
          const latestDate = this.findLatestDateInMeasures(cached);
          this.logger.info(`Incremental update: fetching historical measures after ${latestDate}...`);
          const fresh = await this.sonarqubeClient.fetchHistoricalMeasures({
            metrics: options?.metrics,
            startDate: latestDate,
            endDate: options?.endDate,
          });
          const merged = this.mergeHistoricalMeasures(cached, fresh);
          await this.appendTimestampedEntry(this.historicalMeasuresJsonRepository, merged);
          return merged;
        }
      }

      // Manual date range with merge
      if ((options?.startDate || options?.endDate) && !options?.forceRefresh) {
        if (cached.length > 0) {
          this.logger.info(
            `Fetching historical measures for range [${options?.startDate || 'any'}..${options?.endDate || 'any'}] and merging with cache...`
          );
          const fresh = await this.sonarqubeClient.fetchHistoricalMeasures({
            metrics: options?.metrics,
            startDate: options?.startDate,
            endDate: options?.endDate,
          });
          const merged = this.mergeHistoricalMeasures(cached, fresh);
          await this.appendTimestampedEntry(this.historicalMeasuresJsonRepository, merged);
          return merged;
        }
      }

      const historical = await this.sonarqubeClient.fetchHistoricalMeasures(options);
      await this.appendTimestampedEntry(this.historicalMeasuresJsonRepository, historical);
      return historical;
    } catch (error) {
      this.logger.error(
        `Failed to fetch historical measures: ${error}`,
        error instanceof Error ? error.stack : ''
      );
      throw new Error(
        `Failed to fetch historical measures: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private findLatestDateInMeasures(measures: CodeMetric[]): string {
    const timestamps = (measures as unknown as Array<{ timestamp?: string }>)
      .map((m) => m.timestamp as string | undefined)
      .filter((t): t is string => !!t)
      .map((t) => new Date(t).getTime());
    if (timestamps.length === 0) return new Date(0).toISOString();
    return new Date(Math.max(...timestamps)).toISOString();
  }

  private mergeHistoricalMeasures(existing: CodeMetric[], incoming: CodeMetric[]): CodeMetric[] {
    const key = (m: unknown): string =>
      `${(m as { metric?: string }).metric ?? ''}_${(m as { timestamp?: string }).timestamp ?? ''}`;
    const map = new Map<string, CodeMetric>();
    for (const m of existing) {
      const k = key(m);
      if (!map.has(k)) map.set(k, m);
    }
    for (const m of incoming) {
      const k = key(m);
      if (!map.has(k)) map.set(k, m);
    }
    return Array.from(map.values());
  }

  private async appendTimestampedEntry<T>(
    repo: IRepository<TimestampedStore<T>>,
    data: T
  ): Promise<void> {
    const raw = await repo.load();
    let store: TimestampedStore<T>;

    if (raw && Array.isArray((raw as unknown as { entries?: unknown }).entries)) {
      store = raw as TimestampedStore<T>;
    } else if (raw) {
      // Legacy format: migrate old data as first entry
      store = { entries: [{ fetchedAt: new Date(0).toISOString(), data: raw as unknown as T }] };
    } else {
      store = { entries: [] };
    }

    store.entries.push({ fetchedAt: new Date().toISOString(), data });
    await repo.save(store);
  }
}
