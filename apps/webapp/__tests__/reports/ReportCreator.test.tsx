import { render, screen, fireEvent } from '@testing-library/react';
import ReportCreator from '@/components/reports/ReportCreator';
import * as savedFiltersActions from '@/components/filters/saved-filters-actions';

jest.mock('@/components/filters/saved-filters-actions');

const mockGetSavedFiltersBySection = savedFiltersActions.getSavedFiltersBySection as jest.Mock;

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
});
