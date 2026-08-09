import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReportsPage from '@/app/reports/page';
import {
  ReportEntryBuilder,
  SavedFilterBuilder,
  DashboardFiltersBuilder,
} from '../builders/builders';
import { renderWithProviders } from '../utils/test-providers';

jest.mock('@/app/reports/shared', () => ({
  fetchSavedFiltersDocument: jest.fn(),
  resolveReports: jest.fn(),
}));

jest.mock('@/components/filters/saved-filters-actions', () => ({
  getSavedFiltersBySection: jest.fn(),
  saveReport: jest.fn(),
}));

import { fetchSavedFiltersDocument, resolveReports } from '@/app/reports/shared';
import { getSavedFiltersBySection, saveReport } from '@/components/filters/saved-filters-actions';

const mockFetchDoc = fetchSavedFiltersDocument as jest.MockedFunction<typeof fetchSavedFiltersDocument>;
const mockResolveReports = resolveReports as jest.MockedFunction<typeof resolveReports>;
const mockGetSavedFiltersBySection = getSavedFiltersBySection as jest.MockedFunction<typeof getSavedFiltersBySection>;
const mockSaveReport = saveReport as jest.MockedFunction<typeof saveReport>;

describe('Report Creation Flow', () => {
  // These tests render an async ReportsPage server component and drive several
  // userEvent interactions through the dialog; they need headroom beyond the
  // default 5000ms when the host is under parallel-suite load.
  jest.setTimeout(15000);

  beforeEach(() => {
    mockGetSavedFiltersBySection.mockResolvedValue([]);
  });

  it('creates a new report with pipelines section and saves it', async () => {
    const pipelinesFilter = new SavedFilterBuilder()
      .withId('f-pipelines')
      .withName('CI Main Branch')
      .withSection('pipelines')
      .withFilters(new DashboardFiltersBuilder().withStartDate('2026-01-01').withEndDate('2026-01-31').build())
      .build();

    mockFetchDoc.mockResolvedValue({ version: 1, filters: [pipelinesFilter], reports: [] });
    mockResolveReports.mockResolvedValue([]);
    mockGetSavedFiltersBySection.mockResolvedValue([pipelinesFilter]);

    const savedReport = new ReportEntryBuilder()
      .withId('r-new')
      .withName('Sprint Review')
      .withSections([{ section: 'pipelines', savedFilterId: 'f-pipelines' }])
      .build();

    mockSaveReport.mockResolvedValue(savedReport);

    const ui = await ReportsPage();
    renderWithProviders(ui);

    const newReportButton = screen.getByRole('button', { name: /New Report/ });
    await userEvent.click(newReportButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText('Report name');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Sprint Review');

    const pipelinesSelect = screen.getByLabelText('Pipelines');
    await userEvent.click(pipelinesSelect);
    await userEvent.type(pipelinesSelect, 'CI Main Branch');

    const option = await screen.findByRole('option', { name: 'CI Main Branch' });
    await userEvent.click(option);

    const saveButton = screen.getByRole('button', { name: /Save Report/ });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSaveReport).toHaveBeenCalled();
    });
  });

  it('creates a report with multiple sections', async () => {
    const pipelinesFilter = new SavedFilterBuilder()
      .withId('f-pipelines')
      .withName('CI Main')
      .withSection('pipelines')
      .build();

    const prFilter = new SavedFilterBuilder()
      .withId('f-pr')
      .withName('PR Reviews')
      .withSection('change-requests')
      .build();

    mockFetchDoc.mockResolvedValue({ version: 1, filters: [pipelinesFilter, prFilter], reports: [] });
    mockResolveReports.mockResolvedValue([]);
    mockGetSavedFiltersBySection.mockImplementation((section: string) => {
      if (section === 'pipelines') {return Promise.resolve([pipelinesFilter]);}
      if (section === 'change-requests') {return Promise.resolve([prFilter]);}
      return Promise.resolve([]);
    });

    const savedReport = new ReportEntryBuilder()
      .withId('r-multi')
      .withName('Full Review')
      .withSections([
        { section: 'pipelines', savedFilterId: 'f-pipelines' },
        { section: 'change-requests', savedFilterId: 'f-pr' },
      ])
      .build();

    mockSaveReport.mockResolvedValue(savedReport);

    const ui = await ReportsPage();
    renderWithProviders(ui);

    await userEvent.click(screen.getByRole('button', { name: /New Report/ }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText('Report name');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Full Review');

    const pipelinesSelect = screen.getByLabelText('Pipelines');
    await userEvent.click(pipelinesSelect);
    await userEvent.type(pipelinesSelect, 'CI Main');
    await userEvent.click(await screen.findByRole('option', { name: 'CI Main' }));

    const prSelect = screen.getByLabelText('Change Requests');
    await userEvent.click(prSelect);
    await userEvent.type(prSelect, 'PR Reviews');
    await userEvent.click(await screen.findByRole('option', { name: 'PR Reviews' }));

    await userEvent.click(screen.getByRole('button', { name: /Save Report/ }));

    await waitFor(() => {
      expect(mockSaveReport).toHaveBeenCalledWith(
        'Full Review',
        expect.arrayContaining([
          { section: 'pipelines', savedFilterId: 'f-pipelines' },
          { section: 'change-requests', savedFilterId: 'f-pr' },
        ]),
        expect.any(String),
        undefined,
        undefined,
        undefined,
      );
    });
  });

  it('cancels report creation and returns to list', async () => {
    mockFetchDoc.mockResolvedValue({ version: 1, filters: [], reports: [] });
    mockResolveReports.mockResolvedValue([]);

    const ui = await ReportsPage();
    renderWithProviders(ui);

    await userEvent.click(screen.getByRole('button', { name: /New Report/ }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /Cancel/ }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
