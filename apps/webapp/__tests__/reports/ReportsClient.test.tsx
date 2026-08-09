import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReportsClient from '@/components/reports/ReportsClient';
import * as savedFiltersActions from '@/components/filters/saved-filters-actions';
import { ReportEntryBuilder } from '../builders/builders';

jest.mock('@/components/filters/saved-filters-actions');

const mockRemoveReport = savedFiltersActions.removeReport as jest.Mock;
const mockGetSavedFiltersBySection = savedFiltersActions.getSavedFiltersBySection as jest.Mock;
const mockDuplicateReport = savedFiltersActions.duplicateReport as jest.Mock;

describe('ReportsClient', () => {
  beforeEach(() => {
    mockGetSavedFiltersBySection.mockResolvedValue([]);
    mockDuplicateReport.mockResolvedValue(new ReportEntryBuilder().build());
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
          { report: new ReportEntryBuilder().withId('r1').withName('Report 42').build(), windows: [] },
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
            report: new ReportEntryBuilder()
              .withId('r1')
              .withName('Report 42')
              .withSections([
                { section: 'pipelines', savedFilterId: 'f1' },
                { section: 'change-requests', savedFilterId: 'f2' },
              ])
              .build(),
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
    await userEvent.click(newReportButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeVisible();
    });
  });

  it('deletes a report when delete button is clicked and confirmed', async () => {
    window.confirm = jest.fn(() => true);

    render(
      <ReportsClient
        resolvedReports={[
          { report: new ReportEntryBuilder().withId('r1').withName('Report 42').build(), windows: [] },
        ]}
        repository="owner/repo"
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /Delete Report 42/ }),
    );

    expect(window.confirm).toHaveBeenCalled();
    expect(mockRemoveReport).toHaveBeenCalledWith('r1');
  });

  it('shows edit icon for each report and opens edit dialog', async () => {
    render(
      <ReportsClient
        resolvedReports={[
          { report: new ReportEntryBuilder().withId('r1').withName('Report 42').build(), windows: [] },
        ]}
        repository="owner/repo"
      />,
    );

    const editButton = screen.getByRole('button', { name: /Edit Report 42/ });
    expect(editButton).toBeVisible();

    await userEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeVisible();
    });

    expect(screen.getByText('Edit Report')).toBeVisible();
    expect(screen.getByRole('button', { name: /Update Report/ })).toBeVisible();
  });

  it('renders a duplicate icon to the left of the edit icon for each report', () => {
    render(
      <ReportsClient
        resolvedReports={[
          { report: new ReportEntryBuilder().withId('r1').withName('Report 42').build(), windows: [] },
        ]}
        repository="owner/repo"
      />,
    );

    const duplicateButton = screen.getByRole('button', { name: /Duplicate Report 42/ });
    const editButton = screen.getByRole('button', { name: /Edit Report 42/ });
    expect(duplicateButton).toBeVisible();
    expect(editButton).toBeVisible();

    const actionContainer = duplicateButton.parentElement!;
    const buttons = Array.from(actionContainer.querySelectorAll('button'));
    const duplicateIndex = buttons.indexOf(duplicateButton);
    const editIndex = buttons.indexOf(editButton);
    expect(duplicateIndex).toBeGreaterThanOrEqual(0);
    expect(editIndex).toBeGreaterThan(duplicateIndex);
  });

  it('duplicates a report when the duplicate icon is clicked', async () => {
    const existingReport = new ReportEntryBuilder()
      .withId('r1')
      .withName('Report 42')
      .build();

    render(
      <ReportsClient
        resolvedReports={[
          { report: existingReport, windows: [] },
        ]}
        repository="owner/repo"
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /Duplicate Report 42/ }),
    );

    await waitFor(() => {
      expect(mockDuplicateReport).toHaveBeenCalledWith('r1');
    });
  });
});
