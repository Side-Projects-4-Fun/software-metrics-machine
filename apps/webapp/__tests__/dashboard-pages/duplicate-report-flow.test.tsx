import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReportsPage from '@/app/reports/page';
import {
  ReportEntryBuilder,
  SavedFilterBuilder,
} from '../builders/builders';
import { renderWithProviders } from '../utils/test-providers';

jest.mock('@/app/reports/shared', () => ({
  fetchSavedFiltersDocument: jest.fn(),
  resolveReports: jest.fn(),
}));

jest.mock('@/components/filters/saved-filters-actions', () => ({
  getSavedFiltersBySection: jest.fn(),
  duplicateReport: jest.fn(),
}));

import { fetchSavedFiltersDocument, resolveReports } from '@/app/reports/shared';
import { getSavedFiltersBySection, duplicateReport } from '@/components/filters/saved-filters-actions';

const mockFetchDoc = fetchSavedFiltersDocument as jest.MockedFunction<typeof fetchSavedFiltersDocument>;
const mockResolveReports = resolveReports as jest.MockedFunction<typeof resolveReports>;
const mockGetSavedFiltersBySection = getSavedFiltersBySection as jest.MockedFunction<typeof getSavedFiltersBySection>;
const mockDuplicateReport = duplicateReport as jest.MockedFunction<typeof duplicateReport>;

describe('Duplicate Existing Report Flow', () => {
  // These tests render an async ReportsPage server component and drive
  // userEvent interactions; they need headroom beyond the default 5000ms
  // when the host is under parallel-suite load.
  jest.setTimeout(15000);

  beforeEach(() => {
    mockGetSavedFiltersBySection.mockResolvedValue([]);
  });

  it('creates a copy of an existing report when the duplicate icon is clicked', async () => {
    const pipelinesFilter = new SavedFilterBuilder()
      .withId('f-pipelines')
      .withName('CI Main')
      .withSection('pipelines')
      .build();

    const existingReport = new ReportEntryBuilder()
      .withId('r-existing')
      .withName('Sprint 42')
      .withSections([{ section: 'pipelines', savedFilterId: 'f-pipelines' }])
      .build();

    const duplicatedReport = new ReportEntryBuilder()
      .withId('r-copy')
      .withName('Sprint 42 (copy)')
      .withSections([{ section: 'pipelines', savedFilterId: 'f-pipelines' }])
      .build();

    mockFetchDoc.mockResolvedValue({
      version: 1,
      filters: [pipelinesFilter],
      reports: [existingReport],
    });
    mockResolveReports.mockResolvedValue([
      { report: existingReport, windows: [] },
    ]);
    mockDuplicateReport.mockResolvedValue(duplicatedReport);

    const ui = await ReportsPage();
    renderWithProviders(ui);

    await waitFor(() => {
      expect(screen.getByText('Sprint 42')).toBeInTheDocument();
    });

    const duplicateButton = screen.getByRole('button', { name: /Duplicate Sprint 42/ });
    await userEvent.click(duplicateButton);

    await waitFor(() => {
      expect(mockDuplicateReport).toHaveBeenCalledWith('r-existing');
    });
  });

  it('places the duplicate icon to the left of the edit icon', async () => {
    const pipelinesFilter = new SavedFilterBuilder()
      .withId('f-pipelines')
      .withName('CI Main')
      .withSection('pipelines')
      .build();

    const existingReport = new ReportEntryBuilder()
      .withId('r-existing')
      .withName('Sprint 42')
      .withSections([{ section: 'pipelines', savedFilterId: 'f-pipelines' }])
      .build();

    mockFetchDoc.mockResolvedValue({
      version: 1,
      filters: [pipelinesFilter],
      reports: [existingReport],
    });
    mockResolveReports.mockResolvedValue([
      { report: existingReport, windows: [] },
    ]);

    const ui = await ReportsPage();
    renderWithProviders(ui);

    await waitFor(() => {
      expect(screen.getByText('Sprint 42')).toBeInTheDocument();
    });

    const duplicateButton = screen.getByRole('button', { name: /Duplicate Sprint 42/ });
    const editButton = screen.getByRole('button', { name: /Edit Sprint 42/ });

    const actionContainer = duplicateButton.parentElement!;
    const buttons = Array.from(actionContainer.querySelectorAll('button'));
    const duplicateIndex = buttons.indexOf(duplicateButton);
    const editIndex = buttons.indexOf(editButton);
    expect(duplicateIndex).toBeGreaterThanOrEqual(0);
    expect(editIndex).toBeGreaterThan(duplicateIndex);
  });
});