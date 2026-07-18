import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { FiltersProvider } from '@/components/filters/FiltersContext';
import DateRangePicker, { FilterDateRangePicker } from '@/components/filters/DateRangePicker';
import { defaultFilters, DashboardFilters } from '@/components/filters/DashboardFilters';
import dayjs from 'dayjs';

// Test wrapper component
const DateRangePickerWithProvider = ({ initialFilters }: { initialFilters?: DashboardFilters }) => (
  <FiltersProvider initialFilters={initialFilters}>
    <DateRangePicker />
  </FiltersProvider>
);

const CompareDateRangePickerWithProvider = ({ initialFilters }: { initialFilters?: DashboardFilters }) => (
  <FiltersProvider initialFilters={initialFilters}>
    <FilterDateRangePicker
      label="Compare date range"
      startKey="compareStartDate"
      endKey="compareEndDate"
      startInputLabel="Compare start"
      endInputLabel="Compare end"
    />
  </FiltersProvider>
);

describe('DateRangePicker', () => {
  it('renders a single date range field', () => {
    render(<DateRangePickerWithProvider />);

    expect(screen.getByLabelText('Date range')).toBeInTheDocument();
    expect(screen.queryByLabelText('Start Date')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('End Date')).not.toBeInTheDocument();
  });

  it('renders within provider without errors', () => {
    const { container } = render(<DateRangePickerWithProvider />);
    expect(container).toBeInTheDocument();
  });

  it('opens range options and applies a preset', () => {
    render(<DateRangePickerWithProvider />);

    fireEvent.click(screen.getByLabelText('Date range'));
    fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));

    const today = dayjs();
    const startDate = today.subtract(7, 'day');

    expect(screen.getByLabelText('Date range')).toHaveValue(
      `${startDate.format('YYYY-MM-DD HH:mm')} - ${today.format('YYYY-MM-DD HH:mm')}`,
    );
  });

  it('lets users select date and time for a custom range', () => {
    render(
      <DateRangePickerWithProvider
        initialFilters={{
          ...defaultFilters,
          startDate: '2026-01-01',
          endDate: '2026-01-31',
        }}
      />,
    );

    fireEvent.click(screen.getByLabelText('Date range'));
    fireEvent.click(screen.getByRole('gridcell', { name: '5' }));
    fireEvent.click(screen.getByRole('gridcell', { name: '10' }));
    fireEvent.change(screen.getByLabelText('Start date and time'), {
      target: { value: '2026-01-05T08:30' },
    });
    fireEvent.change(screen.getByLabelText('End date and time'), {
      target: { value: '2026-01-10T17:45' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.getByLabelText('Date range')).toHaveValue('2026-01-05 08:30 - 2026-01-10 17:45');
  });

  it('supports a reusable compare date range picker', () => {
    render(
      <CompareDateRangePickerWithProvider
        initialFilters={{
          ...defaultFilters,
          compareStartDate: '2026-02-01',
          compareEndDate: '2026-02-28',
        }}
      />,
    );

    fireEvent.click(screen.getByLabelText('Compare date range'));
    fireEvent.change(screen.getByLabelText('Start date and time'), {
      target: { value: '2026-02-03T09:15' },
    });
    fireEvent.change(screen.getByLabelText('End date and time'), {
      target: { value: '2026-02-12T18:05' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.getByLabelText('Compare date range')).toHaveValue('2026-02-03 09:15 - 2026-02-12 18:05');
  });
});
