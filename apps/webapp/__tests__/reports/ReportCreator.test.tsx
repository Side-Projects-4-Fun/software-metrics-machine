import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReportCreator from '@/components/reports/ReportCreator';
import type { ReportEntry } from '@/components/reports/reports-store';
import * as savedFiltersActions from '@/components/filters/saved-filters-actions';

jest.mock('@/components/filters/saved-filters-actions');

const mockGetSavedFiltersBySection = savedFiltersActions.getSavedFiltersBySection as jest.Mock;

function makeFilter(id: string, section: string) {
  return {
    id,
    name: `Filter for ${section}`,
    section,
    pathname: `/dashboard/${section}`,
    filters: { startDate: '', endDate: '' },
    repository: 'owner/repo',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('ReportCreator', () => {
  const defaultProps = {
    open: true,
    repository: 'owner/repo',
    onClose: jest.fn(),
    onSave: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSavedFiltersBySection.mockResolvedValue([]);
  });

  it('renders the dialog when open', () => {
    render(<ReportCreator {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByText('New Report')).toBeVisible();
  });

  it('does not render when closed', () => {
    render(<ReportCreator {...defaultProps} open={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('disables save button when no sections are selected and no name', () => {
    render(<ReportCreator {...defaultProps} />);

    fireEvent.change(
      screen.getByLabelText('Report name'),
      { target: { value: '' } },
    );

    const saveButton = screen.getByRole('button', { name: /Save Report/ });
    expect(saveButton).toBeDisabled();
  });

  it('disables save when no filter section is selected', () => {
    render(<ReportCreator {...defaultProps} />);

    fireEvent.change(
      screen.getByLabelText('Report name'),
      { target: { value: 'Sprint 42' } },
    );

    const saveButton = screen.getByRole('button', { name: /Save Report/ });
    expect(saveButton).toBeDisabled();
  });

  it('calls onClose when cancel is clicked', () => {
    render(<ReportCreator {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('has default report name pre-filled', () => {
    render(<ReportCreator {...defaultProps} />);

    const input = screen.getByLabelText('Report name') as HTMLInputElement;
    expect(input.value).toBeTruthy();
  });

  it('renders five section dropdowns with correct labels', () => {
    render(<ReportCreator {...defaultProps} />);

    expect(screen.getByLabelText('Pipelines')).toBeVisible();
    expect(screen.getByLabelText('Pull Requests')).toBeVisible();
    expect(screen.getByLabelText('Source Code')).toBeVisible();
    expect(screen.getByLabelText('Architecture')).toBeVisible();
    expect(screen.getByLabelText('SonarQube')).toBeVisible();
  });

  it('renders date range picker', () => {
    render(<ReportCreator {...defaultProps} />);

    expect(screen.getByLabelText('Date range')).toBeVisible();
  });

  describe('multi-window save behavior', () => {
    beforeEach(() => {
      mockGetSavedFiltersBySection.mockImplementation((section: string) => {
        if (section === 'pipelines') {
          return Promise.resolve([makeFilter('f_pipelines', 'pipelines')]);
        }
        return Promise.resolve([]);
      });
    });

    async function selectPipelinesFilter() {
      const pipelinesInput = screen.getByLabelText('Pipelines');
      await userEvent.click(pipelinesInput);
      await userEvent.type(pipelinesInput, 'Filter for pipelines');
      const option = await screen.findByRole('option', { name: 'Filter for pipelines' });
      await userEvent.click(option);
    }

    /** The Interval Select is the first combobox in the dialog (before the Autocomplete inputs). */
    function getIntervalSelectCombobox(): HTMLElement {
      return screen.getAllByRole('combobox')[0];
    }

    it('persists manual window dateWindows even without top-level startDate', async () => {
      render(<ReportCreator {...defaultProps} onSave={defaultProps.onSave} />);
      await selectPipelinesFilter();

      // Enable multi-window
      await userEvent.click(screen.getByLabelText('Multi-window timeline'));

      // Switch interval to Manual
      await userEvent.click(getIntervalSelectCombobox());
      await userEvent.click(await screen.findByRole('option', { name: 'Manual' }));

      // Add a manual window and fill dates
      await userEvent.click(screen.getByRole('button', { name: 'Add window' }));
      const startInputs = screen.getAllByLabelText('Start');
      const endInputs = screen.getAllByLabelText('End');
      await userEvent.type(startInputs[0], '2026-06-01');
      await userEvent.type(endInputs[0], '2026-06-07');

      // Save
      await userEvent.click(screen.getByRole('button', { name: /Save Report/ }));

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalled();
      });

      const dateWindows = (defaultProps.onSave as jest.Mock).mock.calls[0][4];
      expect(dateWindows).toBeDefined();
      expect(dateWindows).toHaveLength(1);
      expect(dateWindows[0]).toMatchObject({
        startDate: '2026-06-01',
        endDate: '2026-06-07',
        label: 'Jun 1, 2026 – Jun 7, 2026',
      });
    });
  });

  describe('edit mode', () => {
    const existingReport: ReportEntry = {
      id: 'r1',
      name: 'Sprint 42',
      repository: 'owner/repo',
      sections: [
        { section: 'pipelines', savedFilterId: 'f_pipelines' },
        { section: 'source-code', savedFilterId: 'f_source_code' },
      ],
      startDateOverride: '2026-06-01',
      endDateOverride: '2026-06-30',
      createdAt: '2026-01-01T00:00:00.000Z',
      dateWindows: [
        { startDate: '2026-06-01', endDate: '2026-06-07', label: 'Jun 1, 2026 – Jun 7, 2026' },
        { startDate: '2026-06-08', endDate: '2026-06-14', label: 'Jun 8, 2026 – Jun 14, 2026' },
      ],
    };

    beforeEach(() => {
      mockGetSavedFiltersBySection.mockResolvedValue([]);
    });

    it('shows Edit Report title when editing', () => {
      render(
        <ReportCreator
          {...defaultProps}
          existingReport={existingReport}
        />,
      );

      expect(screen.getByText('Edit Report')).toBeVisible();
      expect(screen.queryByText('New Report')).toBeNull();
    });

    it('shows Update Report button text when editing', () => {
      render(
        <ReportCreator
          {...defaultProps}
          existingReport={existingReport}
        />,
      );

      expect(screen.getByRole('button', { name: /Update Report/ })).toBeVisible();
      expect(screen.queryByRole('button', { name: /Save Report/ })).toBeNull();
    });

    it('pre-populates the report name', () => {
      render(
        <ReportCreator
          {...defaultProps}
          existingReport={existingReport}
        />,
      );

      const nameInput = screen.getByLabelText('Report name') as HTMLInputElement;
      expect(nameInput.value).toBe('Sprint 42');
    });

    it('pre-populates date overrides', () => {
      render(
        <ReportCreator
          {...defaultProps}
          existingReport={existingReport}
        />,
      );

      const dateRangeInput = screen.getByLabelText('Date range') as HTMLInputElement;
      expect(dateRangeInput.value).toContain('2026-06-01');
      expect(dateRangeInput.value).toContain('2026-06-30');
    });

    it('pre-populates multi-window config with manual mode', () => {
      render(
        <ReportCreator
          {...defaultProps}
          existingReport={existingReport}
        />,
      );

      // Multi-window should be enabled
      expect(screen.getByText('Multi-window timeline')).toBeVisible();

      // Manual window date inputs should be visible
      const startInputs = screen.getAllByLabelText('Start');
      const endInputs = screen.getAllByLabelText('End');
      expect(startInputs).toHaveLength(2);
      expect(endInputs).toHaveLength(2);
    });
  });
});
