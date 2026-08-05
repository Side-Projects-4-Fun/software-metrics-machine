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
  updateReport: jest.fn(),
}));

import { fetchSavedFiltersDocument, resolveReports } from '@/app/reports/shared';
import { getSavedFiltersBySection, updateReport } from '@/components/filters/saved-filters-actions';

const mockFetchDoc = fetchSavedFiltersDocument as jest.MockedFunction<typeof fetchSavedFiltersDocument>;
const mockResolveReports = resolveReports as jest.MockedFunction<typeof resolveReports>;
const mockGetSavedFiltersBySection = getSavedFiltersBySection as jest.MockedFunction<typeof getSavedFiltersBySection>;
const mockUpdateReport = updateReport as jest.MockedFunction<typeof updateReport>;

describe('Edit Existing Report Flow', () => {
  // These tests render an async ReportsPage server component and drive several
  // userEvent interactions through the dialog; they need headroom beyond the
  // default 5000ms when the host is under parallel-suite load.
  jest.setTimeout(15000);

  beforeEach(() => {
    mockGetSavedFiltersBySection.mockResolvedValue([]);
  });

  it('opens edit dialog with pre-filled report data', async () => {
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

    mockFetchDoc.mockResolvedValue({ version: 1, filters: [pipelinesFilter], reports: [existingReport] });
    mockResolveReports.mockResolvedValue([
      { report: existingReport, windows: [] },
    ]);
    mockGetSavedFiltersBySection.mockResolvedValue([pipelinesFilter]);

    const ui = await ReportsPage();
    renderWithProviders(ui);

    await waitFor(() => {
      expect(screen.getByText('Sprint 42')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /Edit Sprint 42/ });
    await userEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText('Report name') as HTMLInputElement;
    expect(nameInput.value).toBe('Sprint 42');

    expect(screen.getByText('CI Main')).toBeInTheDocument();
  });

  it('updates report name and saves changes', async () => {
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

    mockFetchDoc.mockResolvedValue({ version: 1, filters: [pipelinesFilter], reports: [existingReport] });
    mockResolveReports.mockResolvedValue([
      { report: existingReport, windows: [] },
    ]);
    mockGetSavedFiltersBySection.mockResolvedValue([pipelinesFilter]);

    const updatedReport = new ReportEntryBuilder()
      .withId('r-existing')
      .withName('Sprint 43')
      .withSections([{ section: 'pipelines', savedFilterId: 'f-pipelines' }])
      .build();

    mockUpdateReport.mockResolvedValue(updatedReport);

    const ui = await ReportsPage();
    renderWithProviders(ui);

    await waitFor(() => {
      expect(screen.getByText('Sprint 42')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /Edit Sprint 42/ });
    await userEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText('Report name');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Sprint 43');

    await userEvent.click(screen.getByRole('button', { name: /Update Report/ }));

    await waitFor(() => {
      expect(mockUpdateReport).toHaveBeenCalledWith(
        'r-existing',
        'Sprint 43',
        [{ section: 'pipelines', savedFilterId: 'f-pipelines' }],
        expect.any(String),
        undefined,
        undefined,
        undefined,
      );
    });
  });

  it('adds a new section to existing report', async () => {
    const pipelinesFilter = new SavedFilterBuilder()
      .withId('f-pipelines')
      .withName('CI Main')
      .withSection('pipelines')
      .build();

    const prFilter = new SavedFilterBuilder()
      .withId('f-pr')
      .withName('PR Reviews')
      .withSection('pull-requests')
      .build();

    const existingReport = new ReportEntryBuilder()
      .withId('r-existing')
      .withName('Sprint 42')
      .withSections([{ section: 'pipelines', savedFilterId: 'f-pipelines' }])
      .build();

    mockFetchDoc.mockResolvedValue({ version: 1, filters: [pipelinesFilter, prFilter], reports: [existingReport] });
    mockResolveReports.mockResolvedValue([
      { report: existingReport, windows: [] },
    ]);
    mockGetSavedFiltersBySection.mockImplementation((section: string) => {
      if (section === 'pipelines') {return Promise.resolve([pipelinesFilter]);}
      if (section === 'pull-requests') {return Promise.resolve([prFilter]);}
      return Promise.resolve([]);
    });

    const updatedReport = new ReportEntryBuilder()
      .withId('r-existing')
      .withName('Sprint 42')
      .withSections([
        { section: 'pipelines', savedFilterId: 'f-pipelines' },
        { section: 'pull-requests', savedFilterId: 'f-pr' },
      ])
      .build();

    mockUpdateReport.mockResolvedValue(updatedReport);

    const ui = await ReportsPage();
    renderWithProviders(ui);

    await waitFor(() => {
      expect(screen.getByText('Sprint 42')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /Edit Sprint 42/ });
    await userEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const prSelect = screen.getByLabelText('Pull Requests');
    await userEvent.click(prSelect);
    await userEvent.type(prSelect, 'PR Reviews');
    await userEvent.click(await screen.findByRole('option', { name: 'PR Reviews' }));

    await userEvent.click(screen.getByRole('button', { name: /Update Report/ }));

    await waitFor(() => {
      expect(mockUpdateReport).toHaveBeenCalledWith(
        'r-existing',
        'Sprint 42',
        expect.arrayContaining([
          { section: 'pipelines', savedFilterId: 'f-pipelines' },
          { section: 'pull-requests', savedFilterId: 'f-pr' },
        ]),
        expect.any(String),
        undefined,
        undefined,
        undefined,
      );
    });
  });

  it('cancels edit and preserves original report', async () => {
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

    mockFetchDoc.mockResolvedValue({ version: 1, filters: [pipelinesFilter], reports: [existingReport] });
    mockResolveReports.mockResolvedValue([
      { report: existingReport, windows: [] },
    ]);
    mockGetSavedFiltersBySection.mockResolvedValue([pipelinesFilter]);

    const ui = await ReportsPage();
    renderWithProviders(ui);

    await waitFor(() => {
      expect(screen.getByText('Sprint 42')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /Edit Sprint 42/ });
    await userEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText('Report name');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Sprint 99');

    await userEvent.click(screen.getByRole('button', { name: /Cancel/ }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Sprint 42')).toBeInTheDocument();
    expect(screen.queryByText('Sprint 99')).not.toBeInTheDocument();
    expect(mockUpdateReport).not.toHaveBeenCalled();
  });
});
