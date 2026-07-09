import { render, screen } from '@testing-library/react';
import CrapMetricCard from '@/components/charts/source-code/CrapMetricCard';
import { calculateCrapScore, toCrapRisk } from '@/components/charts/source-code/crap-metric';
import type { CrapMetricData } from '@/components/charts/source-code/types';

const data: CrapMetricData[] = [
  {
    componentKey: 'src/safe.ts',
    name: 'safe.ts',
    complexity: 10,
    coverage: 90,
    crap: calculateCrapScore(10, 90),
  },
  {
    componentKey: 'src/risky.ts',
    name: 'risky.ts',
    complexity: 12,
    coverage: 0,
    crap: calculateCrapScore(12, 0),
  },
  {
    componentKey: 'src/watch.ts',
    name: 'watch.ts',
    complexity: 8,
    coverage: 40,
    crap: calculateCrapScore(8, 40),
  },
];

function dataRows() {
  return screen.getAllByRole('row').slice(1);
}

describe('CrapMetricCard', () => {
  it('calculates CRAP using complexity and uncovered ratio', () => {
    expect(calculateCrapScore(10, 90)).toBe(10.1);
    expect(calculateCrapScore(12, 0)).toBe(156);
  });

  it('maps CRAP scores to risk labels', () => {
    expect(toCrapRisk(20)).toEqual({ label: 'OK', color: 'success' });
    expect(toCrapRisk(45)).toEqual({ label: 'Watch', color: 'warning' });
    expect(toCrapRisk(80)).toEqual({ label: 'High', color: 'error' });
  });

  it('sorts files by highest CRAP score first', () => {
    render(<CrapMetricCard data={data} topEntries={3} />);

    expect(dataRows()[0]).toHaveTextContent('risky.ts');
    expect(dataRows()[1]).toHaveTextContent('watch.ts');
    expect(dataRows()[2]).toHaveTextContent('safe.ts');
  });

  it('shows the empty SonarQube state when no file measures exist', () => {
    render(<CrapMetricCard data={[]} topEntries={10} />);

    expect(screen.getByText('No SonarQube file measures are available for CRAP yet.')).toBeInTheDocument();
  });
});
