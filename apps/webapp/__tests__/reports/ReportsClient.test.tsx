import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReportsClient from '@/components/reports/ReportsClient';
import * as savedFiltersActions from '@/components/filters/saved-filters-actions';

jest.mock('@/components/filters/saved-filters-actions');

const mockRemoveReport = savedFiltersActions.removeReport as jest.Mock;
const mockGetSavedFiltersBySection = savedFiltersActions.getSavedFiltersBySection as jest.Mock;

function makeReport(
  name: string,
  id: string,
  sections: Array<{ section: 'pipelines' | 'pull-requests' | 'source-code' | 'architecture' | 'sonarqube'; savedFilterId: string }> = [],
) {
  return {
    id,
    name,
    repository: 'owner/repo',
    sections,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('ReportsClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSavedFiltersBySection.mockResolvedValue([]);
  });

  it('renders empty state when no reports exist', () => {
    render(
      <ReportsClient
        resolvedReports={[]}
        repository="owner/repo"
      />,
    );

    expect(screen.getByText('Reports')).toBeVisible();
    expect(
      screen.getByText(/No reports yet/),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: /New Report/ }),
    ).toBeVisible();
  });

  it('renders resolved reports as a list with links to detail pages', () => {
    render(
      <ReportsClient
        resolvedReports={[
          { report: makeReport('Report 42', 'r1'), windows: [] },
        ]}
        repository="owner/repo"
      />,
    );

    expect(screen.getByText('Report 42')).toBeVisible();

    const reportLinks = screen.getAllByRole('link', { name: /Report 42/ });
    const detailLink = reportLinks.find(
      (link) => link.getAttribute('href') === '/reports/r1',
    );
    expect(detailLink).toBeDefined();
  });

  it('shows section count and creation date for each report', () => {
    render(
      <ReportsClient
        resolvedReports={[
          {
            report: makeReport('Report 42', 'r1', [
              { section: 'pipelines' as const, savedFilterId: 'f1' },
              { section: 'pull-requests' as const, savedFilterId: 'f2' },
            ]),
            windows: [],
          },
        ]}
        repository="owner/repo"
      />,
    );

    expect(screen.getByText(/2 sections/)).toBeVisible();
  });

  it('opens create dialog when New Report is clicked', async () => {
    render(
      <ReportsClient
        resolvedReports={[]}
        repository="owner/repo"
      />,
    );

    const newReportButton = await screen.findByRole('button', { name: /New Report/ });
    fireEvent.click(newReportButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeVisible();
    });
  });

  it('deletes a report when delete button is clicked and confirmed', async () => {
    window.confirm = jest.fn(() => true);

    render(
      <ReportsClient
        resolvedReports={[
          { report: makeReport('Report 42', 'r1'), windows: [] },
        ]}
        repository="owner/repo"
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Delete Report 42/ }),
    );

    expect(window.confirm).toHaveBeenCalled();
    expect(mockRemoveReport).toHaveBeenCalledWith('r1');
  });
});
