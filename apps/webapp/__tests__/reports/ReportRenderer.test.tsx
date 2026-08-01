import { render, screen, fireEvent, within } from '@testing-library/react';
import ReportRenderer from '@/components/reports/ReportRenderer';

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

describe('ReportRenderer', () => {
  it('renders report name', () => {
    render(
      <ReportRenderer
        report={{
          id: 'r1',
          name: 'Report 42',
          repository: 'owner/repo',
          sections: [],
          createdAt: '2026-01-01T00:00:00.000Z',
        }}
        savedFiltersMap={new Map()}
        evaluations={{}}
        errors={{}}
      />,
    );

    expect(screen.getByText('Report 42')).toBeVisible();
  });

  it('shows "No sections selected" when report has no sections', () => {
    render(
      <ReportRenderer
        report={{
          id: 'r1',
          name: 'Empty Report',
          repository: 'owner/repo',
          sections: [],
          createdAt: '2026-01-01T00:00:00.000Z',
        }}
        savedFiltersMap={new Map()}
        evaluations={{}}
        errors={{}}
      />,
    );

    expect(screen.getByText(/No sections selected/)).toBeVisible();
  });

  it('renders evaluation card for a section with data', () => {
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
      <ReportRenderer
        report={{
          id: 'r1',
          name: 'Report 42',
          repository: 'owner/repo',
          sections: [
            { section: 'pipelines', savedFilterId: 'f1' },
            { section: 'pull-requests', savedFilterId: 'f2' },
          ],
          createdAt: '2026-01-01T00:00:00.000Z',
        }}
        savedFiltersMap={savedFiltersMap}
        evaluations={{
          pipelines: { generatedAt: '', signals: [], summary: {} },
          'pull-requests': { generatedAt: '', signals: [], summary: {} },
        }}
        errors={{}}
      />,
    );

    expect(screen.getByTestId('pipeline-eval')).toBeVisible();
    expect(screen.getByTestId('pr-eval')).toBeVisible();
  });

  it('shows "filter missing" chip when saved filter reference is broken', () => {
    render(
      <ReportRenderer
        report={{
          id: 'r1',
          name: 'Report 42',
          repository: 'owner/repo',
          sections: [
            { section: 'sonarqube', savedFilterId: 'missing-id' },
          ],
          createdAt: '2026-01-01T00:00:00.000Z',
        }}
        savedFiltersMap={new Map()}
        evaluations={{}}
        errors={{}}
      />,
    );

    expect(screen.getByText(/missing/)).toBeVisible();
  });

  it('shows error message when evaluation fails', () => {
    render(
      <ReportRenderer
        report={{
          id: 'r1',
          name: 'Report 42',
          repository: 'owner/repo',
          sections: [
            { section: 'architecture', savedFilterId: 'f1' },
          ],
          createdAt: '2026-01-01T00:00:00.000Z',
        }}
        savedFiltersMap={
          new Map([['f1', {
            id: 'f1',
            name: 'Arch Filter',
            section: 'architecture',
            pathname: '/dashboard/architecture',
            filters: {} as unknown,
            repository: 'owner/repo',
            createdAt: '',
          }]])
        }
        evaluations={{}}
        errors={{
          architecture: 'Evaluation API returned 500',
        }}
      />,
    );

    expect(screen.getByText('Evaluation API returned 500')).toBeVisible();
  });

  describe('collapsible sections', () => {
    function renderWithTwoSections() {
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
      savedFiltersMap.set('f2', {
        id: 'f2',
        name: 'PR Filter',
        section: 'pull-requests',
        pathname: '/dashboard/pull-requests',
        filters: {} as unknown,
        repository: 'owner/repo',
        createdAt: '',
      });

      return render(
        <ReportRenderer
          report={{
            id: 'r1',
            name: 'Report 42',
            repository: 'owner/repo',
            sections: [
              { section: 'pipelines', savedFilterId: 'f1' },
              { section: 'pull-requests', savedFilterId: 'f2' },
            ],
            createdAt: '2026-01-01T00:00:00.000Z',
          }}
          savedFiltersMap={savedFiltersMap}
          evaluations={{
            pipelines: { generatedAt: '', signals: [], summary: {} },
            'pull-requests': { generatedAt: '', signals: [], summary: {} },
          }}
          errors={{}}
        />,
      );
    }

    it('shows a toggle-all button', () => {
      renderWithTwoSections();
      expect(screen.getByRole('button', { name: /collapse all|expand all/i })).toBeVisible();
    });

    it('shows evaluation cards by default (expanded)', () => {
      renderWithTwoSections();
      expect(screen.getByTestId('pipeline-eval')).toBeVisible();
      expect(screen.getByTestId('pr-eval')).toBeVisible();
    });

    it('collapses all sections when toggle-all is clicked', () => {
      renderWithTwoSections();

      fireEvent.click(screen.getByRole('button', { name: /collapse all/i }));

      expect(screen.queryByTestId('pipeline-eval')).not.toBeInTheDocument();
      expect(screen.queryByTestId('pr-eval')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /expand all/i })).toBeVisible();
    });

    it('expands all sections when toggle-all is clicked again', () => {
      renderWithTwoSections();

      const toggleBtn = screen.getByRole('button', { name: /collapse all/i });
      fireEvent.click(toggleBtn); // collapse all
      fireEvent.click(toggleBtn); // expand all

      expect(screen.getByTestId('pipeline-eval')).toBeVisible();
      expect(screen.getByTestId('pr-eval')).toBeVisible();
    });

    it('toggles a single section when its header is clicked', () => {
      renderWithTwoSections();

      // Click the pipelines section header button to collapse it
      fireEvent.click(screen.getByRole('button', { name: /Pipelines —/ }));

      expect(screen.queryByTestId('pipeline-eval')).not.toBeInTheDocument();
      expect(screen.getByTestId('pr-eval')).toBeVisible();
    });

    it('expands a collapsed section when its header is clicked again', () => {
      renderWithTwoSections();

      const pipelinesHeader = screen.getByRole('button', { name: /Pipelines —/ });
      fireEvent.click(pipelinesHeader); // collapse
      fireEvent.click(pipelinesHeader); // expand

      expect(screen.getByTestId('pipeline-eval')).toBeVisible();
    });
  });
});
