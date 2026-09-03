import React from 'react';
import { screen } from '@testing-library/react';
import ChangeRequestsPage from '@/app/dashboard/change-requests/page';
import { changeRequestAPI } from '@/server/api';
import { DashboardConfigurationBuilder } from '../builders/builders';
import { ChangeRequestSummaryBuilder } from '../builders/api-response/change-request-summary.builder';
import { ChangeRequestEvaluationBuilder } from '../builders/api-response/change-request-evaluation.builder';
import { renderWithProviders } from '../utils/test-providers';

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

function setupMockApiResponse() {
  mockChangeRequestAPI.byAuthor.mockResolvedValue([{ author: 'alice', count: 12 }, { author: 'bob', count: 8 }]);
  mockChangeRequestAPI.reviewTime.mockResolvedValue([{ author: 'alice', value: 4.5, value_formatted: '4.5 days', method: 'average' }, { author: 'bob', value: 2.1, value_formatted: '2.1 days', method: 'average' }]);
  mockChangeRequestAPI.openThroughTime.mockResolvedValue([{ date: '2026-01-01', kind: 'Opened', count: 3 }, { date: '2026-01-01', kind: 'Closed', count: 2 }]);
  mockChangeRequestAPI.openTime.mockResolvedValue([{ period: '2026-01', value: 2.3, value_formatted: '2.3 days', method: 'average' }]);
  mockChangeRequestAPI.comments.mockResolvedValue({ comments_count: 3.5 });
  mockChangeRequestAPI.summary.mockResolvedValue(new ChangeRequestSummaryBuilder().build());
  mockChangeRequestAPI.commentsByAuthor.mockResolvedValue([{ author: 'alice', count: 8 }, { author: 'bob', count: 5 }]);
  mockChangeRequestAPI.firstCommentTime.mockResolvedValue([{ author: 'alice', value: 1.2, value_formatted: '1.2 h', method: 'average', change_requests_with_comments: 10 }]);
  mockChangeRequestAPI.evaluate.mockResolvedValue(
    new ChangeRequestEvaluationBuilder()
      .withSignals([
        {
          id: 'review-time',
          title: 'Review Time',
          description: 'Good',
          severity: 'good',
          category: 'review',
          metrics: [],
        },
      ])
      .build()
  );
}

describe('Change Requests Dashboard - User Journey', () => {
  beforeEach(() => {
    setupMockApiResponse();
  });

  it('renders the full dashboard with data-driven cards', async () => {
    const ui = await ChangeRequestsPage({ searchParams: Promise.resolve({}) });
    renderWithProviders(ui, { config: mockConfig });

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
    renderWithProviders(ui, { config: mockConfig });

    expect(screen.getByText('Failed to load change request detail data.')).toBeInTheDocument();
  });
});