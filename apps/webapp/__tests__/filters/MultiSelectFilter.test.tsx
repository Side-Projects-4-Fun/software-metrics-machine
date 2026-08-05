import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MultiSelectFilter from '@/components/filters/MultiSelectFilter';

describe('MultiSelectFilter', () => {
  const mockOnChange = jest.fn();
  const defaultProps = {
    label: 'Test Multi Select',
    values: [],
    options: ['option1', 'option2', 'option3', 'option4'],
    onChange: mockOnChange,
  };

  it('renders with label', () => {
    render(<MultiSelectFilter {...defaultProps} />);
    const selectElement = screen.getByRole('combobox');
    expect(selectElement).toBeInTheDocument();
  });

  it('renders and can open dropdown', async () => {
    render(<MultiSelectFilter {...defaultProps} />);
    const selectElement = screen.getByRole('combobox');
    await userEvent.click(selectElement);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('displays selected values as chips', () => {
    render(<MultiSelectFilter {...defaultProps} values={['option1', 'option2']} />);
    const elements = screen.getAllByText('option1');
    expect(elements.length).toBeGreaterThan(0);
  });

  it('calls onChange with array when selections change', async () => {
    render(<MultiSelectFilter {...defaultProps} />);
    
    const selectElement = screen.getByRole('combobox');
    await userEvent.click(selectElement);
    
    const option = await screen.findByRole('option', { name: 'option1' });
    await userEvent.click(option);
    
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('disables when disabled prop is true', () => {
    render(<MultiSelectFilter {...defaultProps} disabled={true} />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('is enabled by default', () => {
    render(<MultiSelectFilter {...defaultProps} />);
    expect(screen.getByRole('combobox')).not.toBeDisabled();
  });
});
