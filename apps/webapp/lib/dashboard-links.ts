import { type DashboardFilters, serializeDashboardFilters } from '@/components/filters/DashboardFilters';
import { dashboardPathForSection } from '@/components/filters/saved-filters-store';
import type { EvaluatableSection } from '@/components/reports/reports-store';

/**
 * Builds a dashboard URL for a report section, with the saved filter's 
 * parameters serialized as URL query params.
 *
 * @returns A URL like `/dashboard/pipelines?startDate=2026-01-01&endDate=2026-06-30`
 */
export function buildDashboardLink(
  section: EvaluatableSection,
  filters: DashboardFilters,
): string {
  const path = dashboardPathForSection(section);
  const params = serializeDashboardFilters(filters);
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}
