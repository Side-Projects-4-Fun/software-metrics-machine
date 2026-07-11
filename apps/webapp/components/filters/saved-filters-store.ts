import { DashboardFilters } from './DashboardFilters';

export type DashboardSection =
  | 'insights'
  | 'pipelines'
  | 'pull-requests'
  | 'source-code'
  | 'architecture'
  | 'sonarqube';

export type SavedFilterEntry = {
  id: string;
  name: string;
  section: DashboardSection;
  pathname: string;
  filters: DashboardFilters;
  repository: string;
  createdAt: string;
};

type SavedFiltersDocument = {
  version: 1;
  filters: SavedFilterEntry[];
};

export interface SavedFiltersStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export class LocalStorageSavedFiltersAdapter implements SavedFiltersStorageAdapter {
  async getItem(key: string): Promise<string | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    return window.localStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(key, value);
  }
}

function cloneFilters(filters: DashboardFilters): DashboardFilters {
  return JSON.parse(JSON.stringify(filters)) as DashboardFilters;
}

function defaultDocument(): SavedFiltersDocument {
  return {
    version: 1,
    filters: [],
  };
}

function parseSavedFiltersDocument(raw: string | null): SavedFiltersDocument {
  if (!raw) {
    return defaultDocument();
  }

  try {
    const parsed = JSON.parse(raw) as SavedFiltersDocument;
    if (parsed.version !== 1 || !Array.isArray(parsed.filters)) {
      return defaultDocument();
    }

    return {
      version: 1,
      filters: parsed.filters,
    };
  } catch {
    return defaultDocument();
  }
}

function serializeSavedFiltersDocument(document: SavedFiltersDocument): string {
  return JSON.stringify(document);
}

function normalizeName(name: string): string {
  return name.trim();
}

function nextAvailableName(existingNames: string[], preferredName: string): string {
  const normalizedPreferredName = normalizeName(preferredName);
  if (!existingNames.includes(normalizedPreferredName)) {
    return normalizedPreferredName;
  }

  let suffix = 2;
  while (existingNames.includes(`${normalizedPreferredName} (${suffix})`)) {
    suffix += 1;
  }

  return `${normalizedPreferredName} (${suffix})`;
}

export function dashboardSectionFromPathname(pathname: string): DashboardSection {
  if (pathname.includes('/pipelines')) {
    return 'pipelines';
  }

  if (pathname.includes('/pull-requests')) {
    return 'pull-requests';
  }

  if (pathname.includes('/source-code')) {
    return 'source-code';
  }

  if (pathname.includes('/architecture')) {
    return 'architecture';
  }

  if (pathname.includes('/sonarqube')) {
    return 'sonarqube';
  }

  return 'insights';
}

export function dashboardPathForSection(section: DashboardSection): string {
  return `/dashboard/${section}`;
}

export class SavedFiltersStore {
  private readonly adapter: SavedFiltersStorageAdapter;

  private readonly key: string;

  constructor(
    adapter: SavedFiltersStorageAdapter = new LocalStorageSavedFiltersAdapter(),
    key = 'smm.saved-filters',
  ) {
    this.adapter = adapter;
    this.key = key;
  }

  private async readDocument(): Promise<SavedFiltersDocument> {
    const raw = await this.adapter.getItem(this.key);
    return parseSavedFiltersDocument(raw);
  }

  private async writeDocument(document: SavedFiltersDocument): Promise<void> {
    await this.adapter.setItem(this.key, serializeSavedFiltersDocument(document));
  }

  async getAll(): Promise<SavedFilterEntry[]> {
    const document = await this.readDocument();
    return [...document.filters];
  }

  async getBySection(section: DashboardSection, repository?: string): Promise<SavedFilterEntry[]> {
    const all = await this.getAll();
    return all
      .filter((entry) => entry.section === section && (!repository || entry.repository === repository))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async save(section: DashboardSection, pathname: string, name: string, filters: DashboardFilters, repository: string = ''): Promise<SavedFilterEntry> {
    const normalizedName = normalizeName(name);
    if (!normalizedName) {
      throw new Error('Filter name is required.');
    }

    const document = await this.readDocument();
    const existingNames = document.filters
      .filter((entry) => entry.section === section && entry.repository === repository)
      .map((entry) => entry.name);

    const finalName = nextAvailableName(existingNames, normalizedName);
    const now = new Date().toISOString();
    const entry: SavedFilterEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      name: finalName,
      section,
      pathname,
      filters: cloneFilters(filters),
      repository,
      createdAt: now,
    };

    document.filters = [entry, ...document.filters];
    await this.writeDocument(document);
    return entry;
  }

  async update(id: string, filters: DashboardFilters): Promise<SavedFilterEntry> {
    const document = await this.readDocument();
    const existingEntryIndex = document.filters.findIndex((entry) => entry.id === id);

    if (existingEntryIndex === -1) {
      throw new Error('Saved filter not found.');
    }

    const existingEntry = document.filters[existingEntryIndex] as SavedFilterEntry;
    const updatedEntry: SavedFilterEntry = {
      ...existingEntry,
      filters: cloneFilters(filters),
    };

    document.filters[existingEntryIndex] = updatedEntry;
    await this.writeDocument(document);

    return updatedEntry;
  }

  async remove(id: string): Promise<void> {
    const document = await this.readDocument();
    document.filters = document.filters.filter((entry) => entry.id !== id);
    await this.writeDocument(document);
  }
}