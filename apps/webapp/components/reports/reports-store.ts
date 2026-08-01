import type { SavedFilterEntry } from '@/components/filters/saved-filters-store';

export type EvaluatableSection = 'pipelines' | 'pull-requests' | 'source-code' | 'architecture' | 'sonarqube';

export const EVALUATABLE_SECTIONS: EvaluatableSection[] = [
  'pipelines',
  'pull-requests',
  'source-code',
  'architecture',
  'sonarqube',
];

export const EVALUATABLE_SECTION_LABELS: Record<EvaluatableSection, string> = {
  pipelines: 'Pipelines',
  'pull-requests': 'Pull Requests',
  'source-code': 'Source Code',
  architecture: 'Architecture',
  sonarqube: 'SonarQube',
};

export interface ReportSectionRef {
  section: EvaluatableSection;
  savedFilterId: string;
}

export interface ReportDateWindow {
  startDate: string;
  endDate: string;
  label?: string;
}

export interface ReportEntry {
  id: string;
  name: string;
  repository: string;
  sections: ReportSectionRef[];
  startDateOverride?: string;
  endDateOverride?: string;
  dateWindows?: ReportDateWindow[];
  createdAt: string;
}

export interface ReportsDocument {
  version: 1;
  filters: SavedFilterEntry[];
  reports?: ReportEntry[];
}

export const defaultReportName = (): string =>
  `Sprint Report ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
