import { describe, expect, it } from 'vitest';
import { SonarqubeRepository } from '../../src/aggregates/sonarqube-repository-json';
import { InMemoryRepository } from '../../src/test/in-memory-repository';
import type {
  CodeMetric,
  SonarqubeComponentMeasure,
  SonarqubeComponentTreeMeasure,
  TimestampedStore,
} from '../../src/providers/sonarqube/types';

describe('SonarqubeRepository', () => {
  it('filters component tree entries with shared include and ignore patterns', async () => {
    const componentTreeRepository = new InMemoryRepository<
      TimestampedStore<SonarqubeComponentTreeMeasure[]>
    >();
    await componentTreeRepository.save({
      entries: [
        {
          fetchedAt: '2024-03-01T00:00:00.000Z',
          data: [
            {
              key: 'src/Button.ts',
              name: 'Button.ts',
              qualifier: 'FIL',
            },
            {
              key: 'src/Button.test.ts',
              name: 'Button.test.ts',
              qualifier: 'FIL',
            },
            {
              key: 'docs/readme.md',
              name: 'readme.md',
              qualifier: 'FIL',
            },
          ],
        },
      ],
    });

    const repository = new SonarqubeRepository(
      new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
      componentTreeRepository
    );

    await expect(
      repository.loadComponentTree({
        include_files: 'src/**',
        ignore_files: '*.test.ts',
      })
    ).resolves.toEqual([
      {
        key: 'src/Button.ts',
        name: 'Button.ts',
        qualifier: 'FIL',
      },
    ]);
  });

  describe('loadAll', () => {
    it('returns null when there is no data in the measurement repository', async () => {
      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        new InMemoryRepository<TimestampedStore<SonarqubeComponentTreeMeasure[]>>()
      );

      expect(await repository.loadAll()).toBeNull();
    });

    it('returns the latest measure as-is when no filter is supplied', async () => {
      const measurementRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentMeasure>
      >();
      const measure: SonarqubeComponentMeasure = {
        id: '1',
        key: 'project-a',
        name: 'Project A',
        measures: [
          { metric: 'coverage', value: '81.3', bestValue: false },
          { metric: 'bugs', value: '2', bestValue: true },
        ],
      };
      await measurementRepository.save({
        entries: [{ fetchedAt: '2024-03-01T00:00:00.000Z', data: measure }],
      });

      const repository = new SonarqubeRepository(
        measurementRepository,
        new InMemoryRepository<TimestampedStore<SonarqubeComponentTreeMeasure[]>>()
      );

      expect(await repository.loadAll()).toEqual(measure);
    });

    it('filters measures using an object-form measures filter', async () => {
      const measurementRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentMeasure>
      >();
      const measure: SonarqubeComponentMeasure = {
        id: '1',
        key: 'project-a',
        name: 'Project A',
        measures: [
          { metric: 'coverage', value: '81.3', bestValue: false },
          { metric: 'bugs', value: '2', bestValue: true },
        ],
      };
      await measurementRepository.save({
        entries: [{ fetchedAt: '2024-03-01T00:00:00.000Z', data: measure }],
      });

      const repository = new SonarqubeRepository(
        measurementRepository,
        new InMemoryRepository<TimestampedStore<SonarqubeComponentTreeMeasure[]>>()
      );

      expect(await repository.loadAll({ measures: ['coverage'] })).toEqual({
        ...measure,
        measures: [{ metric: 'coverage', value: '81.3', bestValue: false }],
      });
    });

    it('filters measures using a bare string array filter', async () => {
      const measurementRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentMeasure>
      >();
      const measure: SonarqubeComponentMeasure = {
        id: '1',
        key: 'project-a',
        name: 'Project A',
        measures: [
          { metric: 'coverage', value: '81.3', bestValue: false },
          { metric: 'bugs', value: '2', bestValue: true },
        ],
      };
      await measurementRepository.save({
        entries: [{ fetchedAt: '2024-03-01T00:00:00.000Z', data: measure }],
      });

      const repository = new SonarqubeRepository(
        measurementRepository,
        new InMemoryRepository<TimestampedStore<SonarqubeComponentTreeMeasure[]>>()
      );

      expect(await repository.loadAll(['bugs'])).toEqual({
        ...measure,
        measures: [{ metric: 'bugs', value: '2', bestValue: true }],
      });
    });

    it('falls back to an empty measures array when the stored measure has none', async () => {
      const measurementRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentMeasure>
      >();
      const measure = {
        id: '1',
        key: 'project-a',
        name: 'Project A',
      } as unknown as SonarqubeComponentMeasure;
      await measurementRepository.save({
        entries: [{ fetchedAt: '2024-03-01T00:00:00.000Z', data: measure }],
      });

      const repository = new SonarqubeRepository(
        measurementRepository,
        new InMemoryRepository<TimestampedStore<SonarqubeComponentTreeMeasure[]>>()
      );

      expect(await repository.loadAll({ measures: ['coverage'] })).toEqual({
        ...measure,
        measures: [],
      });
    });
  });

  describe('loadMeasurements', () => {
    it('returns an empty array when there is no data', async () => {
      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        new InMemoryRepository<TimestampedStore<SonarqubeComponentTreeMeasure[]>>()
      );

      expect(await repository.loadMeasurements()).toEqual([]);
    });

    it('maps measures, falling back through key/name when metric is missing and using value or empty string', async () => {
      const measurementRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentMeasure>
      >();
      const measure = {
        id: '1',
        key: 'project-a',
        name: 'Project A',
        measures: [
          { metric: 'coverage', value: 81.3 },
          { key: 'bugs', value: '2' },
          { name: 'sqale_rating' },
        ],
      } as unknown as SonarqubeComponentMeasure;
      await measurementRepository.save({
        entries: [{ fetchedAt: '2024-03-01T00:00:00.000Z', data: measure }],
      });

      const repository = new SonarqubeRepository(
        measurementRepository,
        new InMemoryRepository<TimestampedStore<SonarqubeComponentTreeMeasure[]>>()
      );

      expect(await repository.loadMeasurements()).toEqual([
        { metric: 'coverage', value: '81.3' },
        { metric: 'bugs', value: '2' },
        { metric: 'sqale_rating', value: '' },
      ]);
    });
  });

  describe('loadAllMeasurementEntries', () => {
    it('returns an empty array when there is no store', async () => {
      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        new InMemoryRepository<TimestampedStore<SonarqubeComponentTreeMeasure[]>>()
      );

      expect(await repository.loadAllMeasurementEntries()).toEqual([]);
    });

    it('returns an empty array when store.entries is not an array', async () => {
      const measurementRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentMeasure>
      >();
      await measurementRepository.save({
        entries: 'not-an-array',
      } as unknown as TimestampedStore<SonarqubeComponentMeasure>);

      const repository = new SonarqubeRepository(
        measurementRepository,
        new InMemoryRepository<TimestampedStore<SonarqubeComponentTreeMeasure[]>>()
      );

      expect(await repository.loadAllMeasurementEntries()).toEqual([]);
    });

    it('maps every entry independently, defaulting missing measures to an empty array', async () => {
      const measurementRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentMeasure>
      >();
      await measurementRepository.save({
        entries: [
          {
            fetchedAt: '2024-01-01T00:00:00.000Z',
            data: {
              id: '1',
              key: 'project-a',
              name: 'Project A',
              measures: [{ metric: 'coverage', value: '50' }],
            } as unknown as SonarqubeComponentMeasure,
          },
          {
            fetchedAt: '2024-02-01T00:00:00.000Z',
            data: { id: '1', key: 'project-a', name: 'Project A' } as unknown as SonarqubeComponentMeasure,
          },
        ],
      });

      const repository = new SonarqubeRepository(
        measurementRepository,
        new InMemoryRepository<TimestampedStore<SonarqubeComponentTreeMeasure[]>>()
      );

      expect(await repository.loadAllMeasurementEntries()).toEqual([
        {
          fetchedAt: '2024-01-01T00:00:00.000Z',
          data: [{ metric: 'coverage', value: '50' }],
        },
        {
          fetchedAt: '2024-02-01T00:00:00.000Z',
          data: [],
        },
      ]);
    });
  });

  describe('loadComponentTree', () => {
    it('returns an empty array when there is no data in the component tree repository', async () => {
      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        new InMemoryRepository<TimestampedStore<SonarqubeComponentTreeMeasure[]>>()
      );

      expect(await repository.loadComponentTree()).toEqual([]);
    });

    it('returns components unchanged when no filters are supplied', async () => {
      const componentTreeRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentTreeMeasure[]>
      >();
      const components: SonarqubeComponentTreeMeasure[] = [
        {
          key: 'src/index.ts',
          name: 'index.ts',
          qualifier: 'FIL',
          measures: [{ key: 'coverage', name: 'coverage', value: '80', formatter: 'PERCENT' }],
        },
      ];
      await componentTreeRepository.save({
        entries: [{ fetchedAt: '2024-03-01T00:00:00.000Z', data: components }],
      });

      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        componentTreeRepository
      );

      expect(await repository.loadComponentTree()).toEqual(components);
    });

    it('removes folders identified via type when remove_folders is true', async () => {
      const componentTreeRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentTreeMeasure[]>
      >();
      const file: SonarqubeComponentTreeMeasure = {
        key: 'src/index.ts',
        name: 'index.ts',
        type: 'FIL',
        measures: [],
      };
      const folder: SonarqubeComponentTreeMeasure = {
        key: 'src',
        name: 'src',
        type: 'DIR',
        measures: [],
      };
      await componentTreeRepository.save({
        entries: [{ fetchedAt: '2024-03-01T00:00:00.000Z', data: [file, folder] }],
      });

      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        componentTreeRepository
      );

      expect(await repository.loadComponentTree({ remove_folders: true })).toEqual([file]);
    });

    it('removes the project root identified via qualifier (TRK) when remove_folders is true', async () => {
      const componentTreeRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentTreeMeasure[]>
      >();
      const file: SonarqubeComponentTreeMeasure = {
        key: 'src/index.ts',
        name: 'index.ts',
        qualifier: 'FIL',
        measures: [],
      };
      const root: SonarqubeComponentTreeMeasure = {
        key: 'my-project',
        name: 'my-project',
        qualifier: 'TRK',
        measures: [],
      };
      await componentTreeRepository.save({
        entries: [{ fetchedAt: '2024-03-01T00:00:00.000Z', data: [file, root] }],
      });

      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        componentTreeRepository
      );

      expect(await repository.loadComponentTree({ remove_folders: true })).toEqual([file]);
    });

    it('keeps folders when remove_folders is omitted', async () => {
      const componentTreeRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentTreeMeasure[]>
      >();
      const folder: SonarqubeComponentTreeMeasure = {
        key: 'src',
        name: 'src',
        qualifier: 'DIR',
        measures: [],
      };
      await componentTreeRepository.save({
        entries: [{ fetchedAt: '2024-03-01T00:00:00.000Z', data: [folder] }],
      });

      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        componentTreeRepository
      );

      expect(await repository.loadComponentTree()).toEqual([folder]);
    });

    it('keeps only components whose key or name match an include_files pattern', async () => {
      const componentTreeRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentTreeMeasure[]>
      >();
      const matchesByKey: SonarqubeComponentTreeMeasure = {
        key: 'src/payments/index.ts',
        name: 'index.ts',
        measures: [],
      };
      const matchesByName: SonarqubeComponentTreeMeasure = {
        key: 'src/other.ts',
        name: 'special-name.ts',
        measures: [],
      };
      const matchesNeither: SonarqubeComponentTreeMeasure = {
        key: 'src/unrelated.ts',
        name: 'unrelated.ts',
        measures: [],
      };
      await componentTreeRepository.save({
        entries: [
          {
            fetchedAt: '2024-03-01T00:00:00.000Z',
            data: [matchesByKey, matchesByName, matchesNeither],
          },
        ],
      });

      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        componentTreeRepository
      );

      expect(
        await repository.loadComponentTree({ include_files: ['payments', 'special-name'] })
      ).toEqual([matchesByKey, matchesByName]);
    });

    it('excludes components whose key or name match an ignore_files pattern', async () => {
      const componentTreeRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentTreeMeasure[]>
      >();
      const ignoredByKey: SonarqubeComponentTreeMeasure = {
        key: 'src/generated/index.ts',
        name: 'index.ts',
        measures: [],
      };
      const ignoredByName: SonarqubeComponentTreeMeasure = {
        key: 'src/other.ts',
        name: 'generated-name.ts',
        measures: [],
      };
      const kept: SonarqubeComponentTreeMeasure = {
        key: 'src/keep.ts',
        name: 'keep.ts',
        measures: [],
      };
      await componentTreeRepository.save({
        entries: [
          {
            fetchedAt: '2024-03-01T00:00:00.000Z',
            data: [ignoredByKey, ignoredByName, kept],
          },
        ],
      });

      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        componentTreeRepository
      );

      expect(await repository.loadComponentTree({ ignore_files: ['generated'] })).toEqual([kept]);
    });

    it('combines include_files and ignore_files filters', async () => {
      const componentTreeRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentTreeMeasure[]>
      >();
      const includedAndNotIgnored: SonarqubeComponentTreeMeasure = {
        key: 'src/payments/index.ts',
        name: 'index.ts',
        measures: [],
      };
      const includedButIgnored: SonarqubeComponentTreeMeasure = {
        key: 'src/payments/generated.ts',
        name: 'generated.ts',
        measures: [],
      };
      const notIncluded: SonarqubeComponentTreeMeasure = {
        key: 'src/other.ts',
        name: 'other.ts',
        measures: [],
      };
      await componentTreeRepository.save({
        entries: [
          {
            fetchedAt: '2024-03-01T00:00:00.000Z',
            data: [includedAndNotIgnored, includedButIgnored, notIncluded],
          },
        ],
      });

      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        componentTreeRepository
      );

      expect(
        await repository.loadComponentTree({
          include_files: ['payments'],
          ignore_files: ['generated'],
        })
      ).toEqual([includedAndNotIgnored]);
    });

    it('filters component measures to the given metrics list, defaulting missing measures to an empty array', async () => {
      const componentTreeRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentTreeMeasure[]>
      >();
      const withMeasures: SonarqubeComponentTreeMeasure = {
        key: 'src/index.ts',
        name: 'index.ts',
        measures: [
          { key: 'coverage', name: 'coverage', value: '80', formatter: 'PERCENT' },
          { key: 'bugs', name: 'bugs', value: '1', formatter: 'NUMBER' },
        ],
      };
      const withoutMeasures = {
        key: 'src/other.ts',
        name: 'other.ts',
      } as unknown as SonarqubeComponentTreeMeasure;
      await componentTreeRepository.save({
        entries: [
          { fetchedAt: '2024-03-01T00:00:00.000Z', data: [withMeasures, withoutMeasures] },
        ],
      });

      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        componentTreeRepository
      );

      expect(await repository.loadComponentTree({ metrics: ['coverage'] })).toEqual([
        {
          ...withMeasures,
          measures: [{ key: 'coverage', name: 'coverage', value: '80', formatter: 'PERCENT' }],
        },
        { ...withoutMeasures, measures: [] },
      ]);
    });

    it('treats missing key and name as empty strings before pattern matching', async () => {
      const componentTreeRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentTreeMeasure[]>
      >();
      const noKeyOrName = {
        measures: [],
      } as unknown as SonarqubeComponentTreeMeasure;
      await componentTreeRepository.save({
        entries: [{ fetchedAt: '2024-03-01T00:00:00.000Z', data: [noKeyOrName] }],
      });

      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        componentTreeRepository
      );

      expect(await repository.loadComponentTree({ ignore_files: ['anything'] })).toEqual([
        noKeyOrName,
      ]);
    });
  });

  describe('loadAllComponentTreeEntries', () => {
    it('returns an empty array when there is no store', async () => {
      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        new InMemoryRepository<TimestampedStore<SonarqubeComponentTreeMeasure[]>>()
      );

      expect(await repository.loadAllComponentTreeEntries()).toEqual([]);
    });

    it('treats a malformed (non-array) entry data as an empty array', async () => {
      const componentTreeRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentTreeMeasure[]>
      >();
      await componentTreeRepository.save({
        entries: [
          {
            fetchedAt: '2024-03-01T00:00:00.000Z',
            data: 'not-an-array' as unknown as SonarqubeComponentTreeMeasure[],
          },
        ],
      });

      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        componentTreeRepository
      );

      expect(await repository.loadAllComponentTreeEntries()).toEqual([
        { fetchedAt: '2024-03-01T00:00:00.000Z', data: [] },
      ]);
    });

    it('filters every entry independently using the supplied options', async () => {
      const componentTreeRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentTreeMeasure[]>
      >();
      const folder: SonarqubeComponentTreeMeasure = {
        key: 'src',
        name: 'src',
        type: 'DIR',
        measures: [],
      };
      const file: SonarqubeComponentTreeMeasure = {
        key: 'src/index.ts',
        name: 'index.ts',
        type: 'FIL',
        measures: [],
      };
      await componentTreeRepository.save({
        entries: [
          { fetchedAt: '2024-01-01T00:00:00.000Z', data: [folder] },
          { fetchedAt: '2024-02-01T00:00:00.000Z', data: [folder, file] },
        ],
      });

      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        componentTreeRepository
      );

      expect(
        await repository.loadAllComponentTreeEntries({ remove_folders: true })
      ).toEqual([
        { fetchedAt: '2024-01-01T00:00:00.000Z', data: [] },
        { fetchedAt: '2024-02-01T00:00:00.000Z', data: [file] },
      ]);
    });
  });

  describe('matchesPattern (via include_files/ignore_files)', () => {
    it('matches a plain substring pattern case-insensitively', async () => {
      const componentTreeRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentTreeMeasure[]>
      >();
      const component: SonarqubeComponentTreeMeasure = {
        key: 'src/Payments/Index.ts',
        name: 'Index.ts',
        measures: [],
      };
      await componentTreeRepository.save({
        entries: [{ fetchedAt: '2024-03-01T00:00:00.000Z', data: [component] }],
      });

      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        componentTreeRepository
      );

      expect(await repository.loadComponentTree({ include_files: ['PAYMENTS'] })).toEqual([
        component,
      ]);
    });

    it('matches a single-* glob against any run of non-slash characters in the basename', async () => {
      const componentTreeRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentTreeMeasure[]>
      >();
      const matching: SonarqubeComponentTreeMeasure = {
        key: 'src/index.test.ts',
        name: 'index.test.ts',
        measures: [],
      };
      const nonMatching: SonarqubeComponentTreeMeasure = {
        key: 'src/nested/dir/other.ts',
        name: 'other.ts',
        measures: [],
      };
      await componentTreeRepository.save({
        entries: [{ fetchedAt: '2024-03-01T00:00:00.000Z', data: [matching, nonMatching] }],
      });

      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        componentTreeRepository
      );

      expect(
        await repository.loadComponentTree({ include_files: ['*.test.ts'] })
      ).toEqual([matching]);
    });

    it('matches a ** glob across path separators against the full normalized path', async () => {
      const componentTreeRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentTreeMeasure[]>
      >();
      const matching: SonarqubeComponentTreeMeasure = {
        key: 'src/nested/dir/index.ts',
        name: 'index.ts',
        measures: [],
      };
      const nonMatching: SonarqubeComponentTreeMeasure = {
        key: 'other/index.ts',
        name: 'index.ts',
        measures: [],
      };
      await componentTreeRepository.save({
        entries: [{ fetchedAt: '2024-03-01T00:00:00.000Z', data: [matching, nonMatching] }],
      });

      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        componentTreeRepository
      );

      expect(
        await repository.loadComponentTree({ include_files: ['src/**/index.ts'] })
      ).toEqual([matching]);
    });

    it('matches a ? glob against exactly one non-slash character', async () => {
      const componentTreeRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentTreeMeasure[]>
      >();
      const matching: SonarqubeComponentTreeMeasure = {
        key: 'src/file1.ts',
        name: 'file1.ts',
        measures: [],
      };
      const nonMatching: SonarqubeComponentTreeMeasure = {
        key: 'src/file10.ts',
        name: 'file10.ts',
        measures: [],
      };
      await componentTreeRepository.save({
        entries: [{ fetchedAt: '2024-03-01T00:00:00.000Z', data: [matching, nonMatching] }],
      });

      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        componentTreeRepository
      );

      expect(
        await repository.loadComponentTree({ include_files: ['file?.ts'] })
      ).toEqual([matching]);
    });

    it('matches a pattern without a slash only against the basename', async () => {
      const componentTreeRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentTreeMeasure[]>
      >();
      const component: SonarqubeComponentTreeMeasure = {
        key: 'src/nested/index.ts',
        name: 'unrelated-name',
        measures: [],
      };
      await componentTreeRepository.save({
        entries: [{ fetchedAt: '2024-03-01T00:00:00.000Z', data: [component] }],
      });

      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        componentTreeRepository
      );

      expect(
        await repository.loadComponentTree({ include_files: ['*.ts'] })
      ).toEqual([component]);
    });

    it('normalizes backslash separators to forward slashes before matching', async () => {
      const componentTreeRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentTreeMeasure[]>
      >();
      const component: SonarqubeComponentTreeMeasure = {
        key: 'src\\nested\\index.ts',
        name: 'index.ts',
        measures: [],
      };
      await componentTreeRepository.save({
        entries: [{ fetchedAt: '2024-03-01T00:00:00.000Z', data: [component] }],
      });

      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        componentTreeRepository
      );

      expect(
        await repository.loadComponentTree({ include_files: ['src/**/index.ts'] })
      ).toEqual([component]);
    });
  });

  describe('loadHistoricalMeasures', () => {
    it('resolves to an empty array when no historical measures repository was passed to the constructor', async () => {
      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        new InMemoryRepository<TimestampedStore<SonarqubeComponentTreeMeasure[]>>()
      );

      expect(await repository.loadHistoricalMeasures()).toEqual([]);
    });

    it('resolves to an empty array when the historical measures repository has no data', async () => {
      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        new InMemoryRepository<TimestampedStore<SonarqubeComponentTreeMeasure[]>>(),
        new InMemoryRepository<TimestampedStore<CodeMetric[]>>()
      );

      expect(await repository.loadHistoricalMeasures()).toEqual([]);
    });

    it('filters historical measures by metric when a filter is supplied', async () => {
      const historicalRepository = new InMemoryRepository<TimestampedStore<CodeMetric[]>>();
      const coverageMetric: CodeMetric = {
        key: 'coverage_2024-01-01T00:00:00+0000',
        name: 'coverage on 2024-01-01',
        metric: 'coverage',
        value: '81.3',
        formatter: 'PERCENT',
      };
      const bugsMetric: CodeMetric = {
        key: 'bugs_2024-01-01T00:00:00+0000',
        name: 'bugs on 2024-01-01',
        metric: 'bugs',
        value: '2',
        formatter: 'NUMBER',
      };
      await historicalRepository.save({
        entries: [
          { fetchedAt: '2024-03-01T00:00:00.000Z', data: [coverageMetric, bugsMetric] },
        ],
      });

      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        new InMemoryRepository<TimestampedStore<SonarqubeComponentTreeMeasure[]>>(),
        historicalRepository
      );

      expect(await repository.loadHistoricalMeasures({ measures: 'coverage' })).toEqual([
        coverageMetric,
      ]);
    });

    it('falls back to the metric key prefix when metric is absent', async () => {
      const historicalRepository = new InMemoryRepository<TimestampedStore<CodeMetric[]>>();
      const metricWithoutMetricField = {
        key: 'coverage_2024-01-01T00:00:00+0000',
        name: 'coverage on 2024-01-01',
        value: '81.3',
        formatter: 'PERCENT',
      } as unknown as CodeMetric;
      await historicalRepository.save({
        entries: [
          { fetchedAt: '2024-03-01T00:00:00.000Z', data: [metricWithoutMetricField] },
        ],
      });

      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        new InMemoryRepository<TimestampedStore<SonarqubeComponentTreeMeasure[]>>(),
        historicalRepository
      );

      expect(await repository.loadHistoricalMeasures({ measures: 'coverage' })).toEqual([
        metricWithoutMetricField,
      ]);
    });
  });

  describe('loadAllHistoricalMeasureEntries', () => {
    it('resolves to an empty array when no historical measures repository was passed to the constructor', async () => {
      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        new InMemoryRepository<TimestampedStore<SonarqubeComponentTreeMeasure[]>>()
      );

      expect(await repository.loadAllHistoricalMeasureEntries()).toEqual([]);
    });

    it('treats a malformed (non-array) entry data as an empty array', async () => {
      const historicalRepository = new InMemoryRepository<TimestampedStore<CodeMetric[]>>();
      await historicalRepository.save({
        entries: [
          {
            fetchedAt: '2024-03-01T00:00:00.000Z',
            data: 'not-an-array' as unknown as CodeMetric[],
          },
        ],
      });

      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        new InMemoryRepository<TimestampedStore<SonarqubeComponentTreeMeasure[]>>(),
        historicalRepository
      );

      expect(await repository.loadAllHistoricalMeasureEntries()).toEqual([
        { fetchedAt: '2024-03-01T00:00:00.000Z', data: [] },
      ]);
    });

    it('filters every entry independently using the supplied options', async () => {
      const historicalRepository = new InMemoryRepository<TimestampedStore<CodeMetric[]>>();
      const coverageMetric: CodeMetric = {
        key: 'coverage_2024-01-01T00:00:00+0000',
        name: 'coverage on 2024-01-01',
        metric: 'coverage',
        value: '81.3',
        formatter: 'PERCENT',
      };
      const bugsMetric: CodeMetric = {
        key: 'bugs_2024-01-01T00:00:00+0000',
        name: 'bugs on 2024-01-01',
        metric: 'bugs',
        value: '2',
        formatter: 'NUMBER',
      };
      await historicalRepository.save({
        entries: [
          { fetchedAt: '2024-01-01T00:00:00.000Z', data: [coverageMetric] },
          { fetchedAt: '2024-02-01T00:00:00.000Z', data: [coverageMetric, bugsMetric] },
        ],
      });

      const repository = new SonarqubeRepository(
        new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
        new InMemoryRepository<TimestampedStore<SonarqubeComponentTreeMeasure[]>>(),
        historicalRepository
      );

      expect(
        await repository.loadAllHistoricalMeasureEntries({ measures: ['coverage'] })
      ).toEqual([
        { fetchedAt: '2024-01-01T00:00:00.000Z', data: [coverageMetric] },
        { fetchedAt: '2024-02-01T00:00:00.000Z', data: [coverageMetric] },
      ]);
    });
  });

  describe('normalizeList (via filter options)', () => {
    it('splits a single comma-separated string into trimmed, non-empty segments', async () => {
      const measurementRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentMeasure>
      >();
      const measure: SonarqubeComponentMeasure = {
        id: '1',
        key: 'project-a',
        name: 'Project A',
        measures: [
          { metric: 'coverage', value: '81.3', bestValue: false },
          { metric: 'bugs', value: '2', bestValue: true },
          { metric: 'code_smells', value: '5', bestValue: false },
        ],
      };
      await measurementRepository.save({
        entries: [{ fetchedAt: '2024-03-01T00:00:00.000Z', data: measure }],
      });

      const repository = new SonarqubeRepository(
        measurementRepository,
        new InMemoryRepository<TimestampedStore<SonarqubeComponentTreeMeasure[]>>()
      );

      expect(await repository.loadAll({ measures: 'coverage, bugs ,' })).toEqual({
        ...measure,
        measures: [
          { metric: 'coverage', value: '81.3', bestValue: false },
          { metric: 'bugs', value: '2', bestValue: true },
        ],
      });
    });

    it('splits an array of comma-separated strings into trimmed, non-empty segments', async () => {
      const measurementRepository = new InMemoryRepository<
        TimestampedStore<SonarqubeComponentMeasure>
      >();
      const measure: SonarqubeComponentMeasure = {
        id: '1',
        key: 'project-a',
        name: 'Project A',
        measures: [
          { metric: 'coverage', value: '81.3', bestValue: false },
          { metric: 'bugs', value: '2', bestValue: true },
          { metric: 'code_smells', value: '5', bestValue: false },
        ],
      };
      await measurementRepository.save({
        entries: [{ fetchedAt: '2024-03-01T00:00:00.000Z', data: measure }],
      });

      const repository = new SonarqubeRepository(
        measurementRepository,
        new InMemoryRepository<TimestampedStore<SonarqubeComponentTreeMeasure[]>>()
      );

      expect(await repository.loadAll({ measures: ['coverage, bugs', 'code_smells'] })).toEqual(
        measure
      );
    });
  });

  it('loads coverage history from timestamped historical measures', async () => {
    const historicalRepository = new InMemoryRepository<TimestampedStore<CodeMetric[]>>();
    await historicalRepository.save({
      entries: [
        {
          fetchedAt: '2024-03-01T00:00:00.000Z',
          data: [
            {
              key: 'coverage_2024-01-01T00:00:00+0000',
              name: 'coverage on 2024-01-01T00:00:00+0000',
              metric: 'coverage',
              value: '81.3',
              formatter: 'PERCENT',
              timestamp: '2024-01-01T00:00:00+0000',
            },
            {
              key: 'sqale_rating_2024-01-01T00:00:00+0000',
              name: 'sqale_rating on 2024-01-01T00:00:00+0000',
              metric: 'sqale_rating',
              value: '1.0',
              formatter: 'NUMBER',
              timestamp: '2024-01-01T00:00:00+0000',
            },
          ],
        },
      ],
    });

    const repository = new SonarqubeRepository(
      new InMemoryRepository<TimestampedStore<SonarqubeComponentMeasure>>(),
      new InMemoryRepository<TimestampedStore<SonarqubeComponentTreeMeasure[]>>(),
      historicalRepository
    );

    expect(await repository.loadCoverageHistory()).toEqual([
      {
        key: 'coverage_2024-01-01T00:00:00+0000',
        name: 'coverage on 2024-01-01T00:00:00+0000',
        metric: 'coverage',
        value: '81.3',
        formatter: 'PERCENT',
        timestamp: '2024-01-01T00:00:00+0000',
      },
    ]);
  });
});
