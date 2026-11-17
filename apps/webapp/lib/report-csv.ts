import { stringify } from 'csv-stringify/sync';
import type { SavedFilterEntry } from '@/components/filters/saved-filters-store';
import type { ResolvedReport } from '@/app/reports/shared';
import {
  EVALUATABLE_SECTION_LABELS,
  type ReportDateWindow,
} from '@/components/reports/reports-store';

export const REPORT_CSV_HEADERS = [
  'time_frame',
  'section',
  'filter',
  'kind',
  'signal',
  'signal_description',
  'severity',
  'category',
  'metric',
  'value',
] as const;

interface EvaluationSignal {
  title?: string;
  description?: string;
  severity?: string;
  category?: string;
  metrics?: Array<{ label?: string; value?: unknown }>;
}

interface EvaluationData {
  signals?: EvaluationSignal[];
  summary?: Record<string, unknown>;
}

function isEvaluationData(value: unknown): value is EvaluationData {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.signals) &&
    typeof candidate.summary === 'object' &&
    candidate.summary !== null
  );
}

function windowLabel(window: ReportDateWindow | null): string {
  if (!window) {
    return '';
  }

  if (window.label) {
    return window.label;
  }

  return [window.startDate, window.endDate].filter(Boolean).join(' – ');
}

function toCell(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

export function buildReportCsv(
  resolved: ResolvedReport,
  savedFiltersMap: Map<string, SavedFilterEntry>
): string {
  const rows: string[][] = [[...REPORT_CSV_HEADERS]];

  for (const window of resolved.windows) {
    const frame = windowLabel(window.window);

    for (const ref of resolved.report.sections) {
      const sectionKey = `${ref.section}-${ref.savedFilterId}`;
      const sectionLabel = EVALUATABLE_SECTION_LABELS[ref.section];
      const filterName = savedFiltersMap.get(ref.savedFilterId)?.name ?? ref.savedFilterId;
      const error = window.errors[sectionKey];

      if (error) {
        rows.push([frame, sectionLabel, filterName, 'error', '', '', '', '', 'error', error]);
        continue;
      }

      const data = window.evaluations[sectionKey];
      if (!isEvaluationData(data)) {
        continue;
      }

      for (const [metric, value] of Object.entries(data.summary ?? {})) {
        rows.push([
          frame,
          sectionLabel,
          filterName,
          'summary',
          '',
          '',
          '',
          '',
          metric,
          toCell(value),
        ]);
      }

      for (const signal of data.signals ?? []) {
        const metrics = signal.metrics ?? [];

        if (metrics.length === 0) {
          rows.push([
            frame,
            sectionLabel,
            filterName,
            'signal',
            signal.title ?? '',
            signal.description ?? '',
            signal.severity ?? '',
            signal.category ?? '',
            '',
            '',
          ]);
          continue;
        }

        for (const metric of metrics) {
          rows.push([
            frame,
            sectionLabel,
            filterName,
            'signal',
            signal.title ?? '',
            signal.description ?? '',
            signal.severity ?? '',
            signal.category ?? '',
            metric.label ?? '',
            toCell(metric.value),
          ]);
        }
      }
    }
  }

  return stringify(rows);
}

export function reportCsvFileName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${slug || 'report'}.csv`;
}

export function downloadReportCsv(
  resolved: ResolvedReport,
  savedFiltersMap: Map<string, SavedFilterEntry>
): void {
  const csv = buildReportCsv(resolved, savedFiltersMap);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', reportCsvFileName(resolved.report.name));
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
