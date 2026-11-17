import {
  buildReportCsv,
  reportCsvFileName,
  REPORT_CSV_HEADERS,
} from '@/lib/report-csv';
import { ReportEntryBuilder, SavedFilterBuilder } from '../builders/builders';
import type { ResolvedReport } from '@/app/reports/shared';

const savedFiltersMap = new Map([
  [
    'f1',
    new SavedFilterBuilder()
      .withId('f1')
      .withName('CI Main')
      .withSection('pipelines')
      .build(),
  ],
]);

function buildResolved(
  windows: ResolvedReport['windows'],
  sections: Array<{ section: 'pipelines'; savedFilterId: string }> = [
    { section: 'pipelines', savedFilterId: 'f1' },
  ]
): ResolvedReport {
  return {
    report: new ReportEntryBuilder()
      .withId('r1')
      .withName('Sprint 42')
      .withSections(sections)
      .build(),
    windows,
  };
}

describe('buildReportCsv', () => {
  it('writes a header row with the expected columns', () => {
    const csv = buildReportCsv(buildResolved([]), savedFiltersMap);

    expect(csv).toBe(`${REPORT_CSV_HEADERS.join(',')}\n`);
  });

  it('serializes summary and signal rows for every time frame', () => {
    const resolved = buildResolved([
      {
        window: { startDate: '2026-06-01', endDate: '2026-06-07', label: 'Week 1' },
        evaluations: {
          'pipelines-f1': {
            generatedAt: '2026-06-01T00:00:00Z',
            signals: [
              {
                id: 'sig-1',
                title: 'Slow deploys',
                description: 'Deploys exceed the target',
                severity: 'warning',
                category: 'duration',
                metrics: [{ label: 'Duration', value: '12m' }],
              },
            ],
            summary: { totalRuns: 10, successRate: 90 },
          },
        },
        errors: {},
      },
      {
        window: { startDate: '2026-06-08', endDate: '2026-06-14', label: 'Week 2' },
        evaluations: {
          'pipelines-f1': {
            generatedAt: '2026-06-08T00:00:00Z',
            signals: [],
            summary: { totalRuns: 12, successRate: 95 },
          },
        },
        errors: {},
      },
    ]);

    const lines = buildReportCsv(resolved, savedFiltersMap).split('\n');

    expect(lines).toContain('Week 1,Pipelines,CI Main,summary,,,,,totalRuns,10');
    expect(lines).toContain('Week 1,Pipelines,CI Main,summary,,,,,successRate,90');
    expect(lines).toContain(
      'Week 1,Pipelines,CI Main,signal,Slow deploys,Deploys exceed the target,warning,duration,Duration,12m'
    );
    expect(lines).toContain('Week 2,Pipelines,CI Main,summary,,,,,totalRuns,12');
    expect(lines).toContain('Week 2,Pipelines,CI Main,summary,,,,,successRate,95');
  });

  it('emits an error row for a failed section', () => {
    const resolved = buildResolved([
      {
        window: { startDate: '2026-06-01', endDate: '2026-06-07', label: 'Week 1' },
        evaluations: {},
        errors: { 'pipelines-f1': 'Evaluation failed.' },
      },
    ]);

    const lines = buildReportCsv(resolved, savedFiltersMap).split('\n');

    expect(lines).toContain('Week 1,Pipelines,CI Main,error,,,,,error,Evaluation failed.');
  });

  it('escapes commas and quotes in values', () => {
    const resolved = buildResolved([
      {
        window: { startDate: '2026-06-01', endDate: '2026-06-07', label: 'Week 1' },
        evaluations: {
          'pipelines-f1': {
            generatedAt: '2026-06-01T00:00:00Z',
            signals: [
              {
                id: 'sig-1',
                title: 'Comma, "quoted" signal',
                description: 'Description',
                severity: 'good',
                category: 'throughput',
                metrics: [{ label: 'Value', value: 'a,b"c' }],
              },
            ],
            summary: {},
          },
        },
        errors: {},
      },
    ]);

    const lines = buildReportCsv(resolved, savedFiltersMap).split('\n');

    expect(lines).toContain(
      'Week 1,Pipelines,CI Main,signal,"Comma, ""quoted"" signal",Description,good,throughput,Value,"a,b""c"'
    );
  });

  it('uses the saved filter id when the filter is missing', () => {
    const resolved = buildResolved(
      [
        {
          window: null,
          evaluations: {
            'pipelines-missing': { generatedAt: '', signals: [], summary: { totalRuns: 3 } },
          },
          errors: {},
        },
      ],
      [{ section: 'pipelines', savedFilterId: 'missing' }]
    );

    const lines = buildReportCsv(resolved, savedFiltersMap).split('\n');

    expect(lines).toContain(',Pipelines,missing,summary,,,,,totalRuns,3');
  });
});

describe('reportCsvFileName', () => {
  it('slugifies the report name', () => {
    expect(reportCsvFileName('Sprint 42: Release')).toBe('sprint-42-release.csv');
  });

  it('falls back to report when the name is empty', () => {
    expect(reportCsvFileName('   ')).toBe('report.csv');
  });
});
