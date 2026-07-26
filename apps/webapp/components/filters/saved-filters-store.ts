export type DashboardSection =
  | 'insights'
  | 'pipelines'
  | 'pull-requests'
  | 'source-code'
  | 'engineering-health'
  | 'architecture'
  | 'sonarqube';

export interface SavedFilterEntry {
  id: string;
  name: string;
  section: DashboardSection;
  pathname?: string;
  filters: import('./DashboardFilters').DashboardFilters;
  repository: string;
  createdAt: string;
}

export function dashboardSectionFromPathname(pathname: string): DashboardSection {
  if (pathname.includes('/pipelines')) {return 'pipelines';}
  if (pathname.includes('/pull-requests')) {return 'pull-requests';}
  if (pathname.includes('/source-code')) {return 'source-code';}
  if (pathname.includes('/engineering-health')) {return 'engineering-health';}
  if (pathname.includes('/architecture')) {return 'architecture';}
  if (pathname.includes('/sonarqube')) {return 'sonarqube';}
  return 'insights';
}

export function dashboardPathForSection(section: DashboardSection): string {
  return `/dashboard/${section}`;
}
