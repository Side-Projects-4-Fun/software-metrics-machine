import React from 'react';
import { render, screen } from '@testing-library/react';
import { Recommendations } from '@/components/charts/Recommendations';
import { FiltersProvider } from '@/components/filters/FiltersContext';
import type { RecommendationsProps } from '@/components/charts/recommendations-types';

// Mock MUI icons to avoid SVG issues in jsdom
jest.mock('@mui/icons-material/Link', () => {
  const MockIcon = () => <span data-testid="icon-link" />;
  return { __esModule: true, default: MockIcon };
});
jest.mock('@mui/icons-material/Lightbulb', () => {
  const MockIcon = () => <span data-testid="icon-lightbulb" />;
  return { __esModule: true, default: MockIcon };
});
jest.mock('@mui/icons-material/Warning', () => {
  const MockIcon = () => <span data-testid="icon-warning" />;
  return { __esModule: true, default: MockIcon };
});
jest.mock('@mui/icons-material/CheckCircle', () => {
  const MockIcon = () => <span data-testid="icon-check" />;
  return { __esModule: true, default: MockIcon };
});
jest.mock('@mui/icons-material/Info', () => {
  const MockIcon = () => <span data-testid="icon-info" />;
  return { __esModule: true, default: MockIcon };
});

const defaultProps: RecommendationsProps = {
  pairingIndex: null,
  prSummary: null,
  deploymentFrequency: [],
  jobsSummary: [],
  reviewTime: [],
};

function renderWithProviders(ui: React.ReactElement) {
  return render(<FiltersProvider>{ui}</FiltersProvider>);
}

