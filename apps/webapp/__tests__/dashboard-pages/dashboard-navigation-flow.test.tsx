import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardLayout from '@/app/dashboard/layout';
import PipelinesPage from '@/app/dashboard/pipelines/page';
import ChangeRequestsPage from '@/app/dashboard/change-requests/page';
import {
  DashboardConfigurationBuilder,
} from '../builders/builders';
import { ChangeRequestSummaryBuilder } from '../builders/api-response/change-request-summary.builder';
import { PipelineDashboardBuilder } from '../builders/api-response/pipeline-dashboard.builder';
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
  changeRequestAPI: {
    byAuthor: jest.fn(),
    reviewTime: jest.fn(),
    openThroughTime: jest.fn(),
    openTime: jest.fn(),
    comments: jest.fn(),
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

import { configurationAPI, projectsAPI, pipelineAPI, changeRequestAPI } from '@/server/api';

const mockConfigAPI = configurationAPI as jest.Mocked<typeof configurationAPI>;
const mockProjectsAPI = projectsAPI as jest.Mocked<typeof projectsAPI>;

const mockPipeline = pipelineAPI as jest.Mocked<typeof pipelineAPI>;
const mockPRAPI = changeRequestAPI as jest.Mocked<typeof changeRequestAPI>;

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

    mockPipeline.dashboard.mockResolvedValue(
      new PipelineDashboardBuilder().build()
    );
    mockPipeline.evaluate.mockResolvedValue({
      generatedAt: '2026-01-01T00:00:00Z',
      signals: [{ id: 'stability', title: 'Stability', description: 'Good', severity: 'good', category: 'stability', metrics: [] }],
      summary: { totalRuns: 100, durationMinutes: 2.5, durationMinutes_formatted: '2.5 min', method: 'average', successRate: 80, failureRate: 20, totalReruns: 3 },
    });

    mockPRAPI.byAuthor.mockResolvedValue([{ author: 'alice', count: 12 }]);
    mockPRAPI.reviewTime.mockResolvedValue([{ author: 'alice', value: 4.5, value_formatted: '4.5 days', method: 'average' }]);
    mockPRAPI.openThroughTime.mockResolvedValue([{ date: '2026-01-01', kind: 'Opened', count: 3 }]);
    mockPRAPI.openTime.mockResolvedValue([{ period: '2026-01', value: 2.3, value_formatted: '2.3 days', method: 'average' }]);
    mockPRAPI.comments.mockResolvedValue({ comments_count: 3.5 });
    mockPRAPI.summary.mockResolvedValue(new ChangeRequestSummaryBuilder().build());
    mockPRAPI.commentsByAuthor.mockResolvedValue([{ author: 'alice', count: 8 }]);
    mockPRAPI.firstCommentTime.mockResolvedValue([{ author: 'alice', value: 1.2, value_formatted: '1.2 h', method: 'average', change_requests_with_comments: 10 }]);
    mockPRAPI.evaluate.mockResolvedValue({
      generatedAt: '2026-01-01T00:00:00Z',
      signals: [{ id: 'review-time', title: 'Review Time', description: 'Good', severity: 'good', category: 'review', metrics: [] }],
      summary: { totalChangeRequests: 20, mergedChangeRequests: 15, openChangeRequests: 2, commentsPerChangeRequest: 3.5, reviewHours: 3.3, reviewHours_formatted: '3.3 h', openDays: 2.3, openDays_formatted: '2.3 days', method: 'average', uniqueAuthors: 2 },
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

  it('renders change requests dashboard with data', async () => {
    const config = new DashboardConfigurationBuilder().build();

    const ui = await ChangeRequestsPage({ searchParams: Promise.resolve({}) });
    renderWithProviders(ui, { config });

    await waitFor(() => {
      expect(screen.getByText('Change Request Health Summary')).toBeInTheDocument();
    });

    expect(screen.getByText('Bottleneck Analysis')).toBeInTheDocument();
    expect(screen.getByText('Change Request Statistics')).toBeInTheDocument();
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

    const prTab = screen.getByRole('tab', { name: /Change Requests/i });
    
    await expect(userEvent.click(prTab)).resolves.not.toThrow();
  });

  it('dashboard layout renders all navigation tabs', async () => {
    const config = new DashboardConfigurationBuilder().build();

    const layout = await DashboardLayout({ children: <div>Dashboard Content</div> });
    renderWithProviders(layout, { config });

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Insights/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Pipelines/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Change Requests/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Source Code/i })).toBeInTheDocument();
    });
  });
});
