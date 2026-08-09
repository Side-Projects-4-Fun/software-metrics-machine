import React from 'react';
import { render, screen } from '@testing-library/react';
import ChangeRequestsPage from '@/app/dashboard/change-requests/page';
import { FiltersProvider } from '@/components/filters/FiltersContext';
import { LinkBuilderProvider } from '@/components/providers/LinkBuilderContext';
import { ConfigurationProvider } from '@/components/providers/ConfigurationContext';
import { changeRequestAPI } from '@/server/api';
import { DashboardConfigurationBuilder } from '../builders/builders';

jest.mock('@/server/api', () => ({
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

const mockChangeRequestAPI = changeRequestAPI as jest.Mocked<typeof changeRequestAPI>;

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
  mockChangeRequestAPI.byAuthor.mockResolvedValue({ result: [{ author: 'alice', count: 12 }, { author: 'bob', count: 8 }] });
  mockChangeRequestAPI.reviewTime.mockResolvedValue({ result: [{ author: 'alice', value: 4.5, value_formatted: '4.5 days', method: 'average' }, { author: 'bob', value: 2.1, value_formatted: '2.1 days', method: 'average' }] });
  mockChangeRequestAPI.openThroughTime.mockResolvedValue({ result: [{ date: '2026-01-01', kind: 'Opened', count: 3 }, { date: '2026-01-01', kind: 'Closed', count: 2 }] });
  mockChangeRequestAPI.openTime.mockResolvedValue({ result: [{ period: '2026-01', value: 2.3, value_formatted: '2.3 days', method: 'average' }] });
  mockChangeRequestAPI.comments.mockResolvedValue({ result: { comments_count: 3.5 } });
  mockChangeRequestAPI.summary.mockResolvedValue({ result: {
    total: 20, merged: 15, closed: 3, open: 2,
    labels: [{ label: 'bug', change_requests: 5 }],
    top_themes: [{ text: 'fix', value: 10 }],
    most_commented_change_requests: [{ number: 1, title: 'Fix bug', comments: 5 }],
  } });
  mockChangeRequestAPI.commentsByAuthor.mockResolvedValue({ result: [{ author: 'alice', count: 8 }, { author: 'bob', count: 5 }] });
  mockChangeRequestAPI.firstCommentTime.mockResolvedValue({ result: [{ author: 'alice', value: 1.2, value_formatted: '1.2 h', method: 'average', change_requests_with_comments: 10 }] });
  mockChangeRequestAPI.evaluate.mockResolvedValue({
    generatedAt: '2026-01-01T00:00:00Z',
    signals: [{ id: 'review-time', title: 'Review Time', description: 'Good', severity: 'good', category: 'review', metrics: [] }],
    summary: { totalChangeRequests: 20, mergedChangeRequests: 15, openChangeRequests: 2, commentsPerChangeRequest: 3.5, reviewHours: 3.3, reviewHours_formatted: '3.3 h', openDays: 2.3, openDays_formatted: '2.3 days', method: 'average', uniqueAuthors: 2 },
  });
}

describe('Change Requests Dashboard - User Journey', () => {
  beforeEach(() => {
    setupMockApiResponse();
  });

  it('renders the full dashboard with data-driven cards', async () => {
    const ui = await ChangeRequestsPage({ searchParams: Promise.resolve({}) });
    render(<Providers>{ui}</Providers>);

    expect(screen.getByText('Detail View')).toBeInTheDocument();
    expect(screen.getByText('Change Request Health Summary')).toBeInTheDocument();
    expect(screen.getByText('Bottleneck Analysis')).toBeInTheDocument();

    expect(screen.getByText('Change Request Statistics')).toBeInTheDocument();

    expect(screen.getAllByText('Review Time').length).toBeGreaterThan(0);
    expect(screen.getByText('Days Change Requests Remain Open')).toBeInTheDocument();

    expect(screen.getByText('Open Change Requests Through Time')).toBeInTheDocument();
    expect(screen.getByText('Change Requests by Author')).toBeInTheDocument();

    expect(screen.getByText('Who Comments The Most')).toBeInTheDocument();
    expect(screen.getByText('Time To First Comment')).toBeInTheDocument();
    expect(screen.getByText('Most Commented Change Requests')).toBeInTheDocument();

    expect(screen.getByText('Top Themes in Comments')).toBeInTheDocument();
  });

  it('handles API failure gracefully with error message', async () => {
    mockChangeRequestAPI.byAuthor.mockRejectedValue(new Error('fail'));
    mockChangeRequestAPI.reviewTime.mockRejectedValue(new Error('fail'));
    mockChangeRequestAPI.openThroughTime.mockRejectedValue(new Error('fail'));
    mockChangeRequestAPI.openTime.mockRejectedValue(new Error('fail'));
    mockChangeRequestAPI.comments.mockRejectedValue(new Error('fail'));
    mockChangeRequestAPI.summary.mockRejectedValue(new Error('fail'));
    mockChangeRequestAPI.commentsByAuthor.mockRejectedValue(new Error('fail'));
    mockChangeRequestAPI.firstCommentTime.mockRejectedValue(new Error('fail'));
    mockChangeRequestAPI.evaluate.mockRejectedValue(new Error('fail'));

    const ui = await ChangeRequestsPage({ searchParams: Promise.resolve({}) });
    render(<Providers>{ui}</Providers>);

    expect(screen.getByText('Failed to load change request detail data.')).toBeInTheDocument();
  });
});