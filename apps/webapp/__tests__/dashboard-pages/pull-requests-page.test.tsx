import React from 'react';
import { render, screen } from '@testing-library/react';
import PullRequestsPage from '@/app/dashboard/pull-requests/page';
import { FiltersProvider } from '@/components/filters/FiltersContext';
import { LinkBuilderProvider } from '@/components/providers/LinkBuilderContext';
import { ConfigurationProvider } from '@/components/providers/ConfigurationContext';
import { pullRequestAPI } from '@/server/api';
import { DashboardConfigurationBuilder } from '../builders/builders';

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

const mockConfig = new DashboardConfigurationBuilder().build();

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

function setupMockApiResponse() {
  mockPRAPI.byAuthor.mockResolvedValue({ result: [{ author: 'alice', count: 12 }, { author: 'bob', count: 8 }] });
  mockPRAPI.averageReviewTime.mockResolvedValue({ result: [{ author: 'alice', value: 4.5, value_formatted: '4.5 days', method: 'average' }, { author: 'bob', value: 2.1, value_formatted: '2.1 days', method: 'average' }] });
  mockPRAPI.openThroughTime.mockResolvedValue({ result: [{ date: '2026-01-01', kind: 'Opened', count: 3 }, { date: '2026-01-01', kind: 'Closed', count: 2 }] });
  mockPRAPI.averageOpenBy.mockResolvedValue({ result: [{ period: '2026-01', value: 2.3, value_formatted: '2.3 days', method: 'average' }] });
  mockPRAPI.averageComments.mockResolvedValue({ result: { avg_comments: 3.5 } });
  mockPRAPI.summary.mockResolvedValue({ result: {
    total: 20, merged: 15, closed: 3, open: 2,
    labels: [{ label: 'bug', prs: 5 }],
    top_themes: [{ text: 'fix', value: 10 }],
    most_commented_prs: [{ number: 1, title: 'Fix bug', comments: 5 }],
  } });
  mockPRAPI.commentsByAuthor.mockResolvedValue({ result: [{ author: 'alice', count: 8 }, { author: 'bob', count: 5 }] });
  mockPRAPI.firstCommentTime.mockResolvedValue({ result: [{ author: 'alice', value: 1.2, value_formatted: '1.2 h', method: 'average', prs_with_comments: 10 }] });
  mockPRAPI.evaluate.mockResolvedValue({
    generatedAt: '2026-01-01T00:00:00Z',
    signals: [{ id: 'review-time', title: 'Review Time', description: 'Good', severity: 'good', category: 'review', metrics: [] }],
    summary: { totalPRs: 20, mergedPRs: 15, openPRs: 2, avgCommentsPerPR: 3.5, reviewHours: 3.3, reviewHours_formatted: '3.3 h', openDays: 2.3, openDays_formatted: '2.3 days', method: 'average', uniqueAuthors: 2 },
  });
}

describe('Pull Requests Dashboard - User Journey', () => {
  beforeEach(() => {
    setupMockApiResponse();
  });

  it('renders the full dashboard with data-driven cards', async () => {
    const ui = await PullRequestsPage({ searchParams: Promise.resolve({}) });
    render(<Providers>{ui}</Providers>);

    expect(screen.getByText('Detail View')).toBeInTheDocument();
    expect(screen.getByText('PR Health Summary')).toBeInTheDocument();
    expect(screen.getByText('Bottleneck Analysis')).toBeInTheDocument();

    expect(screen.getByText('PR Statistics')).toBeInTheDocument();

    expect(screen.getByText('Average Review Time')).toBeInTheDocument();
    expect(screen.getByText('Days PRs Remain Open')).toBeInTheDocument();

    expect(screen.getByText('Open PRs Through Time')).toBeInTheDocument();
    expect(screen.getByText('PRs by Author')).toBeInTheDocument();

    expect(screen.getByText('Who Comments The Most')).toBeInTheDocument();
    expect(screen.getByText('Time To First Comment')).toBeInTheDocument();
    expect(screen.getByText('Most Commented Pull Requests')).toBeInTheDocument();

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
