import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SliderFilter from '@/components/filters/SliderFilter';

describe('SliderFilter', () => {
  const mockOnChange = jest.fn();
  const defaultProps = {
    label: 'Test Slider',
    value: 50,
    onChange: mockOnChange,
  };

  it('renders with label and current value', () => {
    render(<SliderFilter {...defaultProps} />);
    expect(screen.getByText(/Test Slider: 50/)).toBeInTheDocument();
  });

  it('renders slider input', () => {
    render(<SliderFilter {...defaultProps} />);
    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();
  });

  it('has correct default min and max', () => {
    render(<SliderFilter {...defaultProps} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('min', '1');
    expect(slider).toHaveAttribute('max', '100');
  });

  it('uses custom min and max values', () => {
    render(<SliderFilter {...defaultProps} min={0} max={200} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('min', '0');
    expect(slider).toHaveAttribute('max', '200');
  });

  it('calls onChange when slider value changes', () => {
    render(<SliderFilter {...defaultProps} />);
    
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '60' } });
    
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('respects step value', () => {
    render(<SliderFilter {...defaultProps} step={5} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('step', '5');
  });

  it('has default step of 1', () => {
    render(<SliderFilter {...defaultProps} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('step', '1');
  });

  it('disables when disabled prop is true', () => {
    render(<SliderFilter {...defaultProps} disabled={true} />);
    const slider = screen.getByRole('slider');
    expect(slider).toBeDisabled();
  });

  it('is enabled by default', () => {
    render(<SliderFilter {...defaultProps} />);
    const slider = screen.getByRole('slider');
    expect(slider).not.toBeDisabled();
  });
});
