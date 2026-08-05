import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { FiltersProvider } from '@/components/filters/FiltersContext';
import FiltersContainer from '@/components/filters/FiltersContainer';
import * as api from '@/server/api';
import { DashboardFiltersBuilder } from '../builders/builders';

const navigation = jest.requireMock('next/navigation');

jest.mock('@/server/api');

const mockPipelineAPI = api.pipelineAPI as jest.Mocked<typeof api.pipelineAPI>;
const mockPullRequestAPI = api.pullRequestAPI as jest.Mocked<typeof api.pullRequestAPI>;
const mockSourceCodeAPI = api.sourceCodeAPI as jest.Mocked<typeof api.sourceCodeAPI>;
const mockFetchAPI = api.fetchAPI as jest.Mock;

const FiltersContainerWithProvider = () => (
  <FiltersProvider>
    <FiltersContainer repository="test/repository" />
  </FiltersProvider>
);

describe('FiltersContainer', () => {
  beforeEach(() => {
    navigation.usePathname.mockReturnValue('/');
    navigation.useSearchParams.mockReturnValue(new URLSearchParams());

    mockFetchAPI.mockResolvedValue({ version: 1, filters: [] });

    mockPipelineAPI.getFilterOptions = jest.fn().mockResolvedValue({
      workflows: [
        { name: 'workflow-1', path: 'path/1' },
        { name: 'workflow-2', path: 'path/2' },
      ],
      statuses: ['completed', 'in_progress', 'queued'],
      conclusions: ['success', 'failure', 'cancelled', 'timed_out'],
      branches: ['main', 'develop', 'staging'],
      events: ['push', 'pull_request', 'schedule'],
      jobs: [{ name: 'build', id: 'build' }],
    });
    mockPullRequestAPI.getFilterOptions = jest.fn().mockResolvedValue({
      authors: ['alice'],
      labels: ['bug'],
    });
    mockSourceCodeAPI.getAuthors = jest.fn().mockResolvedValue(['alice']);
  });

  it('shows saved filter as selected when URL filters match a saved option', async () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const savedFilters = new DashboardFiltersBuilder()
      .withTimezone(timezone)
      .withStartDate('2024-01-01')
      .withWorkflowStatus(['completed'])
      .build();

    mockFetchAPI.mockResolvedValue({
      version: 1,
      filters: [
        {
          id: 'saved-filter-1',
          name: 'Last Completed Pipelines',
          section: 'insights',
          pathname: '/dashboard/insights',
          repository: 'test/repository',
          createdAt: '2026-07-11T00:00:00.000Z',
          filters: savedFilters,
        },
      ],
    });

    navigation.usePathname.mockReturnValue('/dashboard/insights');
    navigation.useSearchParams.mockReturnValue(new URLSearchParams('startDate=2024-01-01&workflowStatus=completed'));

    render(<FiltersContainerWithProvider />);

    await waitFor(() => {
      expect(screen.getByLabelText('Saved Filters')).toHaveValue('Last Completed Pipelines');
    });
  });

  it('keeps pipelines saved filter selected when PR-only filters change', async () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const savedFilters = new DashboardFiltersBuilder()
      .withTimezone(timezone)
      .withStartDate('2024-01-01')
      .withWorkflowStatus(['completed'])
      .build();

    mockFetchAPI.mockResolvedValue({
      version: 1,
      filters: [
        {
          id: 'saved-filter-2',
          name: 'Pipelines Baseline',
          section: 'pipelines',
          pathname: '/dashboard/pipelines',
          repository: 'test/repository',
          createdAt: '2026-07-11T00:00:00.000Z',
          filters: savedFilters,
        },
      ],
    });

    navigation.usePathname.mockReturnValue('/dashboard/pipelines');
    navigation.useSearchParams.mockReturnValue(
      new URLSearchParams('startDate=2024-01-01&workflowStatus=completed&authorSelect=alice')
    );

    render(<FiltersContainerWithProvider />);

    await waitFor(() => {
      expect(screen.getByLabelText('Saved Filters')).toHaveValue('Pipelines Baseline');
    });
  });

  it('renders filters section', () => {
    render(<FiltersContainerWithProvider />);
    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByLabelText('Saved Filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Filter' })).toBeEnabled();
  });

  it('renders without crashing', () => {
    render(<FiltersContainerWithProvider />);
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });
});
