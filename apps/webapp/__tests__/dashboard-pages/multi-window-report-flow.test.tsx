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
  saveReport: jest.fn(),
}));

import { fetchSavedFiltersDocument, resolveReports } from '@/app/reports/shared';
import { getSavedFiltersBySection, saveReport } from '@/components/filters/saved-filters-actions';

const mockFetchDoc = fetchSavedFiltersDocument as jest.MockedFunction<typeof fetchSavedFiltersDocument>;
const mockResolveReports = resolveReports as jest.MockedFunction<typeof resolveReports>;
const mockGetSavedFiltersBySection = getSavedFiltersBySection as jest.MockedFunction<typeof getSavedFiltersBySection>;
const mockSaveReport = saveReport as jest.MockedFunction<typeof saveReport>;

function getIntervalSelect(): HTMLElement {
  const comboboxes = screen.getAllByRole('combobox');
  return comboboxes[0];
}

describe('Multi-Window Report Flow', () => {
  beforeEach(() => {
    mockGetSavedFiltersBySection.mockResolvedValue([]);
  });

  it('creates a report with manual date windows', async () => {
    const pipelinesFilter = new SavedFilterBuilder()
      .withId('f-pipelines')
      .withName('CI Main')
      .withSection('pipelines')
      .build();

    mockFetchDoc.mockResolvedValue({ version: 1, filters: [pipelinesFilter], reports: [] });
    mockResolveReports.mockResolvedValue([]);
    mockGetSavedFiltersBySection.mockResolvedValue([pipelinesFilter]);

    const savedReport = new ReportEntryBuilder()
      .withId('r-multi-window')
      .withName('Sprint Comparison')
      .withSections([{ section: 'pipelines', savedFilterId: 'f-pipelines' }])
      .withDateWindows([
        { startDate: '2026-06-01', endDate: '2026-06-07', label: 'Week 1' },
        { startDate: '2026-06-08', endDate: '2026-06-14', label: 'Week 2' },
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
    await userEvent.type(nameInput, 'Sprint Comparison');

    const dateRangeInput = screen.getByLabelText('Date range');
    await userEvent.click(dateRangeInput);
    await userEvent.click(await screen.findByRole('button', { name: 'Last 30 days' }));

    const pipelinesSelect = screen.getByLabelText('Pipelines');
    await userEvent.click(pipelinesSelect);
    await userEvent.type(pipelinesSelect, 'CI Main');
    await userEvent.click(await screen.findByRole('option', { name: 'CI Main' }));

    const multiWindowSwitch = screen.getByRole('switch');
    await userEvent.click(multiWindowSwitch);

    await userEvent.click(getIntervalSelect());
    await userEvent.click(await screen.findByRole('option', { name: 'Manual' }));

    await waitFor(() => {
      expect(screen.getAllByLabelText('Start').length).toBeGreaterThan(0);
    });

    await userEvent.click(screen.getByRole('button', { name: /Save Report/ }));

    await waitFor(() => {
      expect(mockSaveReport).toHaveBeenCalled();
    });

    const callArgs = mockSaveReport.mock.calls[0];
    expect(callArgs[0]).toBe('Sprint Comparison');
    expect(callArgs[1]).toEqual([{ section: 'pipelines', savedFilterId: 'f-pipelines' }]);
    expect(callArgs[5]).toBeDefined();
    expect(Array.isArray(callArgs[5])).toBe(true);
  });

  it('can add and remove windows in manual mode', async () => {
    const pipelinesFilter = new SavedFilterBuilder()
      .withId('f-pipelines')
      .withName('CI Main')
      .withSection('pipelines')
      .build();

    mockFetchDoc.mockResolvedValue({ version: 1, filters: [pipelinesFilter], reports: [] });
    mockResolveReports.mockResolvedValue([]);
    mockGetSavedFiltersBySection.mockResolvedValue([pipelinesFilter]);

    const savedReport = new ReportEntryBuilder()
      .withId('r-single-window')
      .withName('Single Sprint')
      .withSections([{ section: 'pipelines', savedFilterId: 'f-pipelines' }])
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
    await userEvent.type(nameInput, 'Single Sprint');

    const dateRangeInput = screen.getByLabelText('Date range');
    await userEvent.click(dateRangeInput);
    await userEvent.click(await screen.findByRole('button', { name: 'Last 30 days' }));

    const pipelinesSelect = screen.getByLabelText('Pipelines');
    await userEvent.click(pipelinesSelect);
    await userEvent.type(pipelinesSelect, 'CI Main');
    await userEvent.click(await screen.findByRole('option', { name: 'CI Main' }));

    const multiWindowSwitch = screen.getByRole('switch');
    await userEvent.click(multiWindowSwitch);

    await userEvent.click(getIntervalSelect());
    await userEvent.click(await screen.findByRole('option', { name: 'Manual' }));

    await waitFor(() => {
      expect(screen.getAllByLabelText('Start').length).toBeGreaterThan(0);
    });

    const initialWindowCount = screen.getAllByLabelText('Start').length;

    await userEvent.click(screen.getByRole('button', { name: /Add window/ }));

    await waitFor(() => {
      expect(screen.getAllByLabelText('Start').length).toBe(initialWindowCount + 1);
    });

    const removeButtons = screen.getAllByRole('button', { name: /Remove window/ });
    await userEvent.click(removeButtons[removeButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getAllByLabelText('Start').length).toBe(initialWindowCount);
    });

    await userEvent.click(screen.getByRole('button', { name: /Save Report/ }));

    await waitFor(() => {
      expect(mockSaveReport).toHaveBeenCalled();
    });
  });
});
