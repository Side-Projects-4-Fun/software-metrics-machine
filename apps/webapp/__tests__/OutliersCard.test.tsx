import { fireEvent, render, screen } from '@testing-library/react';
import OutliersCard, { MetricOutlierRow } from '@/components/charts/OutliersCard';
import { LinkBuilderProvider } from '@/components/providers/LinkBuilderContext';
import { DashboardGlobalConfiguration } from '@/server/api/configuration';

const configuration: DashboardGlobalConfiguration = {
  git_provider: 'github',
  github_repository: 'acme/widgets',
  git_repository_location: '',
  store_data: true,
  deployment_frequency_targets: [],
  main_branch: 'main',
  dashboard_start_date: null,
  dashboard_end_date: null,
  dashboard_color: 'blue',
  logging_level: 'INFO',
  jira_url: null,
  jira_email: null,
  jira_token: null,
  jira_project: null,
  sonar_url: null,
  sonar_project: null,
};

function renderOutliers(rows: MetricOutlierRow[]) {
  return render(
    <LinkBuilderProvider config={configuration}>
      <OutliersCard rows={rows} />
    </LinkBuilderProvider>
  );
}

function makeRows(count: number): MetricOutlierRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `outlier-${index + 1}`,
    metric: `Metric ${index + 1}`,
    value: index + 1,
    timestamp: `2026-06-${String(index + 1).padStart(2, '0')}T12:00:00Z`,
    lowerBound: 1,
    upperBound: 10,
    item: {
      title: `Item ${index + 1}`,
    },
  }));
}

describe('OutliersCard', () => {
  it('renders nothing when there are no rows', () => {
    const { container } = renderOutliers([]);

    expect(container).toBeEmptyDOMElement();
  });

  it('paginates outlier rows', () => {
    renderOutliers(makeRows(12));

    expect(screen.getByTestId('outliers-table-frame')).toHaveStyle({ height: '560px' });
    expect(screen.getByText('Metric 1')).toBeInTheDocument();
    expect(screen.queryByText('Metric 11')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1-10 of 12')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /go to page 2/i }));

    expect(screen.getByText('Metric 11')).toBeInTheDocument();
    expect(screen.getByText('Showing 11-12 of 12')).toBeInTheDocument();
  });

  it('shows outliers academic references from the info icon', () => {
    renderOutliers(makeRows(1));

    fireEvent.click(screen.getByText('i'));

    expect(screen.getByText('Target: Investigate points outside IQR bounds')).toBeInTheDocument();
    expect(screen.getByText(/Kamei et al. \(2013\)/)).toBeInTheDocument();
    expect(screen.getByText(/Rahman & Devanbu \(2013\)/)).toBeInTheDocument();
    expect(screen.getByText(/Nagappan & Ball \(2005\)/)).toBeInTheDocument();
  });

  it('links item label using resource when url is not available', () => {
    const rows: MetricOutlierRow[] = [
      {
        id: 'outlier-resource-1',
        metric: 'Removed Resources',
        value: 42,
        timestamp: '2026-06-01T12:00:00Z',
        lowerBound: 1,
        upperBound: 10,
        item: {
          title: 'obsolete artifact',
          resource: 'https://example.com/resources/obsolete-artifact',
        },
      },
    ];

    renderOutliers(rows);

    expect(screen.getByRole('link', { name: /obsolete artifact/i })).toHaveAttribute(
      'href',
      'https://example.com/resources/obsolete-artifact'
    );
  });

  it('links workflow outlier rows to provider run page when run id is available', () => {
    const rows: MetricOutlierRow[] = [
      {
        id: 'outlier-workflow-1',
        metric: 'Run duration: ci.yml',
        value: 24,
        timestamp: '2026-06-01T12:00:00Z',
        lowerBound: 1,
        upperBound: 10,
        item: {
          workflowName: 'ci.yml',
          runId: '12345',
        },
      },
    ];

    renderOutliers(rows);

    expect(screen.getByRole('link', { name: /ci.yml/i })).toHaveAttribute(
      'href',
      'https://github.com/acme/widgets/actions/runs/12345'
    );
  });
});
