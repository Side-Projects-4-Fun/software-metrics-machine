import React from "react";
import { render, screen } from "@testing-library/react";
import PullRequestsPage from "@/app/dashboard/pull-requests/page";
import { FiltersProvider } from "@/components/filters/FiltersContext";
import { LinkBuilderProvider } from "@/components/providers/LinkBuilderContext";
import { ConfigurationProvider } from "@/components/providers/ConfigurationContext";
import { pullRequestAPI } from "@/server/api";
import type { DashboardGlobalConfiguration } from "@/server/api/configuration";

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  usePathname: jest.fn(() => '/dashboard/pull-requests'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(() => undefined),
  })),
}));

jest.mock('@/server/api', () => ({
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

const mockPRAPI = pullRequestAPI as jest.Mocked<typeof pullRequestAPI>;

const mockConfig: DashboardGlobalConfiguration = {
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
};

function Providers({ children }: { children: React.ReactNode }) {
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

function setupMockApiResponse() {
  mockPRAPI.byAuthor.mockResolvedValue({ result: [{ author: 'alice', count: 12 }, { author: 'bob', count: 8 }] } as never);
  mockPRAPI.averageReviewTime.mockResolvedValue({ result: [{ author: 'alice', avg_hours: 4.5 }, { author: 'bob', avg_hours: 2.1 }] } as never);
  mockPRAPI.openThroughTime.mockResolvedValue({ result: [{ date: '2026-01-01', kind: 'Opened', count: 3 }, { date: '2026-01-01', kind: 'Closed', count: 2 }] } as never);
  mockPRAPI.averageOpenBy.mockResolvedValue({ result: [{ period: '2026-01', avg_days: 2.3 }] } as never);
  mockPRAPI.averageComments.mockResolvedValue({ result: { avg_comments: 3.5 } } as never);
  mockPRAPI.summary.mockResolvedValue({ result: {
    total: 20, merged: 15, closed: 3, open: 2,
    labels: [{ label: 'bug', prs: 5 }],
    top_themes: [{ text: 'fix', value: 10 }],
    most_commented_prs: [{ number: 1, title: 'Fix bug', comments: 5 }],
  } } as never);
  mockPRAPI.commentsByAuthor.mockResolvedValue({ result: [{ author: 'alice', count: 8 }, { author: 'bob', count: 5 }] } as never);
  mockPRAPI.firstCommentTime.mockResolvedValue({ result: [{ author: 'alice', avg_hours: 1.2, prs_with_comments: 10 }] } as never);
  mockPRAPI.evaluate.mockResolvedValue({
    generatedAt: '2026-01-01T00:00:00Z',
    signals: [{ id: 'review-time', title: 'Review Time', description: 'Good', severity: 'good', category: 'review', metrics: [] }],
    summary: { totalPRs: 20, mergedPRs: 15, openPRs: 2, avgCommentsPerPR: 3.5, avgReviewHours: 3.3, avgOpenDays: 2.3, uniqueAuthors: 2 },
  } as never);
}

describe('Pull Requests Dashboard - User Journey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockApiResponse();
  });

  it('renders the full dashboard with data-driven cards', async () => {
    const ui = await PullRequestsPage({ searchParams: Promise.resolve({}) });
    render(<Providers>{ui}</Providers>);

    // Evaluation and detail view section should be present
    expect(screen.getByText('Detail View')).toBeInTheDocument();
    expect(screen.getByText('PR Health Summary')).toBeInTheDocument();
    expect(screen.getByText('Bottleneck Analysis')).toBeInTheDocument();

    // Statistics card shows totals
    expect(screen.getByText('PR Statistics')).toBeInTheDocument();

    // Review time metrics
    expect(screen.getByText('Average Review Time')).toBeInTheDocument();
    expect(screen.getByText('Days PRs Remain Open')).toBeInTheDocument();

    // Through-time and distribution views
    expect(screen.getByText('Open PRs Through Time')).toBeInTheDocument();
    expect(screen.getByText('PRs by Author')).toBeInTheDocument();

    // Comment analysis
    expect(screen.getByText('Who Comments The Most')).toBeInTheDocument();
    expect(screen.getByText('Time To First Comment')).toBeInTheDocument();
    expect(screen.getByText('Most Commented Pull Requests')).toBeInTheDocument();

    // Theme analysis
    expect(screen.getByText('Top Themes in Comments')).toBeInTheDocument();
  });

  it('handles API failure gracefully with error message', async () => {
    mockPRAPI.byAuthor.mockRejectedValue(new Error('fail'));
    mockPRAPI.averageReviewTime.mockRejectedValue(new Error('fail'));
    mockPRAPI.openThroughTime.mockRejectedValue(new Error('fail'));
    mockPRAPI.averageOpenBy.mockRejectedValue(new Error('fail'));
    mockPRAPI.averageComments.mockRejectedValue(new Error('fail'));
    mockPRAPI.summary.mockRejectedValue(new Error('fail'));
    mockPRAPI.commentsByAuthor.mockRejectedValue(new Error('fail'));
    mockPRAPI.firstCommentTime.mockRejectedValue(new Error('fail'));
    mockPRAPI.evaluate.mockRejectedValue(new Error('fail'));

    const ui = await PullRequestsPage({ searchParams: Promise.resolve({}) });
    render(<Providers>{ui}</Providers>);

    expect(screen.getByText('Failed to load PR detail data.')).toBeInTheDocument();
  });
});
