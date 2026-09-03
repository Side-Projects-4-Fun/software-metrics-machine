import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SavedFiltersOverview from '@/components/home/SavedFiltersOverview';
import * as api from '@/server/api';
import { SavedFilterBuilder } from '../builders/builders';
import { renderWithProviders } from '../utils/test-providers';

jest.mock('@/server/api');

const mockFetchAPI = api.fetchAPI as jest.Mock;

function renderSavedFiltersOverview() {
  return renderWithProviders(<SavedFiltersOverview />, {
    projects: [
      { github_repository: 'owner/repo-a' },
      { github_repository: 'owner/repo-b' },
    ],
    initialActiveProject: 'owner/repo-a',
  });
}

describe('SavedFiltersOverview', () => {
  beforeEach(() => {
    mockFetchAPI.mockResolvedValue({ version: 1, filters: [] });
  });

  it('groups saved filters by project and page with direct links', async () => {
    const insightsFilter = new SavedFilterBuilder()
      .withId('insights-filter')
      .withName('Team Alpha')
      .withSection('insights')
      .withFilters({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        typeChurn: 'commits',
        aggregateMetric: 'sum',
      })
      .withRepository('owner/repo-a')
      .withCreatedAt('2026-06-18T10:00:00.000Z')
      .build();

    const pipelineFilter = new SavedFilterBuilder()
      .withId('pipeline-filter')
      .withName('Release Jobs')
      .withSection('pipelines')
      .withFilters({
        workflowSelector: 'release.yml',
        workflowStatus: ['completed'],
        typeChurn: 'commits',
        aggregateMetric: 'sum',
      })
      .withRepository('owner/repo-a')
      .withCreatedAt('2026-06-18T09:00:00.000Z')
      .build();

    const sourceCodeFilter = new SavedFilterBuilder()
      .withId('source-code-filter')
      .withName('Hotspots')
      .withSection('source-code')
      .withFilters({
        ignorePatternFiles: 'dist/**',
        includePatternFiles: 'src/**',
        typeChurn: 'commits',
        aggregateMetric: 'sum',
      })
      .withRepository('owner/repo-b')
      .withCreatedAt('2026-06-18T08:00:00.000Z')
      .build();

    mockFetchAPI.mockResolvedValue({
      version: 1,
      filters: [insightsFilter, pipelineFilter, sourceCodeFilter],
    });

    renderSavedFiltersOverview();

    await waitFor(() => {
      expect(screen.getByText('owner/repo-a')).toBeInTheDocument();
    });

    expect(screen.getByText('owner/repo-b')).toBeInTheDocument();
    expect(screen.getByText('Insights')).toBeInTheDocument();
    expect(screen.getByText('Pipelines')).toBeInTheDocument();
    expect(screen.getByText('Source Code')).toBeInTheDocument();

    const insightsLink = screen.getByRole('link', { name: /Team Alpha/i });
    const pipelinesLink = screen.getByRole('link', { name: /Release Jobs/i });
    const sourceCodeLink = screen.getByRole('link', { name: /Hotspots/i });

    expect(insightsLink).toHaveAttribute('href', '/dashboard/insights?startDate=2024-01-01&endDate=2024-01-31&aggregateMetric=sum&topEntries=20&typeChurn=commits&aggregateBy=week&weekends=include&outlierMode=include&sonarqubeRemoveFolders=true&method=average');
    expect(pipelinesLink).toHaveAttribute('href', '/dashboard/pipelines?workflowSelector=release.yml&workflowStatus=completed&aggregateMetric=sum&topEntries=20&typeChurn=commits&aggregateBy=week&weekends=include&outlierMode=include&sonarqubeRemoveFolders=true&method=average');
    expect(sourceCodeLink).toHaveAttribute('href', '/dashboard/source-code?aggregateMetric=sum&ignorePatternFiles=dist%2F**&includePatternFiles=src%2F**&topEntries=20&typeChurn=commits&aggregateBy=week&weekends=include&outlierMode=include&sonarqubeRemoveFolders=true&method=average');
  });

  it('selects the saved filter project before opening it', async () => {
    document.cookie = 'smm_active_project=owner%2Frepo-a;path=/;max-age=31536000';

    const sourceCodeFilter = new SavedFilterBuilder()
      .withId('source-code-filter')
      .withName('Repo B Hotspots')
      .withSection('source-code')
      .withFilters({
        ignorePatternFiles: 'dist/**',
        includePatternFiles: 'src/**',
        typeChurn: 'commits',
        aggregateMetric: 'sum',
      })
      .withRepository('owner/repo-b')
      .withCreatedAt('2026-06-18T08:00:00.000Z')
      .build();

    mockFetchAPI.mockResolvedValue({
      version: 1,
      filters: [sourceCodeFilter],
    });

    renderSavedFiltersOverview();

    const savedFilterLink = await screen.findByRole('link', { name: /Repo B Hotspots/i });
    savedFilterLink.addEventListener('click', (event) => event.preventDefault());
    await userEvent.click(savedFilterLink);

    expect(document.cookie).toContain('smm_active_project=owner%2Frepo-b');
  });

  it('renders the empty state when there are no saved filters', async () => {
    mockFetchAPI.mockResolvedValue({ version: 1, filters: [] });

    renderSavedFiltersOverview();

    await waitFor(() => {
      expect(screen.getByText('Saved Views')).toBeInTheDocument();
    });
    expect(screen.getByText('Save filters from any dashboard page and your shortcuts will appear here.')).toBeInTheDocument();
  });
});
