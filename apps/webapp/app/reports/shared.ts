import { fetchAPI } from '@/server/api/client';
import { pipelineAPI } from '@/server/api/pipeline';
import { pullRequestAPI } from '@/server/api/pullRequest';
import { sourceCodeAPI } from '@/server/api/sourceCode';
import { architectureAPI } from '@/server/api/architecture';
import { sonarqubeAPI } from '@/server/api/sonarqube';
import {
  buildPipelineApiParams,
  buildPullRequestApiParams,
  buildSourceCodeApiParams,
  buildSonarqubeApiParams,
} from '@/server/utils/apiParams';
import type { DashboardFilters } from '@/server/utils/apiParams';
import type { SavedFilterEntry } from '@/components/filters/saved-filters-store';
import type {
  ReportEntry,
  EvaluatableSection,
  ReportSectionRef,
  ReportDateWindow,
} from '@/components/reports/reports-store';

export type SavedFiltersDocument = {
  version: 1;
  filters: SavedFilterEntry[];
  reports?: ReportEntry[];
};

export async function fetchSavedFiltersDocument(): Promise<SavedFiltersDocument> {
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

function buildEvaluateParams(
  section: EvaluatableSection,
  filters: DashboardFilters,
): Record<string, string | number | undefined> {
  switch (section) {
    case 'pipelines':
      return buildPipelineApiParams(filters);
    case 'pull-requests':
      return buildPullRequestApiParams(filters);
    case 'source-code':
      return buildSourceCodeApiParams(filters);
    case 'sonarqube':
      return buildSonarqubeApiParams(filters);
    case 'architecture':
      return {
        ignore_files: filters.ignorePatternFiles || undefined,
        include_only: filters.includePatternFiles || undefined,
      };
  }
}

async function evaluateSection(
  section: EvaluatableSection,
  filters: DashboardFilters,
): Promise<unknown> {
  const params = buildEvaluateParams(section, filters);

  switch (section) {
    case 'pipelines':
      return pipelineAPI.evaluate(params);
    case 'pull-requests':
      return pullRequestAPI.evaluate(params);
    case 'source-code':
      return sourceCodeAPI.evaluate(params);
    case 'architecture':
      return architectureAPI.evaluate(params as { ignore_files?: string; include_only?: string });
    case 'sonarqube':
      return sonarqubeAPI.evaluate(params);
  }
}

export interface ResolvedReportWindow {
  window: ReportDateWindow | null;
  evaluations: Partial<Record<EvaluatableSection, unknown>>;
  errors: Partial<Record<EvaluatableSection, string>>;
}

export interface ResolvedReport {
  report: ReportEntry;
  windows: ResolvedReportWindow[];
}

/**
 * Returns the date windows to evaluate for a report.
 * If dateWindows is set, use it. Otherwise, use a single window
 * from startDateOverride/endDateOverride (or null if none).
 */
function getEffectiveWindows(report: ReportEntry): (ReportDateWindow | null)[] {
  if (report.dateWindows && report.dateWindows.length > 0) {
    return report.dateWindows;
  }
  if (report.startDateOverride || report.endDateOverride) {
    return [{ startDate: report.startDateOverride ?? '', endDate: report.endDateOverride ?? '' }];
  }
  return [null];
}

async function resolveWindow(
  report: ReportEntry,
  savedFiltersById: Map<string, SavedFilterEntry>,
  window: ReportDateWindow | null,
): Promise<Omit<ResolvedReportWindow, 'window'> & { window: ReportDateWindow | null }> {
  const evaluations: Partial<Record<EvaluatableSection, unknown>> = {};
  const errors: Partial<Record<EvaluatableSection, string>> = {};

  await Promise.all(
    report.sections.map(async (ref: ReportSectionRef) => {
      const saved = savedFiltersById.get(ref.savedFilterId);
      if (!saved) {
        errors[ref.section] = 'Referenced saved filter not found.';
        return;
      }

      const mergedFilters = { ...saved.filters };
      if (window) {
        if (window.startDate) {
          mergedFilters.startDate = window.startDate;
        }
        if (window.endDate) {
          mergedFilters.endDate = window.endDate;
        }
      } else {
        if (report.startDateOverride) {
          mergedFilters.startDate = report.startDateOverride;
        }
        if (report.endDateOverride) {
          mergedFilters.endDate = report.endDateOverride;
        }
      }

      try {
        const data = await evaluateSection(ref.section, mergedFilters);
        evaluations[ref.section] = data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Evaluation failed.';
        errors[ref.section] = message;
      }
    }),
  );

  return { window, evaluations, errors };
}

export async function resolveReport(
  report: ReportEntry,
  savedFiltersById: Map<string, SavedFilterEntry>,
): Promise<ResolvedReport> {
  const windows = getEffectiveWindows(report);
  const resolvedWindows = await Promise.all(
    windows.map((w) => resolveWindow(report, savedFiltersById, w)),
  );

  return { report, windows: resolvedWindows };
}

export async function resolveReports(
  reports: ReportEntry[],
  savedFilters: SavedFilterEntry[],
): Promise<ResolvedReport[]> {
  const savedFiltersById = new Map(savedFilters.map((f) => [f.id, f]));

  return Promise.all(
    reports.map((report) => resolveReport(report, savedFiltersById)),
  );
}
