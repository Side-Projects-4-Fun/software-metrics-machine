import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FiltersContainer from '@/components/filters/FiltersContainer';
import * as api from '@/server/api';
import { DashboardFiltersBuilder } from '../builders/builders';
import { renderWithProviders } from '../utils/test-providers';

const navigation = jest.requireMock('next/navigation');

jest.mock('@/server/api');

const mockPipelineAPI = api.pipelineAPI as jest.Mocked<typeof api.pipelineAPI>;
const mockChangeRequestAPI = api.changeRequestAPI as jest.Mocked<typeof api.changeRequestAPI>;
const mockSourceCodeAPI = api.sourceCodeAPI as jest.Mocked<typeof api.sourceCodeAPI>;
const mockFetchAPI = api.fetchAPI as jest.Mock;

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
    mockChangeRequestAPI.getFilterOptions = jest.fn().mockResolvedValue({
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

    renderWithProviders(<FiltersContainer repository="test/repository" />);

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

    renderWithProviders(<FiltersContainer repository="test/repository" />);

    await waitFor(() => {
      expect(screen.getByLabelText('Saved Filters')).toHaveValue('Pipelines Baseline');
    });
  });

  it('renders filters section', () => {
    renderWithProviders(<FiltersContainer repository="test/repository" />);
    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByLabelText('Saved Filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Filter' })).toBeEnabled();
  });

  it('renders without crashing', () => {
    renderWithProviders(<FiltersContainer repository="test/repository" />);
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('opens a fresh Save Filter dialog each time (no leaked input across opens)', async () => {
    renderWithProviders(<FiltersContainer repository="test/repository" />);

    await userEvent.click(screen.getByRole('button', { name: 'Save Filter' }));

    const nameInput = (await screen.findByLabelText('Filter name')) as HTMLInputElement;
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'My Filter');
    expect(nameInput.value).toBe('My Filter');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Save Filter' }));
    const reopenedInput = (await screen.findByLabelText('Filter name')) as HTMLInputElement;
    expect(reopenedInput.value).toBe('');
  });
});
