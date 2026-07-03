import { fireEvent, render, screen } from '@testing-library/react';
import OutliersCard, { MetricOutlierRow } from '@/components/charts/OutliersCard';

function makeRows(count: number): MetricOutlierRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `outlier-${index + 1}`,
    metric: `Metric ${index + 1}`,
    value: index + 1,
    timestamp: `2026-06-${String(index + 1).padStart(2, '0')}T12:00:00Z`,
    lowerBound: 1,
    upperBound: 10,
    item: {
      title: `Item ${index + 1}`,
    },
  }));
}

describe('OutliersCard', () => {
  it('renders nothing when there are no rows', () => {
    const { container } = render(<OutliersCard rows={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('paginates outlier rows', () => {
    render(<OutliersCard rows={makeRows(12)} />);

    expect(screen.getByTestId('outliers-table-frame')).toHaveStyle({ height: '560px' });
    expect(screen.getByText('Metric 1')).toBeInTheDocument();
    expect(screen.queryByText('Metric 11')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1-10 of 12')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /go to page 2/i }));

    expect(screen.getByText('Metric 11')).toBeInTheDocument();
    expect(screen.getByText('Showing 11-12 of 12')).toBeInTheDocument();
  });

  it('shows outliers academic references from the info icon', () => {
    render(<OutliersCard rows={makeRows(1)} />);

    fireEvent.click(screen.getByText('i'));

    expect(screen.getByText('Target: Investigate points outside IQR bounds')).toBeInTheDocument();
    expect(screen.getByText(/Kamei et al. \(2013\)/)).toBeInTheDocument();
    expect(screen.getByText(/Rahman & Devanbu \(2013\)/)).toBeInTheDocument();
    expect(screen.getByText(/Nagappan & Ball \(2005\)/)).toBeInTheDocument();
  });
});
