import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SelectFilter from '@/components/filters/SelectFilter';

describe('SelectFilter', () => {
  const mockOnChange = jest.fn();
  const defaultProps = {
    label: 'Test Select',
    value: 'option1',
    options: ['option1', 'option2', 'option3'],
    onChange: mockOnChange,
  };

  it('renders with label', () => {
    render(<SelectFilter {...defaultProps} />);
    const selectElement = screen.getByRole('combobox');
    expect(selectElement).toBeInTheDocument();
  });

  it('renders and can open dropdown', async () => {
    render(<SelectFilter {...defaultProps} />);
    const selectElement = screen.getByRole('combobox');
    await userEvent.click(selectElement);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('displays the current value', () => {
    render(<SelectFilter {...defaultProps} value="option2" />);
    expect(screen.getByRole('combobox')).toHaveValue('option2');
  });

  it('calls onChange when selection changes', async () => {
    render(<SelectFilter {...defaultProps} />);
    
    const selectElement = screen.getByRole('combobox');
    await userEvent.click(selectElement);
    
    const option = await screen.findByRole('option', { name: 'option3' });
    await userEvent.click(option);
    
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('disables when disabled prop is true', () => {
    render(<SelectFilter {...defaultProps} disabled={true} />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('is enabled by default', () => {
    render(<SelectFilter {...defaultProps} />);
    expect(screen.getByRole('combobox')).not.toBeDisabled();
  });
});
