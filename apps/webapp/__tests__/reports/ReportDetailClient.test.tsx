import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReportDetailClient from '@/components/reports/ReportDetailClient';
import type { ResolvedReport } from '@/app/reports/shared';
import { ReportEntryBuilder, SavedFilterBuilder } from '../builders/builders';

jest.mock('@/components/charts/pipeline/PipelineEvaluationCard', () => ({
  __esModule: true,
  default: () => <div data-testid="pipeline-eval">Pipeline Eval</div>,
}));
jest.mock('@/components/charts/pull-requests/PREvaluationCard', () => ({
  __esModule: true,
  default: () => <div data-testid="pr-eval">PR Eval</div>,
}));
jest.mock('@/components/charts/source-code/CodeEvaluationCard', () => ({
  __esModule: true,
  default: () => <div data-testid="code-eval">Code Eval</div>,
}));
jest.mock('@/components/charts/architecture/ArchitectureEvaluationCard', () => ({
  __esModule: true,
  default: () => <div data-testid="arch-eval">Architecture Eval</div>,
}));
jest.mock('@/components/charts/sonarqube/SonarqubeEvaluationCard', () => ({
  __esModule: true,
  default: () => <div data-testid="sonar-eval">SonarQube Eval</div>,
}));

function buildResolved(overrides: Partial<ResolvedReport> = {}): ResolvedReport {
  return {
    report: new ReportEntryBuilder().withId('r1').withName('Report 42').build(),
    windows: [
      {
        window: { startDate: '2026-06-01', endDate: '2026-06-07', label: 'Week 1' },
        evaluations: {},
        errors: {},
      },
      {
        window: { startDate: '2026-06-08', endDate: '2026-06-14', label: 'Week 2' },
        evaluations: {},
        errors: {},
      },
    ],
    ...overrides,
  };
}

describe('ReportDetailClient', () => {
  it('renders the report name', () => {
    render(
      <ReportDetailClient
        resolved={buildResolved()}
        savedFiltersMap={new Map()}
      />,
    );

    expect(screen.getByText('Report 42')).toBeVisible();
  });

  it('renders timeline when multiple windows exist', () => {
    render(
      <ReportDetailClient
        resolved={buildResolved()}
        savedFiltersMap={new Map()}
      />,
    );

    expect(screen.getByText('Week 1')).toBeVisible();
    expect(screen.getByText('Week 2')).toBeVisible();
  });

  it('does not render timeline for single-window reports', () => {
    const single = buildResolved();
    single.windows = single.windows.slice(0, 1);

    render(
      <ReportDetailClient
        resolved={single}
        savedFiltersMap={new Map()}
      />,
    );

    expect(screen.queryByText('Week 1')).toBeNull();
  });

  it('shows active window data when switching timeline items', async () => {
    const resolved = buildResolved();
    resolved.windows[1].evaluations = {
      'pipelines-f1': { generatedAt: '', signals: [], summary: { totalRuns: 5 } },
    };
    resolved.report.sections = [
      { section: 'pipelines', savedFilterId: 'f1' },
    ];

    const savedFiltersMap = new Map([
      ['f1', new SavedFilterBuilder().withId('f1').withName('CI Filter').withSection('pipelines').build()],
    ]);

    render(
      <ReportDetailClient
        resolved={resolved}
        savedFiltersMap={savedFiltersMap}
      />,
    );

    await userEvent.click(screen.getByText('Week 2'));

    expect(screen.getByTestId('pipeline-eval')).toBeVisible();
  });

  it('shows window label in the report header when multiple windows', () => {
    render(
      <ReportDetailClient
        resolved={buildResolved()}
        savedFiltersMap={new Map()}
      />,
    );

    const occurrences = screen.getAllByText(/Week 1/);
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  it('returns null when windows array is empty', () => {
    const { container } = render(
      <ReportDetailClient
        resolved={{ ...buildResolved(), windows: [] }}
        savedFiltersMap={new Map()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });
});
