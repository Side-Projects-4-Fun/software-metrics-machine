'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { serializeDashboardFilters } from '@/components/filters/DashboardFilters';
import {
  DashboardSection,
  SavedFilterEntry,
  SavedFiltersStore,
} from '@/components/filters/saved-filters-store';
import { useProjects } from '@/components/providers/ProjectsContext';

const sectionOrder: DashboardSection[] = [
  'insights',
  'pipelines',
  'pull-requests',
  'source-code',
  'engineering-health',
  'architecture',
  'sonarqube',
];

const sectionLabels: Record<DashboardSection, string> = {
  insights: 'Insights',
  pipelines: 'Pipelines',
  'pull-requests': 'Pull Requests',
  'source-code': 'Source Code',
  'engineering-health': 'Engineering Health',
  architecture: 'Architecture',
  sonarqube: 'SonarQube',
};

type SavedFiltersByProject = {
  repository: string;
  sections: Array<{
    section: DashboardSection;
    entries: SavedFilterEntry[];
  }>;
};

function repositoryLabel(repository: string): string {
  return repository.trim() || 'Default Project';
}

export default function SavedFiltersOverview() {
  const { selectProject } = useProjects();
  const savedFiltersStore = useMemo(() => new SavedFiltersStore(), []);
  const [savedFilters, setSavedFilters] = useState<SavedFilterEntry[]>([]);

  useEffect(() => {
    savedFiltersStore.getAll()
      .then((entries) => {
        setSavedFilters(entries);
      })
      .catch((error) => {
        console.warn('Unable to load saved filters overview', error);
      });
  }, [savedFiltersStore]);

  const savedFiltersByProject = useMemo<SavedFiltersByProject[]>(() => {
    const groupedByProject = new Map<string, SavedFilterEntry[]>();

    for (const entry of savedFilters) {
      const key = entry.repository;
      const currentEntries = groupedByProject.get(key) ?? [];
      currentEntries.push(entry);
      groupedByProject.set(key, currentEntries);
    }

    return [...groupedByProject.entries()]
      .sort(([leftRepository], [rightRepository]) => repositoryLabel(leftRepository).localeCompare(repositoryLabel(rightRepository)))
      .map(([repository, entries]) => {
        const sections = sectionOrder
          .map((section) => ({
            section,
            entries: entries
              .filter((entry) => entry.section === section)
              .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
          }))
          .filter((group) => group.entries.length > 0);

        return {
          repository,
          sections,
        };
      });
  }, [savedFilters]);

  if (savedFiltersByProject.length === 0) {
    return (
      <div className="rounded-2xl border border-white/70 bg-white/80 p-8 shadow-sm backdrop-blur">
        <div className="space-y-2 text-center">
          <h2 className="text-3xl font-bold text-gray-900">Saved Views</h2>
          <p className="text-gray-600">
            Save filters from any dashboard page and your shortcuts will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-2xl border border-white/70 bg-white/85 p-8 shadow-sm backdrop-blur">
      <div className="space-y-2 text-center">
        <h2 className="text-3xl font-bold text-gray-900">Saved Views</h2>
        <p className="text-gray-600">
          Jump directly to saved filters grouped by project and dashboard page.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {savedFiltersByProject.map((projectGroup) => (
          <div
            key={projectGroup.repository || 'default-project'}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-4 border-b border-slate-100 pb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Project
              </p>
              <h3 className="text-lg font-semibold text-slate-900">
                {repositoryLabel(projectGroup.repository)}
              </h3>
            </div>

            <div className="space-y-4">
              {projectGroup.sections.map((sectionGroup) => (
                <div key={sectionGroup.section} className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">
                    {sectionLabels[sectionGroup.section]}
                  </p>
                  <div className="space-y-2">
                    {sectionGroup.entries.map((entry) => {
                      const queryString = serializeDashboardFilters(entry.filters).toString();
                      const href = queryString ? `${entry.pathname}?${queryString}` : entry.pathname;

                      return (
                        <Link
                          key={entry.id}
                          href={href}
                          onClick={() => selectProject(entry.repository)}
                          className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <span className="font-medium">{entry.name}</span>
                          <span className="text-xs uppercase tracking-[0.14em] text-slate-400">
                            Open
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
