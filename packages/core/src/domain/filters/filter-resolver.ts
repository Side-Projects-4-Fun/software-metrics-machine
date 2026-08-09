import type { DashboardFilters, DashboardSection, SavedFilterEntry } from './saved-filter-entry';
import { SavedFiltersStore, FileSystemSavedFiltersAdapter } from './index';
import { RepositoryFactory } from '../../infrastructure/index';
import type { Configuration } from '../../infrastructure/configuration';

export class FilterResolver {
  private createFiltersStore(config: Configuration): SavedFiltersStore {
    const baseDir = RepositoryFactory.resolveBaseDirectory(config);
    const adapter = new FileSystemSavedFiltersAdapter(baseDir);
    return new SavedFiltersStore(adapter);
  }

  async listFilters(
    config: Configuration,
    section?: DashboardSection
  ): Promise<SavedFilterEntry[]> {
    const store = this.createFiltersStore(config);
    if (section) {
      return store.getBySection(section);
    }
    return store.getAll();
  }

  async saveFilter(
    config: Configuration,
    section: DashboardSection,
    name: string,
    filters: DashboardFilters,
    repository?: string
  ): Promise<SavedFilterEntry> {
    const store = this.createFiltersStore(config);
    return store.save(section, undefined, name, filters, repository ?? '');
  }

  async showFilter(config: Configuration, nameOrId: string): Promise<SavedFilterEntry | null> {
    const store = this.createFiltersStore(config);
    const all = await store.getAll();
    return all.find((e) => e.name === nameOrId || e.id === nameOrId) ?? null;
  }

  async deleteFilter(config: Configuration, nameOrId: string): Promise<boolean> {
    const store = this.createFiltersStore(config);
    const all = await store.getAll();
    const entry = all.find((e) => e.name === nameOrId || e.id === nameOrId);
    if (!entry) {
      return false;
    }
    await store.remove(entry.id);
    return true;
  }

  async resolveSavedFilterOptions(
    config: Configuration,
    section: DashboardSection,
    explicitOptions: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const filterName = explicitOptions.filter as string | undefined;
    if (!filterName) {
      return { ...explicitOptions };
    }

    const entry = await this.showFilter(config, filterName);
    if (!entry || entry.section !== section) {
      return { ...explicitOptions };
    }

    const merged = { ...explicitOptions };
    const relevantKeys = this.getSectionFilterKeys()[section];

    for (const key of relevantKeys) {
      const cliValue = explicitOptions[key];
      if (this.isExplicitlyProvided(cliValue)) {
        continue;
      }

      const storedValue = entry.filters[key];
      if (this.isExplicitlyProvided(storedValue)) {
        merged[key] = storedValue;
      }
    }

    return merged;
  }

  private getSectionFilterKeys(): Record<DashboardSection, (keyof DashboardFilters)[]> {
    return {
      pipelines: [
        'startDate',
        'endDate',
        'workflowSelector',
        'jobSelector',
        'branch',
        'rawFilters',
        'weekends',
        'outlierMode',
      ],
      'change-requests': [
        'startDate',
        'endDate',
        'authorSelect',
        'excludeAuthorSelect',
        'excludeCommenterSelect',
        'labelSelector',
        'changeRequestStatus',
        'aggregateBy',
        'rawFilters',
        'weekends',
        'outlierMode',
      ],
      'source-code': [
        'startDate',
        'endDate',
        'authorSelectSourceCode',
        'ignorePatternFiles',
        'includePatternFiles',
        'topEntries',
        'typeChurn',
      ],
      'engineering-health': [
        'startDate',
        'endDate',
        'metric',
        'category',
        'compareStartDate',
        'compareEndDate',
        'rawFilters',
        'period',
      ],
      architecture: ['startDate', 'endDate'],
      sonarqube: ['startDate', 'endDate', 'sonarqubeRemoveFolders'],
      insights: ['startDate', 'endDate'],
    };
  }

  private isExplicitlyProvided(value: unknown): boolean {
    if (value === undefined || value === null) {
      return false;
    }

    if (typeof value === 'string' && value === '') {
      return false;
    }

    if (Array.isArray(value) && value.length === 0) {
      return false;
    }

    return true;
  }
}
