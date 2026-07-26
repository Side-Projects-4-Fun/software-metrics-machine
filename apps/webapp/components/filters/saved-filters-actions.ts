'use client';

import { fetchAPI, fetchPutAPI } from '@/server/api';
import type { SavedFilterEntry } from './saved-filters-store';
import type { DashboardSection } from './saved-filters-store';
import type { DashboardFilters } from './DashboardFilters';

type SavedFiltersDocument = {
  version: 1;
  filters: SavedFilterEntry[];
};

async function readDocument(): Promise<SavedFiltersDocument> {
  try {
    const data = await fetchAPI<SavedFiltersDocument>('/filters');
    if (data && data.version === 1 && Array.isArray(data.filters)) {
      return data;
    }
  } catch {
    // fall through
  }
  return { version: 1, filters: [] };
}

async function writeDocument(document: SavedFiltersDocument): Promise<void> {
  await fetchPutAPI<SavedFiltersDocument>('/filters', document);
}

export async function getSavedFilters(): Promise<SavedFilterEntry[]> {
  const doc = await readDocument();
  return doc.filters;
}

export async function getSavedFiltersBySection(
  section: DashboardSection,
  repository?: string,
): Promise<SavedFilterEntry[]> {
  const doc = await readDocument();
  return doc.filters
    .filter((e) => e.section === section && (!repository || e.repository === repository))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveSavedFilter(
  section: DashboardSection,
  pathname: string,
  name: string,
  filters: DashboardFilters,
  repository: string,
): Promise<SavedFilterEntry> {
  const normalizedName = name.trim();
  if (!normalizedName) {throw new Error('Filter name is required.');}

  const doc = await readDocument();
  const existingNames = doc.filters
    .filter((e) => e.section === section && e.repository === repository)
    .map((e) => e.name);

  let finalName = normalizedName;
  if (existingNames.includes(finalName)) {
    let suffix = 2;
    while (existingNames.includes(`${normalizedName} (${suffix})`)) {suffix += 1;}
    finalName = `${normalizedName} (${suffix})`;
  }

  const entry: SavedFilterEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    name: finalName,
    section,
    pathname,
    filters: JSON.parse(JSON.stringify(filters)) as DashboardFilters,
    repository,
    createdAt: new Date().toISOString(),
  };

  doc.filters = [entry, ...doc.filters];
  await writeDocument(doc);
  return entry;
}

export async function removeSavedFilter(id: string): Promise<void> {
  const doc = await readDocument();
  doc.filters = doc.filters.filter((e) => e.id !== id);
  await writeDocument(doc);
}
