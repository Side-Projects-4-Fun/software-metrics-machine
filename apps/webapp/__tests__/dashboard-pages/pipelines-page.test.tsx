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
    runs_duration: [{ workflow: 'ci.yml', value: 120, value_formatted: '2 h', method: 'average', min_duration: 30, min_duration_formatted: '30 min', max_duration: 300, max_duration_formatted: '5 h', total_runs: 50 }],
    runs_by: [{ period: '2026-01-01', workflow: 'ci.yml', runs: 5 }],
    jobs_average_time: [{ job_name: 'test', value: 45, value_formatted: '45 min', method: 'average', count: 50 }],
    jobs_average_time_by_day: [{ day: '2026-01-01', value: 50, value_formatted: '50 min', method: 'average', count: 3 }],
    jobs_duration_by_workflow: [{ workflow: 'ci.yml', jobs: { test: 45, build: 60 } }],
    jobs_summary: [{ job_name: 'test', total_runs: 50, value: 2, value_formatted: '2 min', method: 'average', success_count: 45, failure_count: 5, success_rate: 90, failure_rate: 10, rerun_count: 2 }],
    jobs_reruns_by_day: [{ day: '2026-01-01', rerun_count: 2 }],
    job_steps_average_time: [{ name: 'checkout', value: 0.5, value_formatted: '30 sec', method: 'average', count: 100 }],
    job_steps_average_time_by_day: [{ day: '2026-01-01', steps: [{ name: 'checkout', value: 0.5, value_formatted: '30 sec', method: 'average' }] }],
  };
}

describe('Pipelines Dashboard - User Journey', () => {
  beforeEach(() => {
    mockPipeline.dashboard.mockResolvedValue(makeDashboardResponse());
    mockPipeline.evaluate.mockResolvedValue({
      generatedAt: '2026-01-01T00:00:00Z',
      signals: [{ id: 'stability', title: 'Stability', description: 'Good', severity: 'good', category: 'stability', metrics: [] }],
      summary: { totalRuns: 100, durationMinutes: 2.5, durationMinutes_formatted: '2.5 min', method: 'average', successRate: 80, failureRate: 20, totalReruns: 3 },
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
