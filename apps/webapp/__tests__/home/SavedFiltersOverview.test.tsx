import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SavedFiltersOverview from '@/components/home/SavedFiltersOverview';
import { defaultFilters } from '@/components/filters/DashboardFilters';
import { ProjectsProvider } from '@/components/providers/ProjectsContext';

function renderSavedFiltersOverview() {
  return render(
    <ProjectsProvider
      projects={[
        { github_repository: 'owner/repo-a' },
        { github_repository: 'owner/repo-b' },
      ]}
      initialActiveProject="owner/repo-a"
    >
      <SavedFiltersOverview />
    </ProjectsProvider>,
  );
}

describe('SavedFiltersOverview', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('groups saved filters by project and page with direct links', async () => {
    window.localStorage.setItem('smm.saved-filters', JSON.stringify({
      version: 1,
      filters: [
        {
          id: 'insights-filter',
          name: 'Team Alpha',
          section: 'insights',
          pathname: '/dashboard/insights',
          filters: {
            ...defaultFilters,
            startDate: '2024-01-01',
            endDate: '2024-01-31',
            typeChurn: 'commits',
            aggregateMetric: 'sum',
          },
          repository: 'owner/repo-a',
          createdAt: '2026-06-18T10:00:00.000Z',
        },
        {
          id: 'pipeline-filter',
          name: 'Release Jobs',
          section: 'pipelines',
          pathname: '/dashboard/pipelines',
          filters: {
            ...defaultFilters,
            workflowSelector: 'release.yml',
            workflowStatus: ['completed'],
            typeChurn: 'commits',
            aggregateMetric: 'sum',
          },
          repository: 'owner/repo-a',
          createdAt: '2026-06-18T09:00:00.000Z',
        },
        {
          id: 'source-code-filter',
          name: 'Hotspots',
          section: 'source-code',
          pathname: '/dashboard/source-code',
          filters: {
            ...defaultFilters,
            ignorePatternFiles: 'dist/**',
            includePatternFiles: 'src/**',
            typeChurn: 'commits',
            aggregateMetric: 'sum',
          },
          repository: 'owner/repo-b',
          createdAt: '2026-06-18T08:00:00.000Z',
        },
      ],
    }));

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

    expect(insightsLink).toHaveAttribute('href', '/dashboard/insights?startDate=2024-01-01&endDate=2024-01-31&aggregateMetric=sum&topEntries=20&typeChurn=commits&aggregateBy=week&weekends=include&outlierMode=include&sonarqubeRemoveFolders=true');
    expect(pipelinesLink).toHaveAttribute('href', '/dashboard/pipelines?workflowSelector=release.yml&workflowStatus=completed&aggregateMetric=sum&topEntries=20&typeChurn=commits&aggregateBy=week&weekends=include&outlierMode=include&sonarqubeRemoveFolders=true');
    expect(sourceCodeLink).toHaveAttribute('href', '/dashboard/source-code?aggregateMetric=sum&ignorePatternFiles=dist%2F**&includePatternFiles=src%2F**&topEntries=20&typeChurn=commits&aggregateBy=week&weekends=include&outlierMode=include&sonarqubeRemoveFolders=true');
  });

  it('selects the saved filter project before opening it', async () => {
    document.cookie = 'smm_active_project=owner%2Frepo-a;path=/;max-age=31536000';
    window.localStorage.setItem('smm.saved-filters', JSON.stringify({
      version: 1,
      filters: [
        {
          id: 'source-code-filter',
          name: 'Repo B Hotspots',
          section: 'source-code',
          pathname: '/dashboard/source-code',
          filters: {
            ...defaultFilters,
            ignorePatternFiles: 'dist/**',
            includePatternFiles: 'src/**',
            typeChurn: 'commits',
            aggregateMetric: 'sum',
          },
          repository: 'owner/repo-b',
          createdAt: '2026-06-18T08:00:00.000Z',
        },
      ],
    }));

    renderSavedFiltersOverview();

    const savedFilterLink = await screen.findByRole('link', { name: /Repo B Hotspots/i });
    savedFilterLink.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(savedFilterLink);

    expect(document.cookie).toContain('smm_active_project=owner%2Frepo-b');
  });

  it('renders the empty state when there are no saved filters', async () => {
    renderSavedFiltersOverview();

    await waitFor(() => {
      expect(screen.getByText('Saved Views')).toBeInTheDocument();
    });
    expect(screen.getByText('Save filters from any dashboard page and your shortcuts will appear here.')).toBeInTheDocument();
  });
});
