import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReportsClient from '@/components/reports/ReportsClient';
import * as savedFiltersActions from '@/components/filters/saved-filters-actions';
import { ReportEntryBuilder } from '../builders/builders';
import { renderWithProviders } from '../utils/test-providers';

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
    renderWithProviders(
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
    renderWithProviders(
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
    renderWithProviders(
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
    renderWithProviders(
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

    renderWithProviders(
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
    renderWithProviders(
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
    renderWithProviders(
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
    const duplicateIndex = buttons.indexOf(duplicateButton as HTMLButtonElement);
    const editIndex = buttons.indexOf(editButton as HTMLButtonElement);
    expect(duplicateIndex).toBeGreaterThanOrEqual(0);
    expect(editIndex).toBeGreaterThan(duplicateIndex);
  });

  it('duplicates a report when the duplicate icon is clicked', async () => {
    const existingReport = new ReportEntryBuilder()
      .withId('r1')
      .withName('Report 42')
      .build();

    renderWithProviders(
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

  it('pre-populates the edit dialog with the report name and dates', async () => {
    const existingReport = new ReportEntryBuilder()
      .withId('r1')
      .withName('Sprint 42')
      .withStartDateOverride('2026-06-01')
      .withEndDateOverride('2026-06-30')
      .build();

    renderWithProviders(
      <ReportsClient
        resolvedReports={[{ report: existingReport, windows: [] }]}
        repository="owner/repo"
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Edit Sprint 42/ }));

    const nameInput = (await screen.findByLabelText('Report name')) as HTMLInputElement;
    expect(nameInput.value).toBe('Sprint 42');

    const dateRange = screen.getByLabelText('Date range') as HTMLInputElement;
    expect(dateRange.value).toContain('2026-06-01');
    expect(dateRange.value).toContain('2026-06-30');
  });

  it('re-populates fields when opening a different report for edit', async () => {
    const reportA = new ReportEntryBuilder().withId('r1').withName('Report A').build();
    const reportB = new ReportEntryBuilder().withId('r2').withName('Report B').build();

    renderWithProviders(
      <ReportsClient
        resolvedReports={[
          { report: reportA, windows: [] },
          { report: reportB, windows: [] },
        ]}
        repository="owner/repo"
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Edit Report A/ }));
    const firstName = (await screen.findByLabelText('Report name')) as HTMLInputElement;
    expect(firstName.value).toBe('Report A');

    await userEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    await userEvent.click(screen.getByRole('button', { name: /Edit Report B/ }));
    const secondName = (await screen.findByLabelText('Report name')) as HTMLInputElement;
    expect(secondName.value).toBe('Report B');
  });

  it('does not leak typed input into a new report after cancel', async () => {
    renderWithProviders(
      <ReportsClient resolvedReports={[]} repository="owner/repo" />,
    );

    await userEvent.click(screen.getByRole('button', { name: /New Report/ }));
    const nameInput = (await screen.findByLabelText('Report name')) as HTMLInputElement;
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Draft Report');
    expect(nameInput.value).toBe('Draft Report');

    await userEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    await userEvent.click(screen.getByRole('button', { name: /New Report/ }));
    const resetName = (await screen.findByLabelText('Report name')) as HTMLInputElement;
    expect(resetName.value).not.toBe('Draft Report');
    expect(resetName.value).toBeTruthy();
  });
});
