import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TextInputFilter from '@/components/filters/TextInputFilter';
import { renderWithProviders } from '../utils/test-providers';

describe('TextInputFilter', () => {
  const mockOnChange = jest.fn();
  const defaultProps = {
    label: 'Test Input',
    value: '',
    onChange: mockOnChange,
  };

  it('renders with label', () => {
    renderWithProviders(<TextInputFilter {...defaultProps} />);
    expect(screen.getByLabelText('Test Input')).toBeInTheDocument();
  });

  it('displays the current value', () => {
    renderWithProviders(<TextInputFilter {...defaultProps} value="test value" />);
    expect(screen.getByDisplayValue('test value')).toBeInTheDocument();
  });

  it('calls onChange when input changes', async () => {
    renderWithProviders(<TextInputFilter {...defaultProps} />);
    
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'new value');
    
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('displays placeholder when provided', () => {
    renderWithProviders(<TextInputFilter {...defaultProps} placeholder="Enter pattern" />);
    expect(screen.getByPlaceholderText('Enter pattern')).toBeInTheDocument();
  });

  it('supports multiline mode', () => {
    renderWithProviders(<TextInputFilter {...defaultProps} multiline={true} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('rows', '2');
  });

  it('disables when disabled prop is true', () => {
    renderWithProviders(<TextInputFilter {...defaultProps} disabled={true} />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('is enabled by default', () => {
    renderWithProviders(<TextInputFilter {...defaultProps} />);
    expect(screen.getByRole('textbox')).not.toBeDisabled();
  });

  it('clears value when empty string is passed', () => {
    const { rerender } = renderWithProviders(<TextInputFilter {...defaultProps} value="some value" />);
    expect(screen.getByDisplayValue('some value')).toBeInTheDocument();
    
    rerender(<TextInputFilter {...defaultProps} value="" />);
    expect(screen.getByRole('textbox')).toHaveValue('');
  });
});
