import {
  type DashboardFilters,
  serializeDashboardFilters,
} from '@/components/filters/DashboardFilters';
import { dashboardPathForSection } from '@/components/filters/saved-filters-store';
import type { EvaluatableSection } from '@/components/reports/reports-store';

export function buildDashboardLink(section: EvaluatableSection, filters: DashboardFilters): string {
  const path = dashboardPathForSection(section);
  const params = serializeDashboardFilters(filters);
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}
