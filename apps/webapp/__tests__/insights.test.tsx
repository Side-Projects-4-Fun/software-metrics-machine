import React from "react";
import { render, renderHook, screen } from "@testing-library/react";
import InsightsSection from "@/app/dashboard/insights/page";
import { FiltersProvider, useFilters } from "@/components/filters/FiltersContext";
import { pipelineAPI, pullRequestAPI, sourceCodeAPI } from "@/server/api";

jest.mock('@/server/api', () => ({
  sourceCodeAPI: {
    pairingIndex: jest.fn(),
  },
  pipelineAPI: {
    summary: jest.fn(),
    deploymentFrequency: jest.fn(),
    jobsSummary: jest.fn(),
  },
  pullRequestAPI: {
    summary: jest.fn(),
    averageReviewTime: jest.fn(),
  },
}));

jest.mock('@/components/charts/DeploymentFrequency', () => ({
  DeploymentFrequency: () => <div data-testid="deployment-frequency" />,
}));

const mockSourceCodeAPI = sourceCodeAPI as jest.Mocked<typeof sourceCodeAPI>;
const mockPipelineAPI = pipelineAPI as jest.Mocked<typeof pipelineAPI>;
const mockPullRequestAPI = pullRequestAPI as jest.Mocked<typeof pullRequestAPI>;

describe('Insights context', () => {
  beforeEach(() => {
    mockSourceCodeAPI.pairingIndex.mockResolvedValue(null);
    mockPipelineAPI.summary.mockResolvedValue({
      total_runs: 1,
      in_progress: 0,
      queued: 0,
      first_run: null,
      last_run: null,
    });
    mockPipelineAPI.deploymentFrequency.mockResolvedValue([
      {
        pipeline: 'deploy.yml',
        job: 'release',
        days: '2026-01-01',
        weeks: '2026-W01',
        months: '2026-01',
        daily_counts: 1,
        weekly_counts: 1,
        monthly_counts: 1,
        commits: '',
        links: '',
      },
    ]);
    mockPipelineAPI.jobsSummary.mockResolvedValue({ result: [] } as never);
    mockPullRequestAPI.summary.mockResolvedValue({
      result: {
        total_prs: 0,
        merged_prs: 0,
        closed_prs: 0,
        open_prs: 0,
        first_pr: null,
        last_pr: null,
      },
    } as never);
    mockPullRequestAPI.averageReviewTime.mockResolvedValue({ result: [] } as never);
  });

  it('provides filters context', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FiltersProvider>{children}</FiltersProvider>
    );
    
    const { result } = renderHook(() => useFilters(), { wrapper });
    expect(result.current.filters).toBeDefined();
  });

  it('filters context has expected properties', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FiltersProvider>{children}</FiltersProvider>
    );
    
    const { result } = renderHook(() => useFilters(), { wrapper });
    expect(result.current.filters.startDate).toBe('');
    expect(result.current.filters.endDate).toBe('');
  });

  it('renders recommendations from wrapped jobs and PR responses', async () => {
    mockPipelineAPI.jobsSummary.mockResolvedValue({
      result: [
        {
          workflow_name: '.github/workflows/ci.yml',
          job_name: 'ci',
          total_runs: 10,
          avg_duration_minutes: 8,
          success_count: 7,
          failure_count: 3,
          success_rate: 70,
          failure_rate: 30,
          rerun_count: 2,
        },
      ],
    } as never);
    mockPullRequestAPI.averageReviewTime.mockResolvedValue({
      result: [{ author: 'alice', avg_hours: 30 }],
    } as never);
    mockPullRequestAPI.summary.mockResolvedValue({
      result: {
        total_prs: 3,
        merged_prs: 2,
        closed_prs: 0,
        open_prs: 1,
        first_pr: null,
        last_pr: null,
      },
    } as never);

    const ui = await InsightsSection({ searchParams: Promise.resolve({}) });
    render(<FiltersProvider>{ui}</FiltersProvider>);

    expect(screen.getByText('Improve Pipeline Reliability')).toBeInTheDocument();
    expect(screen.getByText('Reduce Pipeline Reruns')).toBeInTheDocument();
    expect(screen.getByText('Optimize Job Duration')).toBeInTheDocument();
    expect(screen.getByText('Speed Up Code Reviews')).toBeInTheDocument();
    expect(screen.getByText('Review Open Pull Requests')).toBeInTheDocument();
  });

  it('renders pull request data frame dates from summary-created fields', async () => {
    mockPullRequestAPI.summary.mockResolvedValue({
      result: {
        total_prs: 2,
        merged_prs: 1,
        closed_prs: 1,
        open_prs: 0,
        first_pr: {
          created: '2026-01-02T00:00:00Z',
        },
        last_pr: {
          created: '2026-01-05T00:00:00Z',
        },
      },
    } as never);

    const ui = await InsightsSection({ searchParams: Promise.resolve({}) });
    render(<FiltersProvider>{ui}</FiltersProvider>);

    expect(screen.getByText('Data frame: Jan 02, 2026 to Jan 05, 2026')).toBeInTheDocument();
  });
});
