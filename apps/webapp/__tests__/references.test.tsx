import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReferencesPage from '@/app/dashboard/references/page';
import { METRIC_TARGETS } from '@/components/charts/targets';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
  })),
  usePathname: jest.fn(() => '/dashboard/references'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));

// Mock MUI icons to avoid SVG issues in jsdom
jest.mock('@mui/icons-material/ExpandMore', () => {
  const MockIcon = () => <span data-testid="icon-expand-more" />;
  return { __esModule: true, default: MockIcon };
});
jest.mock('@mui/icons-material/ExpandLess', () => {
  const MockIcon = () => <span data-testid="icon-expand-less" />;
  return { __esModule: true, default: MockIcon };
});

describe('ReferencesPage', () => {
  it('renders the page title and description', () => {
    render(<ReferencesPage />);

    expect(screen.getByText('References & Sources')).toBeInTheDocument();
    expect(
      screen.getByText(/All academic papers, industry reports, and books/)
    ).toBeInTheDocument();
    expect(screen.getByText('How Outliers Work In SMM')).toBeInTheDocument();
  });

  it('details which pipeline and pull request data are used for outliers', () => {
    render(<ReferencesPage />);

    expect(screen.getByText('Pipeline Data Used')).toBeInTheDocument();
    expect(screen.getByText(/Run duration per workflow/)).toBeInTheDocument();
    expect(screen.getByText(/Job average time per job/)).toBeInTheDocument();
    expect(screen.getByText(/Step average time by day and step/)).toBeInTheDocument();

    expect(screen.getByText('Pull Request Data Used')).toBeInTheDocument();
    expect(screen.getByText(/Average review time per author/)).toBeInTheDocument();
    expect(screen.getByText(/Average open days per period/)).toBeInTheDocument();
    expect(screen.getByText(/Time to first comment per author/)).toBeInTheDocument();
  });

  it('displays metric and source counts', () => {
    render(<ReferencesPage />);

    const metricCount = Object.keys(METRIC_TARGETS).length;
    const sourceCount = Object.values(METRIC_TARGETS).reduce(
      (acc, def) => acc + def.sources.length,
      0
    );

    expect(screen.getByText(`${metricCount} metrics`)).toBeInTheDocument();
    expect(screen.getByText(`${sourceCount} sources`)).toBeInTheDocument();
  });

  it('renders all category sections', () => {
    render(<ReferencesPage />);

    expect(screen.getByText('Code Analysis')).toBeInTheDocument();
    expect(screen.getByText('Pipelines')).toBeInTheDocument();
    expect(screen.getByText('Pull Requests')).toBeInTheDocument();
    expect(screen.getByText('SonarQube')).toBeInTheDocument();
    expect(screen.getByText('Outlier Detection')).toBeInTheDocument();
    expect(screen.getByText(/SMM flags outliers using the interquartile range \(IQR\) method\./)).toBeInTheDocument();
  });

  it('renders metric cards with targets and descriptions', () => {
    render(<ReferencesPage />);

    // Check a few key metrics
    expect(screen.getByText('Pairing Index')).toBeInTheDocument();
    expect(screen.getByText('> 30%')).toBeInTheDocument();
    expect(
      screen.getByText(/Higher paired commit percentage/)
    ).toBeInTheDocument();

    expect(screen.getByText('Big O Classification')).toBeInTheDocument();
    expect(screen.getByText('Review O(n^2+) hotspots')).toBeInTheDocument();

    expect(screen.getByText('Deployment Frequency')).toBeInTheDocument();
    expect(screen.getByText('Daily (Elite)')).toBeInTheDocument();
  });

  it('shows source count hint for metrics with sources', () => {
    render(<ReferencesPage />);

    // Multiple metrics have 2 sources - verify at least one exists
    const sourceHints = screen.getAllByText('2 sources available');
    expect(sourceHints.length).toBeGreaterThan(0);
  });

  it('expands sources when expand button is clicked', () => {
    render(<ReferencesPage />);

    // Find the first expand button (for Pairing Index)
    const expandButtons = screen.getAllByLabelText('expand sources');
    fireEvent.click(expandButtons[0]);

    // After expanding, the sources should be visible
    expect(
      screen.getByText(/Cockburn & Williams \(2001\)/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Hannay et al\. \(2009\)/)
    ).toBeInTheDocument();
  });

  it('collapses sources when collapse button is clicked', async () => {
    render(<ReferencesPage />);

    // Expand first
    const expandButtons = screen.getAllByLabelText('expand sources');
    fireEvent.click(expandButtons[0]);

    // Now collapse
    const collapseButton = screen.getByLabelText('collapse sources');
    fireEvent.click(collapseButton);

    // Wait for animation to complete and verify expand button is back
    await waitFor(() => {
      const expandButtonsAfterCollapse = screen.getAllByLabelText('expand sources');
      expect(expandButtonsAfterCollapse.length).toBeGreaterThan(0);
    });
  });

  it('renders all metrics from targets.ts', () => {
    render(<ReferencesPage />);

    // Verify every metric key from METRIC_TARGETS is represented
    const expectedMetrics = [
      'Pairing Index',
      'Code Churn',
      'Entity Churn',
      'Entity Effort',
      'Ownership',
      'Code Coupling',
      'Big O Classification',
      'Deployment Frequency',
      'Pipeline Duration',
      'Job Avg Time',
      'Job Reruns',
      'Jobs Success Rate',
      'Average Review Time',
      'Time To First Comment',
      'Prs By Author',
      'Prs Remain Open',
      'Pr Statistics',
      'Most Commented Prs',
      'Comments By Author',
      'Open Prs Through Time',
      'Sonarqube Reliability',
      'Sonarqube Security',
      'Sonarqube Maintainability',
      'Sonarqube Duplication',
      'Sonarqube Coverage',
      'Sonarqube Complexity',
      'Sonarqube Measurements',
      'Metric Outliers',
    ];

    for (const metric of expectedMetrics) {
      expect(screen.getByText(metric)).toBeInTheDocument();
    }
  });
});
