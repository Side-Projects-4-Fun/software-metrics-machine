export type DashboardSection =
  | 'insights'
  | 'pipelines'
  | 'change-requests'
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
  if (pathname.includes('/change-requests')) {return 'change-requests';}
  if (pathname.includes('/source-code')) {return 'source-code';}
  if (pathname.includes('/engineering-health')) {return 'engineering-health';}
  if (pathname.includes('/architecture')) {return 'architecture';}
  if (pathname.includes('/sonarqube')) {return 'sonarqube';}
  return 'insights';
}

export function dashboardPathForSection(section: DashboardSection): string {
  if (section === 'engineering-health') {
    return '/engineering-health';
  }
  return `/dashboard/${section}`;
}
