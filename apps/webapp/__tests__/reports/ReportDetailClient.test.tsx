import { render, screen, fireEvent } from '@testing-library/react';
import ReportDetailClient from '@/components/reports/ReportDetailClient';
import type { ResolvedReport } from '@/app/reports/shared';

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

function makeResolved(overrides: Partial<ResolvedReport> = {}): ResolvedReport {
  return {
    report: {
      id: 'r1',
      name: 'Report 42',
      repository: 'owner/repo',
      sections: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    },
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
        resolved={makeResolved()}
        savedFiltersMap={new Map()}
      />,
    );

    expect(screen.getByText('Report 42')).toBeVisible();
  });

  it('renders timeline when multiple windows exist', () => {
    render(
      <ReportDetailClient
        resolved={makeResolved()}
        savedFiltersMap={new Map()}
      />,
    );

    expect(screen.getByText('Week 1')).toBeVisible();
    expect(screen.getByText('Week 2')).toBeVisible();
  });

  it('does not render timeline for single-window reports', () => {
    const single = makeResolved();
    single.windows = single.windows.slice(0, 1);

    render(
      <ReportDetailClient
        resolved={single}
        savedFiltersMap={new Map()}
      />,
    );

    expect(screen.queryByText('Week 1')).toBeNull();
  });

  it('shows active window data when switching timeline items', () => {
    const resolved = makeResolved();
    resolved.windows[1].evaluations = {
      pipelines: { generatedAt: '', signals: [], summary: { totalRuns: 5 } },
    };
    resolved.report.sections = [
      { section: 'pipelines', savedFilterId: 'f1' },
    ];

    const savedFiltersMap = new Map();
    savedFiltersMap.set('f1', {
      id: 'f1',
      name: 'CI Filter',
      section: 'pipelines',
      pathname: '/dashboard/pipelines',
      filters: {} as unknown,
      repository: 'owner/repo',
      createdAt: '',
    });

    render(
      <ReportDetailClient
        resolved={resolved}
        savedFiltersMap={savedFiltersMap}
      />,
    );

    // Default is window 0, switch to window 1
    fireEvent.click(screen.getByText('Week 2'));

    expect(screen.getByTestId('pipeline-eval')).toBeVisible();
  });

  it('shows window label in the report header when multiple windows', () => {
    render(
      <ReportDetailClient
        resolved={makeResolved()}
        savedFiltersMap={new Map()}
      />,
    );

    // The window label appears in both the timeline and the report header
    const occurrences = screen.getAllByText(/Week 1/);
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  it('returns null when windows array is empty', () => {
    const { container } = render(
      <ReportDetailClient
        resolved={{ ...makeResolved(), windows: [] }}
        savedFiltersMap={new Map()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });
});
