import React from 'react';
import { render, screen } from '@testing-library/react';
import PipelinesPage from '@/app/dashboard/pipelines/page';
import { FiltersProvider } from '@/components/filters/FiltersContext';
import { LinkBuilderProvider } from '@/components/providers/LinkBuilderContext';
import { ConfigurationProvider } from '@/components/providers/ConfigurationContext';
import { pipelineAPI } from '@/server/api';
import { DashboardConfigurationBuilder } from '../builders/builders';

jest.mock('@/server/api', () => ({
  pipelineAPI: {
    dashboard: jest.fn(),
    evaluate: jest.fn(),
  },
}));

const mockPipeline = pipelineAPI as jest.Mocked<typeof pipelineAPI>;

const mockConfig = new DashboardConfigurationBuilder()
  .withDeploymentFrequencyTargets([{ pipeline: '.github/workflows/deploy.yml', job: 'deploy' }])
  .build();

function Providers({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <ConfigurationProvider config={mockConfig}>
      <FiltersProvider>
        <LinkBuilderProvider config={mockConfig}>
          {children}
        </LinkBuilderProvider>
      </FiltersProvider>
    </ConfigurationProvider>
  );
}

function makeDashboardResponse() {
  return {
    summary: { total_runs: 100, in_progress: 2, queued: 1 },
    jobs_by_status: [{ Status: 'success', Count: 80 }, { Status: 'failure', Count: 20 }],
    runs_duration: [{ workflow: 'ci.yml', avg_duration: 120, min_duration: 30, max_duration: 300, total_runs: 50 }],
    runs_by: [{ period: '2026-01-01', workflow: 'ci.yml', runs: 5 }],
    jobs_average_time: [{ job_name: 'test', avg_time: 45, count: 50 }],
    jobs_average_time_by_day: [{ day: '2026-01-01', avg_time: 50, count: 3 }],
    jobs_duration_by_workflow: [{ workflow: 'ci.yml', jobs: { test: 45, build: 60 } }],
    jobs_summary: [{ job_name: 'test', total_runs: 50, avg_duration_minutes: 2, success_count: 45, failure_count: 5, success_rate: 90, failure_rate: 10, rerun_count: 2 }],
    jobs_reruns_by_day: [{ day: '2026-01-01', rerun_count: 2 }],
    job_steps_average_time: [{ name: 'checkout', averageDurationMinutes: 0.5, count: 100 }],
    job_steps_average_time_by_day: [{ day: '2026-01-01', steps: [{ name: 'checkout', averageDurationMinutes: 0.5 }] }],
  };
}

describe('Pipelines Dashboard - User Journey', () => {
  beforeEach(() => {
    mockPipeline.dashboard.mockResolvedValue(makeDashboardResponse());
    mockPipeline.evaluate.mockResolvedValue({
      generatedAt: '2026-01-01T00:00:00Z',
      signals: [{ id: 'stability', title: 'Stability', description: 'Good', severity: 'good', category: 'stability', metrics: [] }],
      summary: { totalRuns: 100, averageDurationMinutes: 2.5, successRate: 80, failureRate: 20, totalReruns: 3 },
    });
  });

  it('renders pipeline health summary and evaluation', async () => {
    const ui = await PipelinesPage({ searchParams: Promise.resolve({}) });
    render(<Providers>{ui}</Providers>);

    expect(screen.getByText('Pipeline Health Summary')).toBeInTheDocument();
    expect(screen.getByText('Bottleneck Analysis')).toBeInTheDocument();
  });

  it('renders duration and performance metrics', async () => {
    const ui = await PipelinesPage({ searchParams: Promise.resolve({}) });
    render(<Providers>{ui}</Providers>);

    expect(screen.getByText('Pipeline Runs Duration')).toBeInTheDocument();
    expect(screen.getByText('Jobs Average Time')).toBeInTheDocument();
    expect(screen.getByText('Jobs by Status')).toBeInTheDocument();
  });

  it('renders job rerun and reliability metrics', async () => {
    const ui = await PipelinesPage({ searchParams: Promise.resolve({}) });
    render(<Providers>{ui}</Providers>);

    expect(screen.getByText('Job Reruns')).toBeInTheDocument();
  });

  it('shows error when API calls fail', async () => {
    mockPipeline.dashboard.mockRejectedValue(new Error('fail'));
    mockPipeline.evaluate.mockRejectedValue(new Error('fail'));

    const ui = await PipelinesPage({ searchParams: Promise.resolve({}) });
    render(<Providers>{ui}</Providers>);

    expect(screen.getByText('Failed to load pipeline detail data.')).toBeInTheDocument();
  });
});
