import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import {
  SonarqubeFetchMetricsRepository,
  type CodeMetric,
  type ISonarqubeMeasuresClient,
  type SonarqubeComponentMeasure,
  type SonarqubeComponentTreeMeasure,
} from '../../..';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';

function createSonarqubeClient(
  overrides: Partial<ISonarqubeMeasuresClient> = {}
): ISonarqubeMeasuresClient {
  return {
    fetchComponentMeasures: vi.fn(),
    fetchHistoricalMeasures: vi.fn(),
    fetchComponentTree: vi.fn(),
    ...overrides,
  };
}

function createComponentMeasure(
  overrides: Partial<SonarqubeComponentMeasure> = {}
): SonarqubeComponentMeasure {
  return {
    id: '1',
    key: 'my-project',
    name: 'My Project',
    measures: [{ metric: 'coverage', value: '80.0', bestValue: false }],
    ...overrides,
  };
}

function createComponentTreeMeasure(
  overrides: Partial<SonarqubeComponentTreeMeasure> = {}
): SonarqubeComponentTreeMeasure {
  return {
    key: 'my-project:src/foo.ts',
    name: 'foo.ts',
    qualifier: 'FIL',
    measures: [],
    ...overrides,
  };
}

function createCodeMetric(overrides: Partial<CodeMetric> = {}): CodeMetric {
  return {
    key: 'coverage_2026-05-01',
    name: 'coverage on 2026-05-01',
    metric: 'coverage',
    value: '80.0',
    formatter: 'PERCENT',
    timestamp: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

async function seedHistoricalCache(cacheDir: string, entries: CodeMetric[][]): Promise<void> {
  const store = {
    entries: entries.map((data) => ({ fetchedAt: new Date().toISOString(), data })),
  };
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(path.join(cacheDir, 'historical-measures.json'), JSON.stringify(store));
}

async function readHistoricalCache(cacheDir: string): Promise<{
  entries: Array<{ fetchedAt: string; data: CodeMetric[] }>;
}> {
  return JSON.parse(await fs.readFile(path.join(cacheDir, 'historical-measures.json'), 'utf-8'));
}

describe('SonarqubeFetchMetricsRepository', () => {
  const logger = new MockLoggerBuilder().build();

  describe('fetchQualityMetrics', () => {
    it('fetches metrics from the client and appends a timestamped entry to the cache', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-sq-measures-'));
      const measures = createComponentMeasure();
      const fetchComponentMeasures = vi.fn().mockResolvedValue(measures);
      const sonarqubeClient = createSonarqubeClient({ fetchComponentMeasures });
      const configuration = { getSonarqubePath: () => cacheDir };

      const repository = new SonarqubeFetchMetricsRepository(
        sonarqubeClient,
        configuration as never,
        logger
      );

      const result = await repository.fetchQualityMetrics({ metrics: ['coverage'] });

      expect(fetchComponentMeasures).toHaveBeenCalledWith({ metrics: ['coverage'] });
      expect(result).toEqual(measures);

      const stored = JSON.parse(await fs.readFile(path.join(cacheDir, 'measures.json'), 'utf-8'));
      expect(stored.entries).toHaveLength(1);
      expect(stored.entries[0].data).toEqual(measures);
      expect(typeof stored.entries[0].fetchedAt).toBe('string');
    });
  });

  describe('fetchComponentTree', () => {
    it('fetches the component tree from the client and appends a timestamped entry to the cache', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-sq-tree-'));
      const tree = [createComponentTreeMeasure()];
      const fetchComponentTree = vi.fn().mockResolvedValue(tree);
      const sonarqubeClient = createSonarqubeClient({ fetchComponentTree });
      const configuration = { getSonarqubePath: () => cacheDir };

      const repository = new SonarqubeFetchMetricsRepository(
        sonarqubeClient,
        configuration as never,
        logger
      );

      const result = await repository.fetchComponentTree({
        component: 'my-project',
        depth: 1,
        metrics: ['ncloc'],
      });

      expect(fetchComponentTree).toHaveBeenCalledWith({
        component: 'my-project',
        depth: 1,
        metrics: ['ncloc'],
      });
      expect(result).toEqual(tree);

      const stored = JSON.parse(
        await fs.readFile(path.join(cacheDir, 'component-tree.json'), 'utf-8')
      );
      expect(stored.entries).toHaveLength(1);
      expect(stored.entries[0].data).toEqual(tree);
    });

    it('wraps client errors with a descriptive message', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-sq-tree-err-'));
      const fetchComponentTree = vi.fn().mockRejectedValue(new Error('network down'));
      const sonarqubeClient = createSonarqubeClient({ fetchComponentTree });
      const configuration = { getSonarqubePath: () => cacheDir };

      const repository = new SonarqubeFetchMetricsRepository(
        sonarqubeClient,
        configuration as never,
        logger
      );

      await expect(repository.fetchComponentTree()).rejects.toThrow(
        'Failed to fetch component tree: network down'
      );
    });
  });

  describe('fetchHistoricalMeasures', () => {
    it('plain fetch: calls the client as-is and caches the result when no cache, range or incremental flags are given', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-sq-hist-plain-'));
      const fresh = [createCodeMetric()];
      const fetchHistoricalMeasures = vi.fn().mockResolvedValue(fresh);
      const sonarqubeClient = createSonarqubeClient({ fetchHistoricalMeasures });
      const configuration = { getSonarqubePath: () => cacheDir };

      const repository = new SonarqubeFetchMetricsRepository(
        sonarqubeClient,
        configuration as never,
        logger
      );

      const result = await repository.fetchHistoricalMeasures({ metrics: ['coverage'] });

      expect(fetchHistoricalMeasures).toHaveBeenCalledWith({ metrics: ['coverage'] });
      expect(result).toEqual(fresh);

      const stored = await readHistoricalCache(cacheDir);
      expect(stored.entries).toHaveLength(1);
      expect(stored.entries[0].data).toEqual(fresh);
    });

    it('incremental update with a non-empty cache: fetches from the latest cached date and merges, de-duping by metric+timestamp', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-sq-hist-incr-'));
      const cachedMetric = createCodeMetric({
        key: 'coverage_2026-05-01',
        timestamp: '2026-05-01T00:00:00.000Z',
      });
      await seedHistoricalCache(cacheDir, [[cachedMetric]]);

      const freshDuplicate = createCodeMetric({
        key: 'coverage_2026-05-01',
        timestamp: '2026-05-01T00:00:00.000Z',
        value: '99.9', // should be ignored: cached entry wins because key already present
      });
      const freshNew = createCodeMetric({
        key: 'coverage_2026-05-10',
        timestamp: '2026-05-10T00:00:00.000Z',
      });
      const fetchHistoricalMeasures = vi.fn().mockResolvedValue([freshDuplicate, freshNew]);
      const sonarqubeClient = createSonarqubeClient({ fetchHistoricalMeasures });
      const configuration = { getSonarqubePath: () => cacheDir };

      const repository = new SonarqubeFetchMetricsRepository(
        sonarqubeClient,
        configuration as never,
        logger
      );

      const result = await repository.fetchHistoricalMeasures({
        metrics: ['coverage'],
        incrementalUpdate: true,
      });

      expect(fetchHistoricalMeasures).toHaveBeenCalledWith({
        metrics: ['coverage'],
        startDate: '2026-05-01T00:00:00.000Z',
        endDate: undefined,
      });

      expect(result).toHaveLength(2);
      expect(result).toEqual(expect.arrayContaining([cachedMetric, freshNew]));
      // the cached entry's value is preserved, not overwritten by the duplicate fresh one
      expect(result.find((m) => m.timestamp === '2026-05-01T00:00:00.000Z')?.value).toBe('80.0');

      const stored = await readHistoricalCache(cacheDir);
      expect(stored.entries).toHaveLength(2);
      expect(stored.entries[1].data).toEqual(result);
    });

    it('incremental update with an empty cache falls through to plain fetch', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-sq-hist-incr-empty-'));
      const fresh = [createCodeMetric()];
      const fetchHistoricalMeasures = vi.fn().mockResolvedValue(fresh);
      const sonarqubeClient = createSonarqubeClient({ fetchHistoricalMeasures });
      const configuration = { getSonarqubePath: () => cacheDir };

      const repository = new SonarqubeFetchMetricsRepository(
        sonarqubeClient,
        configuration as never,
        logger
      );

      const options = { metrics: ['coverage'], incrementalUpdate: true };
      const result = await repository.fetchHistoricalMeasures(options);

      // Falls through past the incremental branch (empty cache) into the plain fetch,
      // which forwards the full options object unchanged.
      expect(fetchHistoricalMeasures).toHaveBeenCalledWith(options);
      expect(result).toEqual(fresh);
    });

    it('manual date range with a non-empty cache: fetches for that range and merges with the cache', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-sq-hist-range-'));
      const cachedMetric = createCodeMetric({
        key: 'coverage_2026-04-01',
        timestamp: '2026-04-01T00:00:00.000Z',
      });
      await seedHistoricalCache(cacheDir, [[cachedMetric]]);

      const freshMetric = createCodeMetric({
        key: 'coverage_2026-04-15',
        timestamp: '2026-04-15T00:00:00.000Z',
      });
      const fetchHistoricalMeasures = vi.fn().mockResolvedValue([freshMetric]);
      const sonarqubeClient = createSonarqubeClient({ fetchHistoricalMeasures });
      const configuration = { getSonarqubePath: () => cacheDir };

      const repository = new SonarqubeFetchMetricsRepository(
        sonarqubeClient,
        configuration as never,
        logger
      );

      const result = await repository.fetchHistoricalMeasures({
        metrics: ['coverage'],
        startDate: '2026-04-01T00:00:00.000Z',
        endDate: '2026-04-30T00:00:00.000Z',
      });

      expect(fetchHistoricalMeasures).toHaveBeenCalledWith({
        metrics: ['coverage'],
        startDate: '2026-04-01T00:00:00.000Z',
        endDate: '2026-04-30T00:00:00.000Z',
      });
      expect(result).toEqual(expect.arrayContaining([cachedMetric, freshMetric]));
      expect(result).toHaveLength(2);

      const stored = await readHistoricalCache(cacheDir);
      expect(stored.entries).toHaveLength(2);
      expect(stored.entries[1].data).toEqual(result);
    });

    it('manual date range with an empty cache falls through to plain fetch', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-sq-hist-range-empty-'));
      const fresh = [createCodeMetric()];
      const fetchHistoricalMeasures = vi.fn().mockResolvedValue(fresh);
      const sonarqubeClient = createSonarqubeClient({ fetchHistoricalMeasures });
      const configuration = { getSonarqubePath: () => cacheDir };

      const repository = new SonarqubeFetchMetricsRepository(
        sonarqubeClient,
        configuration as never,
        logger
      );

      const options = {
        metrics: ['coverage'],
        startDate: '2026-04-01T00:00:00.000Z',
        endDate: '2026-04-30T00:00:00.000Z',
      };
      const result = await repository.fetchHistoricalMeasures(options);

      // Falls through past the merge branch (no cache) into the plain fetch,
      // which forwards the full options object unchanged.
      expect(fetchHistoricalMeasures).toHaveBeenCalledWith(options);
      expect(result).toEqual(fresh);
    });

    it('forceRefresh bypasses the date-range merge branch even with a non-empty cache and dates set', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-sq-hist-force-'));
      const cachedMetric = createCodeMetric({
        key: 'coverage_2026-04-01',
        timestamp: '2026-04-01T00:00:00.000Z',
      });
      await seedHistoricalCache(cacheDir, [[cachedMetric]]);

      const fresh = [
        createCodeMetric({ key: 'coverage_2026-06-01', timestamp: '2026-06-01T00:00:00.000Z' }),
      ];
      const fetchHistoricalMeasures = vi.fn().mockResolvedValue(fresh);
      const sonarqubeClient = createSonarqubeClient({ fetchHistoricalMeasures });
      const configuration = { getSonarqubePath: () => cacheDir };

      const repository = new SonarqubeFetchMetricsRepository(
        sonarqubeClient,
        configuration as never,
        logger
      );

      const options = {
        metrics: ['coverage'],
        startDate: '2026-04-01T00:00:00.000Z',
        endDate: '2026-04-30T00:00:00.000Z',
        forceRefresh: true,
      };
      const result = await repository.fetchHistoricalMeasures(options);

      // forceRefresh forwards the full options object through to a plain fetch,
      // with no merge against the cache.
      expect(fetchHistoricalMeasures).toHaveBeenCalledWith(options);
      expect(result).toEqual(fresh);

      const stored = await readHistoricalCache(cacheDir);
      expect(stored.entries).toHaveLength(2);
      expect(stored.entries[1].data).toEqual(fresh);
    });

    it('wraps client errors with a descriptive message', async () => {
      const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-sq-hist-err-'));
      const fetchHistoricalMeasures = vi.fn().mockRejectedValue(new Error('timeout'));
      const sonarqubeClient = createSonarqubeClient({ fetchHistoricalMeasures });
      const configuration = { getSonarqubePath: () => cacheDir };

      const repository = new SonarqubeFetchMetricsRepository(
        sonarqubeClient,
        configuration as never,
        logger
      );

      await expect(repository.fetchHistoricalMeasures()).rejects.toThrow(
        'Failed to fetch historical measures: timeout'
      );
    });
  });
});
