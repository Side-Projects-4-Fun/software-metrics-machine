import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReportRenderer from '@/components/reports/ReportRenderer';
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

const defaultProps = {
  effectiveStartDate: '',
  effectiveEndDate: '',
} as const;

describe('ReportRenderer', () => {
  it('renders report name', () => {
    render(
      <ReportRenderer
        report={new ReportEntryBuilder().withId('r1').withName('Report 42').build()}
        savedFiltersMap={new Map()}
        evaluations={{}}
        errors={{}}
        {...defaultProps}
      />,
    );

    expect(screen.getByText('Report 42')).toBeVisible();
  });

  it('shows "No sections selected" when report has no sections', () => {
    render(
      <ReportRenderer
        report={new ReportEntryBuilder().withId('r1').withName('Empty Report').build()}
        savedFiltersMap={new Map()}
        evaluations={{}}
        errors={{}}
        {...defaultProps}
      />,
    );

    expect(screen.getByText(/No sections selected/)).toBeVisible();
  });

  it('renders evaluation card for a section with data', () => {
    const savedFiltersMap = new Map([
      ['f1', new SavedFilterBuilder().withId('f1').withName('CI Filter').withSection('pipelines').build()],
    ]);

    render(
      <ReportRenderer
        report={
          new ReportEntryBuilder()
            .withId('r1')
            .withName('Report 42')
            .withSections([
              { section: 'pipelines', savedFilterId: 'f1' },
              { section: 'pull-requests', savedFilterId: 'f2' },
            ])
            .build()
        }
        savedFiltersMap={savedFiltersMap}
        evaluations={{
          'pipelines-f1': { generatedAt: '', signals: [], summary: {} },
          'pull-requests-f2': { generatedAt: '', signals: [], summary: {} },
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
        report={
          new ReportEntryBuilder()
            .withId('r1')
            .withName('Report 42')
            .withSections([
              { section: 'sonarqube', savedFilterId: 'missing-id' },
            ])
            .build()
        }
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
        report={
          new ReportEntryBuilder()
            .withId('r1')
            .withName('Report 42')
            .withSections([
              { section: 'architecture', savedFilterId: 'f1' },
            ])
            .build()
        }
        savedFiltersMap={
          new Map([['f1', new SavedFilterBuilder().withId('f1').withName('Arch Filter').withSection('architecture').build()]])
        }
        evaluations={{}}
        errors={{
          'architecture-f1': 'Evaluation API returned 500',
        }}
        {...defaultProps}
      />,
    );

    expect(screen.getByText('Evaluation API returned 500')).toBeVisible();
  });

  describe('collapsible sections', () => {
    function renderWithTwoSections() {
      const savedFiltersMap = new Map([
        ['f1', new SavedFilterBuilder().withId('f1').withName('CI Filter').withSection('pipelines').build()],
        ['f2', new SavedFilterBuilder().withId('f2').withName('PR Filter').withSection('pull-requests').build()],
      ]);

      return render(
        <ReportRenderer
          report={
            new ReportEntryBuilder()
              .withId('r1')
              .withName('Report 42')
              .withSections([
                { section: 'pipelines', savedFilterId: 'f1' },
                { section: 'pull-requests', savedFilterId: 'f2' },
              ])
              .build()
          }
          savedFiltersMap={savedFiltersMap}
          evaluations={{
            'pipelines-f1': { generatedAt: '', signals: [], summary: {} },
            'pull-requests-f2': { generatedAt: '', signals: [], summary: {} },
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

    it('collapses all sections when toggle-all is clicked', async () => {
      renderWithTwoSections();

      await userEvent.click(screen.getByRole('button', { name: /collapse all/i }));

      expect(screen.getByTestId('pipeline-eval')).not.toBeVisible();
      expect(screen.getByTestId('pr-eval')).not.toBeVisible();
      expect(screen.getByRole('button', { name: /expand all/i })).toBeVisible();
    });

    it('expands all sections when toggle-all is clicked again', async () => {
      renderWithTwoSections();

      const toggleBtn = screen.getByRole('button', { name: /collapse all/i });
      await userEvent.click(toggleBtn);
      await userEvent.click(toggleBtn);

      expect(screen.getByTestId('pipeline-eval')).toBeVisible();
      expect(screen.getByTestId('pr-eval')).toBeVisible();
    });

    it('toggles a single section when its header is clicked', async () => {
      renderWithTwoSections();

      await userEvent.click(screen.getByRole('button', { name: /Pipelines —/ }));

      expect(screen.getByTestId('pipeline-eval')).not.toBeVisible();
      expect(screen.getByTestId('pr-eval')).toBeVisible();
    });

    it('expands a collapsed section when its header is clicked again', async () => {
      renderWithTwoSections();

      const pipelinesHeader = screen.getByRole('button', { name: /Pipelines —/ });
      await userEvent.click(pipelinesHeader);
      await userEvent.click(pipelinesHeader);

      expect(screen.getByTestId('pipeline-eval')).toBeVisible();
    });
  });

  describe('dashboard links', () => {
    it('renders a dashboard link for sections with a saved filter', () => {
      const savedFiltersMap = new Map([
        ['f1', new SavedFilterBuilder()
          .withId('f1')
          .withName('CI Filter')
          .withSection('pipelines')
          .withFilters({ startDate: '2026-01-01', endDate: '2026-01-31' })
          .build()],
      ]);

      render(
        <ReportRenderer
          report={
            new ReportEntryBuilder()
              .withId('r1')
              .withName('Report 42')
              .withSections([{ section: 'pipelines', savedFilterId: 'f1' }])
              .build()
          }
          savedFiltersMap={savedFiltersMap}
          evaluations={{ 'pipelines-f1': { generatedAt: '', signals: [], summary: {} } }}
          errors={{}}
        />,
      );

      const link = screen.getByRole('link', { name: /Open Pipelines in dashboard/ });
      expect(link).toBeVisible();
      expect(link).toHaveAttribute('href');
      expect(link.getAttribute('href')).toContain('/dashboard/pipelines?');
      expect(link.getAttribute('href')).toContain('startDate=2026-01-01');
      expect(link.getAttribute('href')).toContain('endDate=2026-01-31');
    });

    it('does not render a dashboard link for sections with missing saved filter', () => {
      render(
        <ReportRenderer
          report={
            new ReportEntryBuilder()
              .withId('r1')
              .withName('Report 42')
              .withSections([{ section: 'architecture', savedFilterId: 'missing-id' }])
              .build()
          }
          savedFiltersMap={new Map()}
          evaluations={{}}
          errors={{}}
        />,
      );

      expect(screen.queryByRole('link', { name: /Open.*dashboard/ })).not.toBeInTheDocument();
    });

    it('renders dashboard links for each section with a saved filter', () => {
      const savedFiltersMap = new Map([
        ['f1', new SavedFilterBuilder()
          .withId('f1')
          .withName('CI Filter')
          .withSection('pipelines')
          .withFilters({ startDate: '2026-01-01', endDate: '2026-01-31' })
          .build()],
      ]);

      render(
        <ReportRenderer
          report={
            new ReportEntryBuilder()
              .withId('r1')
              .withName('Report 42')
              .withSections([{ section: 'pipelines', savedFilterId: 'f1' }])
              .build()
          }
          savedFiltersMap={savedFiltersMap}
          evaluations={{ 'pipelines-f1': { generatedAt: '', signals: [], summary: {} } }}
          errors={{}}
          {...defaultProps}
        />,
      );

      expect(screen.getByTestId('pipeline-eval')).toBeVisible();
    });

    it('dashboard link opens in a new tab', () => {
      const savedFiltersMap = new Map([
        ['f1', new SavedFilterBuilder()
          .withId('f1')
          .withName('Sonar Filter')
          .withSection('sonarqube')
          .build()],
      ]);

      render(
        <ReportRenderer
          report={
            new ReportEntryBuilder()
              .withId('r1')
              .withName('Report 42')
              .withSections([{ section: 'sonarqube', savedFilterId: 'f1' }])
              .build()
          }
          savedFiltersMap={savedFiltersMap}
          evaluations={{ 'sonarqube-f1': { generatedAt: '', signals: [], summary: {} } }}
          errors={{}}
          {...defaultProps}
        />,
      );

      const link = screen.getByRole('link', { name: /Open SonarQube in dashboard/ });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('uses effective dates instead of saved filter dates in the link', () => {
      const savedFiltersMap = new Map([
        ['f1', new SavedFilterBuilder()
          .withId('f1')
          .withName('CI Filter')
          .withSection('pipelines')
          .withFilters({ startDate: '2026-01-01', endDate: '2026-01-31' })
          .build()],
      ]);

      render(
        <ReportRenderer
          report={
            new ReportEntryBuilder()
              .withId('r1')
              .withName('Report 42')
              .withSections([{ section: 'pipelines', savedFilterId: 'f1' }])
              .build()
          }
          savedFiltersMap={savedFiltersMap}
          evaluations={{ 'pipelines-f1': { generatedAt: '', signals: [], summary: {} } }}
          errors={{}}
          {...defaultProps}
          effectiveStartDate="2026-03-15"
          effectiveEndDate="2026-04-15"
        />,
      );

      const link = screen.getByRole('link', { name: /Open Pipelines in dashboard/ });
      const href = link.getAttribute('href')!;
      expect(href).toContain('startDate=2026-03-15');
      expect(href).toContain('endDate=2026-04-15');
    });
  });
});
