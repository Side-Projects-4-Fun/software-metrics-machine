'use client';

import { fetchAPI, fetchPutAPI } from '@/server/api';
import type { SavedFilterEntry, DashboardSection } from './saved-filters-store';
import type { DashboardFilters } from './DashboardFilters';
import type { ReportEntry, ReportSectionRef, ReportDateWindow } from '@/components/reports/reports-store';

type SavedFiltersDocument = {
  version: 1;
  filters: SavedFilterEntry[];
  reports?: ReportEntry[];
};

async function readDocument(): Promise<SavedFiltersDocument> {
  try {
    const data = await fetchAPI<SavedFiltersDocument>('/filters');
    if (data && data.version === 1 && Array.isArray(data.filters)) {
      return {
        version: 1,
        filters: data.filters,
        reports: Array.isArray(data.reports) ? data.reports : [],
      };
    }
  } catch {
    // fall through
  }
  return { version: 1, filters: [], reports: [] };
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
    id: `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
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

export async function getReports(repository?: string): Promise<ReportEntry[]> {
  const doc = await readDocument();
  const reports = doc.reports ?? [];
  if (!repository) {
    return reports;
  }
  return reports
    .filter((r) => r.repository === repository)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveReport(
  name: string,
  sections: ReportSectionRef[],
  repository: string,
  startDateOverride?: string,
  endDateOverride?: string,
  dateWindows?: ReportDateWindow[],
): Promise<ReportEntry> {
  const normalizedName = name.trim();
  if (!normalizedName) { throw new Error('Sprint report name is required.'); }

  const doc = await readDocument();
  const reports = doc.reports ?? [];
  const existingNames = reports
    .filter((r) => r.repository === repository)
    .map((r) => r.name);

  let finalName = normalizedName;
  if (existingNames.includes(finalName)) {
    let suffix = 2;
    while (existingNames.includes(`${normalizedName} (${suffix})`)) { suffix += 1; }
    finalName = `${normalizedName} (${suffix})`;
  }

  const entry: ReportEntry = {
    id: `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    name: finalName,
    repository,
    sections,
    startDateOverride,
    endDateOverride,
    dateWindows: dateWindows && dateWindows.length > 0 ? dateWindows : undefined,
    createdAt: new Date().toISOString(),
  };

  doc.reports = [entry, ...reports];
  await writeDocument(doc);
  return entry;
}

export async function updateReport(
  id: string,
  name: string,
  sections: ReportSectionRef[],
  repository: string,
  startDateOverride?: string,
  endDateOverride?: string,
  dateWindows?: ReportDateWindow[],
): Promise<ReportEntry> {
  const normalizedName = name.trim();
  if (!normalizedName) { throw new Error('Sprint report name is required.'); }

  const doc = await readDocument();
  const reports = doc.reports ?? [];
  const existing = reports.find((r) => r.id === id);
  if (!existing) { throw new Error('Report not found.'); }

  existing.name = normalizedName;
  existing.sections = sections;
  existing.startDateOverride = startDateOverride;
  existing.endDateOverride = endDateOverride;
  existing.dateWindows = dateWindows && dateWindows.length > 0 ? dateWindows : undefined;

  await writeDocument(doc);
  return existing;
}

export async function removeReport(id: string): Promise<void> {
  const doc = await readDocument();
  const reports = doc.reports ?? [];
  doc.reports = reports.filter((r) => r.id !== id);
  await writeDocument(doc);
}
