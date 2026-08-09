import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { FilterResolver } from '../filter-resolver';
import { TestConfigurationBuilder } from '../../../test/domain/configuration-builder';
import { defaultFilters, type DashboardFilters } from '../saved-filter-entry';

describe('FilterResolver', () => {
  let tempDir: string;
  let resolver: FilterResolver;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'smm-filter-resolver-'));
    resolver = new FilterResolver();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function buildConfig(): ReturnType<TestConfigurationBuilder['build']> {
    return new TestConfigurationBuilder()
      .withGetPathFromGitProvider(tempDir)
      .withExtra('getBaseDirectory', (): string => tempDir)
      .build();
  }

  describe('saveFilter / showFilter / listFilters / deleteFilter', () => {
    it('persists a saved filter and retrieves it by name', async () => {
      const config = buildConfig();
      const filters: DashboardFilters = { ...defaultFilters, startDate: '2025-01-01' };

      const saved = await resolver.saveFilter(config, 'pipelines', 'CI Main', filters);
      const retrieved = await resolver.showFilter(config, 'CI Main');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(saved.id);
      expect(retrieved?.section).toBe('pipelines');
      expect(retrieved?.filters.startDate).toBe('2025-01-01');
    });

    it('lists filters optionally scoped to a section', async () => {
      const config = buildConfig();
      const filters: DashboardFilters = { ...defaultFilters, startDate: '2025-02-01' };

      await resolver.saveFilter(config, 'pipelines', 'CI Main', filters);
      await resolver.saveFilter(config, 'change-requests', 'Open change requests', filters);

      const all = await resolver.listFilters(config);
      expect(all).toHaveLength(2);

      const pipelinesOnly = await resolver.listFilters(config, 'pipelines');
      expect(pipelinesOnly).toHaveLength(1);
      expect(pipelinesOnly[0].name).toBe('CI Main');
    });

    it('deletes a filter by name and returns true', async () => {
      const config = buildConfig();
      const filters: DashboardFilters = { ...defaultFilters };

      await resolver.saveFilter(config, 'pipelines', 'CI Main', filters);
      const deleted = await resolver.deleteFilter(config, 'CI Main');

      expect(deleted).toBe(true);
      expect(await resolver.showFilter(config, 'CI Main')).toBeNull();
    });

    it('returns false when deleting a filter that does not exist', async () => {
      const config = buildConfig();
      const deleted = await resolver.deleteFilter(config, 'nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('resolveSavedFilterOptions', () => {
    it('returns the explicit options unchanged when no filter name is given', async () => {
      const config = buildConfig();
      const explicitOptions = { startDate: '2025-03-01' };

      const merged = await resolver.resolveSavedFilterOptions(config, 'pipelines', explicitOptions);

      expect(merged).toEqual({ startDate: '2025-03-01' });
    });

    it('returns the explicit options unchanged when the named filter does not exist', async () => {
      const config = buildConfig();
      const explicitOptions = { filter: 'missing', startDate: '2025-03-01' };

      const merged = await resolver.resolveSavedFilterOptions(config, 'pipelines', explicitOptions);

      expect(merged).toEqual({ filter: 'missing', startDate: '2025-03-01' });
    });

    it('returns the explicit options unchanged when the named filter belongs to a different section', async () => {
      const config = buildConfig();
      const filters: DashboardFilters = { ...defaultFilters, branch: ['main'] };

      await resolver.saveFilter(config, 'pipelines', 'CI Main', filters);

      const merged = await resolver.resolveSavedFilterOptions(config, 'change-requests', {
        filter: 'CI Main',
        startDate: '2025-03-01',
      });

      expect(merged).toEqual({ filter: 'CI Main', startDate: '2025-03-01' });
    });

    it('fills in missing keys from the stored filter while keeping explicitly provided values', async () => {
      const config = buildConfig();
      const storedFilters: DashboardFilters = {
        ...defaultFilters,
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        branch: ['main', 'develop'],
        workflowSelector: 'deploy.yml',
      };

      await resolver.saveFilter(config, 'pipelines', 'CI Main', storedFilters);

      const merged = await resolver.resolveSavedFilterOptions(config, 'pipelines', {
        filter: 'CI Main',
        startDate: '2025-06-01',
      });

      expect(merged.startDate).toBe('2025-06-01');
      expect(merged.endDate).toBe('2025-01-31');
      expect(merged.branch).toEqual(['main', 'develop']);
      expect(merged.workflowSelector).toBe('deploy.yml');
    });

    it('treats an empty array as not-provided and fills it from the stored filter', async () => {
      const config = buildConfig();
      const storedFilters: DashboardFilters = {
        ...defaultFilters,
        branch: ['main', 'develop'],
      };

      await resolver.saveFilter(config, 'pipelines', 'CI Main', storedFilters);

      const merged = await resolver.resolveSavedFilterOptions(config, 'pipelines', {
        filter: 'CI Main',
        branch: [],
      });

      expect(merged.branch).toEqual(['main', 'develop']);
    });

    it('keeps an explicitly provided non-empty array over the stored value', async () => {
      const config = buildConfig();
      const storedFilters: DashboardFilters = {
        ...defaultFilters,
        branch: ['main', 'develop'],
      };

      await resolver.saveFilter(config, 'pipelines', 'CI Main', storedFilters);

      const merged = await resolver.resolveSavedFilterOptions(config, 'pipelines', {
        filter: 'CI Main',
        branch: ['feature/x'],
      });

      expect(merged.branch).toEqual(['feature/x']);
    });
  });
});