describe('Recommendations', () => {
  describe('Pairing Index', () => {
    it('shows warning when pairing index is below 30%', () => {
      renderWithProviders(
        <Recommendations
          {...defaultProps}
          pairingIndex={{
            pairing_index_percentage: 15,
            paired_commits: 30,
            total_analyzed_commits: 200,
          }}
        />
      );

      expect(screen.getByText('Increase Pair Programming')).toBeInTheDocument();
      expect(screen.getByText(/pairing index is 15.0%/)).toBeInTheDocument();
      expect(screen.getByText(/below the 30% target/)).toBeInTheDocument();
    });

    it('shows success when pairing index is at or above 30%', () => {
      renderWithProviders(
        <Recommendations
          {...defaultProps}
          pairingIndex={{
            pairing_index_percentage: 35,
            paired_commits: 70,
            total_analyzed_commits: 200,
          }}
        />
      );

      expect(screen.getByText('Pair Programming on Track')).toBeInTheDocument();
      expect(screen.getByText(/pairing index is 35.0%/)).toBeInTheDocument();
      expect(screen.getByText(/meeting the 30% target/)).toBeInTheDocument();
    });
  });

  describe('Pipeline Success Rate', () => {
    it('shows warning when success rate is below 90%', () => {
      renderWithProviders(
        <Recommendations
          {...defaultProps}
          jobsSummary={[
            {
              workflow_name: '.github/workflows/ci.yml',
              job_name: 'test',
              success_rate: 80,
              value: 3,
              method: 'average',
              rerun_count: 0,
              total_runs: 50,
            },
          ]}
        />
      );

      expect(screen.getByText('Improve Pipeline Reliability')).toBeInTheDocument();
      expect(screen.getByText(/Overall pipeline success rate is 80.0%/)).toBeInTheDocument();
      expect(screen.getByText(/Most affected: \.github\/workflows\/ci\.yml \/ test \(80\.0%\)/)).toBeInTheDocument();
      expect(screen.getByText('.github/workflows/ci.yml / test - 80.0% success')).toBeInTheDocument();
    });

    it('uses the selected workflow as a pipeline name fallback', () => {
      renderWithProviders(
        <Recommendations
          {...defaultProps}
          selectedWorkflow=".github/workflows/release.yml"
          jobsSummary={[
            {
              job_name: 'deploy',
              success_rate: 60,
              value: 3,
              method: 'average',
              rerun_count: 0,
              total_runs: 10,
            },
          ]}
        />
      );

      expect(
        screen.getByText('.github/workflows/release.yml / deploy - 60.0% success')
      ).toBeInTheDocument();
    });

    it('shows success when success rate is at or above 90%', () => {
      renderWithProviders(
        <Recommendations
          {...defaultProps}
          jobsSummary={[
            {
              job_name: 'test',
              success_rate: 95,
              value: 3,
              method: 'average',
              rerun_count: 0,
              total_runs: 50,
            },
          ]}
        />
      );

      expect(screen.getByText('Pipeline Reliability on Track')).toBeInTheDocument();
      expect(screen.getByText(/Overall pipeline success rate is 95.0%/)).toBeInTheDocument();
    });
  });

  describe('Job Reruns', () => {
    it('shows warning when reruns are detected', () => {
      renderWithProviders(
        <Recommendations
          {...defaultProps}
          jobsSummary={[
            {
              workflow_name: '.github/workflows/ci.yml',
              job_name: 'flaky-test',
              success_rate: 90,
              value: 4,
              method: 'average',
              rerun_count: 5,
              total_runs: 100,
            },
          ]}
        />
      );

      expect(screen.getByText('Reduce Pipeline Reruns')).toBeInTheDocument();
      expect(screen.getByText(/Detected 5 reruns across 1 job\(s\)/)).toBeInTheDocument();
      expect(screen.getByText(/\.github\/workflows\/ci\.yml \/ flaky-test \(5\)/)).toBeInTheDocument();
    });

    it('does not show rerun warning when reruns are zero', () => {
      renderWithProviders(
        <Recommendations
          {...defaultProps}
          jobsSummary={[
            {
              job_name: 'stable-job',
              success_rate: 95,
              value: 3,
              method: 'average',
              rerun_count: 0,
              total_runs: 50,
            },
          ]}
        />
      );

      expect(screen.queryByText('Reduce Pipeline Reruns')).not.toBeInTheDocument();
    });
  });

  describe('Job Duration', () => {
    it('shows warning when average duration exceeds 5 minutes', () => {
      renderWithProviders(
        <Recommendations
          {...defaultProps}
          jobsSummary={[
            {
              workflow_name: '.github/workflows/ci.yml',
              job_name: 'slow-job',
              success_rate: 95,
              value: 8,
              method: 'average',
              rerun_count: 0,
              total_runs: 50,
            },
          ]}
        />
      );

      expect(screen.getByText('Optimize Job Duration')).toBeInTheDocument();
      expect(screen.getByText(/Average job duration is 8.0 min/)).toBeInTheDocument();
      expect(screen.getByText(/Slowest jobs: \.github\/workflows\/ci\.yml \/ slow-job \(8.0 min\)/)).toBeInTheDocument();
    });

    it('does not show duration warning when under 5 minutes', () => {
      renderWithProviders(
        <Recommendations
          {...defaultProps}
          jobsSummary={[
            {
              job_name: 'fast-job',
              success_rate: 95,
              value: 3,
              method: 'average',
              rerun_count: 0,
              total_runs: 50,
            },
          ]}
        />
      );

      expect(screen.queryByText('Optimize Job Duration')).not.toBeInTheDocument();
    });
  });

  describe('Change Request Review Time', () => {
    it('shows warning when average review time exceeds 24 hours (1 day)', () => {
      renderWithProviders(
        <Recommendations
          {...defaultProps}
          reviewTime={[
            { author: 'alice', value: 1.25, method: 'average' },
            { author: 'bob', value: 1.5, method: 'average' },
          ]}
        />
      );

      expect(screen.getByText('Speed Up Code Reviews')).toBeInTheDocument();
      expect(screen.getByText(/Review time is 1.4d/)).toBeInTheDocument();
    });

    it('shows success when review time is within target', () => {
      renderWithProviders(
        <Recommendations
          {...defaultProps}
          reviewTime={[
            { author: 'alice', value: 0.5, method: 'average' },
            { author: 'bob', value: 0.75, method: 'average' },
          ]}
        />
      );

      expect(screen.getByText('Review Time on Track')).toBeInTheDocument();
      expect(screen.getByText(/Review time is 0.6d/)).toBeInTheDocument();
    });
  });

  describe('Open Change Requests', () => {
    it('shows info when there are open PRs', () => {
      renderWithProviders(
        <Recommendations
          {...defaultProps}
          prSummary={{ total: 20, merged: 15, closed: 2, open: 3 }}
        />
      );

      expect(screen.getByText('Review Open Change Requests')).toBeInTheDocument();
      expect(screen.getByText(/You have 3 open change request\(s\)/)).toBeInTheDocument();
    });

    it('does not show open PRs info when there are none', () => {
      renderWithProviders(
        <Recommendations
          {...defaultProps}
          prSummary={{ total: 20, merged: 18, closed: 2, open: 0 }}
        />
      );

      expect(screen.queryByText('Review Open Change Requests')).not.toBeInTheDocument();
    });
  });

  describe('Deployment Frequency', () => {
    it('shows info when no deployments are detected', () => {
      renderWithProviders(
        <Recommendations
          {...defaultProps}
          deploymentFrequency={[
            { pipeline: 'deploy', job: 'prod', day_count: 0 },
          ]}
        />
      );

      expect(screen.getByText('Increase Deployment Frequency')).toBeInTheDocument();
      expect(screen.getByText(/No deployments detected for deploy \/ prod/)).toBeInTheDocument();
    });

    it('does not show deployment warning when deployments exist', () => {
      renderWithProviders(
        <Recommendations
          {...defaultProps}
          deploymentFrequency={[
            { pipeline: 'deploy', job: 'prod', day_count: 5 },
          ]}
        />
      );

      expect(screen.queryByText('Increase Deployment Frequency')).not.toBeInTheDocument();
    });
  });

  describe('General Guidance', () => {
    it('shows general guidance when all metrics are healthy and no open PRs', () => {
      renderWithProviders(
        <Recommendations
          {...defaultProps}
          pairingIndex={{
            pairing_index_percentage: 40,
            paired_commits: 80,
            total_analyzed_commits: 200,
          }}
          jobsSummary={[
            {
              job_name: 'test',
              success_rate: 95,
              value: 3,
              method: 'average',
              rerun_count: 0,
              total_runs: 50,
            },
          ]}
          reviewTime={[{ author: 'alice', value: 0.5, method: 'average' }]}
          prSummary={{ total: 10, merged: 9, closed: 1, open: 0 }}
          deploymentFrequency={[{ pipeline: 'deploy', job: 'prod', day_count: 5 }]}
        />
      );

      expect(screen.getByText('Explore Deeper Insights')).toBeInTheDocument();
      expect(screen.getByText(/code churn, entity coupling/)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('renders the general guidance card when no data is provided', () => {
      renderWithProviders(<Recommendations {...defaultProps} />);

      expect(screen.getByText('Explore Deeper Insights')).toBeInTheDocument();
    });
  });
});
