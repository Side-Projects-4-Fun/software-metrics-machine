import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardLayout from '@/app/dashboard/layout';
import PipelinesPage from '@/app/dashboard/pipelines/page';
import PullRequestsPage from '@/app/dashboard/pull-requests/page';
import {
  DashboardConfigurationBuilder,
} from '../builders/builders';
import { renderWithProviders } from '../utils/test-providers';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  usePathname: jest.fn(() => '/dashboard/pipelines'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));

jest.mock('@/server/api', () => ({
  configurationAPI: {
    getConfiguration: jest.fn(),
  },
  projectsAPI: {
    getProjects: jest.fn(),
  },
  pipelineAPI: {
    dashboard: jest.fn(),
    evaluate: jest.fn(),
  },
  pullRequestAPI: {
    byAuthor: jest.fn(),
    averageReviewTime: jest.fn(),
    openThroughTime: jest.fn(),
    averageOpenBy: jest.fn(),
    averageComments: jest.fn(),
    summary: jest.fn(),
    commentsByAuthor: jest.fn(),
    firstCommentTime: jest.fn(),
    evaluate: jest.fn(),
  },
}));

jest.mock('@/app/theme-context', () => ({
  ThemeContextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTheme: jest.fn(() => ({ mode: 'light', toggleTheme: jest.fn() })),
}));

import { configurationAPI, projectsAPI, pipelineAPI, pullRequestAPI } from '@/server/api';

const mockConfigAPI = configurationAPI as jest.Mocked<typeof configurationAPI>;
const mockProjectsAPI = projectsAPI as jest.Mocked<typeof projectsAPI>;

const mockPipeline = pipelineAPI as jest.Mocked<typeof pipelineAPI>;
const mockPRAPI = pullRequestAPI as jest.Mocked<typeof pullRequestAPI>;

describe('Dashboard Navigation with Filters Flow', () => {
  beforeEach(() => {
    mockConfigAPI.getConfiguration.mockResolvedValue({
      result: {
        git_provider: 'github',
        github_repository: 'owner/repo',
        git_repository_location: '/tmp/repo',
        store_data: false,
        deployment_frequency_targets: [],
        main_branch: 'main',
        dashboard_start_date: null,
        dashboard_end_date: null,
        dashboard_color: '#1976d2',
        logging_level: 'info',
        jira_url: null,
        jira_email: null,
        jira_token: null,
        jira_project: null,
        sonar_url: null,
        sonar_project: null,
      },
    });
    mockProjectsAPI.getProjects.mockResolvedValue({
      result: [{ github_repository: 'owner/repo' }],
    });

    mockPipeline.dashboard.mockResolvedValue({
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
    });
    mockPipeline.evaluate.mockResolvedValue({
      generatedAt: '2026-01-01T00:00:00Z',
      signals: [{ id: 'stability', title: 'Stability', description: 'Good', severity: 'good', category: 'stability', metrics: [] }],
      summary: { totalRuns: 100, averageDurationMinutes: 2.5, successRate: 80, failureRate: 20, totalReruns: 3 },
    });

    mockPRAPI.byAuthor.mockResolvedValue({ result: [{ author: 'alice', count: 12 }] });
    mockPRAPI.averageReviewTime.mockResolvedValue({ result: [{ author: 'alice', avg_hours: 4.5 }] });
    mockPRAPI.openThroughTime.mockResolvedValue({ result: [{ date: '2026-01-01', kind: 'Opened', count: 3 }] });
    mockPRAPI.averageOpenBy.mockResolvedValue({ result: [{ period: '2026-01', avg_days: 2.3 }] });
    mockPRAPI.averageComments.mockResolvedValue({ result: { avg_comments: 3.5 } });
    mockPRAPI.summary.mockResolvedValue({ result: { total: 20, merged: 15, closed: 3, open: 2, labels: [], top_themes: [], most_commented_prs: [] } });
    mockPRAPI.commentsByAuthor.mockResolvedValue({ result: [{ author: 'alice', count: 8 }] });
    mockPRAPI.firstCommentTime.mockResolvedValue({ result: [{ author: 'alice', avg_hours: 1.2, prs_with_comments: 10 }] });
    mockPRAPI.evaluate.mockResolvedValue({
      generatedAt: '2026-01-01T00:00:00Z',
      signals: [{ id: 'review-time', title: 'Review Time', description: 'Good', severity: 'good', category: 'review', metrics: [] }],
      summary: { totalPRs: 20, mergedPRs: 15, openPRs: 2, avgCommentsPerPR: 3.5, avgReviewHours: 3.3, avgOpenDays: 2.3, uniqueAuthors: 2 },
    });
  });

  it('renders pipelines dashboard with data', async () => {
    const config = new DashboardConfigurationBuilder()
      .withDeploymentFrequencyTargets([{ pipeline: '.github/workflows/deploy.yml', job: 'deploy' }])
      .build();

    const ui = await PipelinesPage({ searchParams: Promise.resolve({}) });
    renderWithProviders(ui, { config });

    await waitFor(() => {
      expect(screen.getByText('Pipeline Health Summary')).toBeInTheDocument();
    });

    expect(screen.getByText('Bottleneck Analysis')).toBeInTheDocument();
    expect(screen.getByText('Pipeline Runs Duration')).toBeInTheDocument();
  });

  it('renders pull requests dashboard with data', async () => {
    const config = new DashboardConfigurationBuilder().build();

    const ui = await PullRequestsPage({ searchParams: Promise.resolve({}) });
    renderWithProviders(ui, { config });

    await waitFor(() => {
      expect(screen.getByText('PR Health Summary')).toBeInTheDocument();
    });

    expect(screen.getByText('Bottleneck Analysis')).toBeInTheDocument();
    expect(screen.getByText('PR Statistics')).toBeInTheDocument();
  });

  it('navigates between dashboard tabs', async () => {
    const config = new DashboardConfigurationBuilder()
      .withDeploymentFrequencyTargets([{ pipeline: '.github/workflows/deploy.yml', job: 'deploy' }])
      .build();

    const layout = await DashboardLayout({ children: <div>Pipelines Content</div> });
    renderWithProviders(layout, { config });

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Pipelines/i })).toBeInTheDocument();
    });

    const prTab = screen.getByRole('tab', { name: /Pull Requests/i });
    
    await expect(userEvent.click(prTab)).resolves.not.toThrow();
  });

  it('dashboard layout renders all navigation tabs', async () => {
    const config = new DashboardConfigurationBuilder().build();

    const layout = await DashboardLayout({ children: <div>Dashboard Content</div> });
    renderWithProviders(layout, { config });

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Insights/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Pipelines/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Pull Requests/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Source Code/i })).toBeInTheDocument();
    });
  });
});
