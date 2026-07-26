import type { SmmCommand } from '../commands/smm-command';
import type { DashboardFilters, DashboardSection, SavedFilterEntry } from '@smmachine/core';
import {
  SavedFiltersStore,
  FileSystemSavedFiltersAdapter,
  RepositoryFactory,
} from '@smmachine/core';

function createFiltersStore(command: SmmCommand): SavedFiltersStore {
  const config = command.getConfiguration();
  const baseDir = RepositoryFactory.resolveBaseDirectory(config);
  const adapter = new FileSystemSavedFiltersAdapter(baseDir);
  return new SavedFiltersStore(adapter);
}

export async function listFilters(
  command: SmmCommand,
  section?: DashboardSection
): Promise<SavedFilterEntry[]> {
  const store = createFiltersStore(command);
  if (section) {
    return store.getBySection(section);
  }
  return store.getAll();
}

export async function saveFilter(
  command: SmmCommand,
  section: DashboardSection,
  name: string,
  filters: DashboardFilters,
  repository?: string
): Promise<SavedFilterEntry> {
  const store = createFiltersStore(command);
  return store.save(section, undefined, name, filters, repository ?? '');
}

export async function showFilter(
  command: SmmCommand,
  nameOrId: string
): Promise<SavedFilterEntry | null> {
  const store = createFiltersStore(command);
  const all = await store.getAll();
  return all.find((e) => e.name === nameOrId || e.id === nameOrId) ?? null;
}

export async function deleteFilter(command: SmmCommand, nameOrId: string): Promise<boolean> {
  const store = createFiltersStore(command);
  const all = await store.getAll();
  const entry = all.find((e) => e.name === nameOrId || e.id === nameOrId);
  if (!entry) {
    return false;
  }
  await store.remove(entry.id);
  return true;
}

const SECTION_FILTER_KEYS: Record<DashboardSection, (keyof DashboardFilters)[]> = {
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
  'pull-requests': [
    'startDate',
    'endDate',
    'authorSelect',
    'excludeAuthorSelect',
    'excludeCommenterSelect',
    'labelSelector',
    'pullRequestStatus',
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

function isExplicitlyProvided(value: unknown): boolean {
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

export async function resolveSavedFilterOptions(
  command: SmmCommand,
  section: DashboardSection,
  explicitOptions: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const filterName = explicitOptions.filter as string | undefined;
  if (!filterName) {
    return { ...explicitOptions };
  }

  const entry = await showFilter(command, filterName);
  if (!entry || entry.section !== section) {
    return { ...explicitOptions };
  }

  const merged = { ...explicitOptions };
  const relevantKeys = SECTION_FILTER_KEYS[section];

  for (const key of relevantKeys) {
    // Commander.js normalizes --start-date to startDate, etc.
    const cliValue = explicitOptions[key];
    if (isExplicitlyProvided(cliValue)) {
      continue;
    }

    const storedValue = entry.filters[key];
    if (isExplicitlyProvided(storedValue)) {
      merged[key] = storedValue;
    }
  }

  return merged;
}
