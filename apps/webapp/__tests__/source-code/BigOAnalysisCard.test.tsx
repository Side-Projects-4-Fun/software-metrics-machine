import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BigOAnalysisCard } from '@/components/charts/source-code/BigOAnalysisCard';
import type { BigOFileSummary } from '@/server/api/sourceCode';
import { renderWithProviders } from '../utils/test-providers';

const files: BigOFileSummary[] = [
  {
    filePath: 'src/low.ts',
    fileName: 'low.ts',
    classification: 'O(1)',
    score: 1,
    needsHelp: false,
  },
  {
    filePath: 'src/high.ts',
    fileName: 'high.ts',
    classification: 'O(n^2)',
    score: 8,
    needsHelp: true,
  },
  {
    filePath: 'src/medium.ts',
    fileName: 'medium.ts',
    classification: 'O(n)',
    score: 3,
    needsHelp: false,
  },
];

function dataRows() {
  return screen.getAllByRole('row').slice(1);
}

describe('BigOAnalysisCard', () => {
  afterEach(() => {
    Reflect.deleteProperty(global, 'fetch');
    jest.restoreAllMocks();
  });

  it('sorts files by score descending on initial render', () => {
    renderWithProviders(<BigOAnalysisCard files={files} search="" />);

    expect(dataRows()[0]).toHaveTextContent('high.ts');
    expect(dataRows()[1]).toHaveTextContent('medium.ts');
    expect(dataRows()[2]).toHaveTextContent('low.ts');
  });

  it('shows Big O notation references from the info icon', async () => {
    renderWithProviders(<BigOAnalysisCard files={files} search="" />);

    await userEvent.click(screen.getByText('i'));

    expect(screen.getByText('Target: Review O(n^2+) hotspots')).toBeInTheDocument();
    expect(screen.getByText(/Introduction to Algorithms/)).toBeInTheDocument();
    expect(screen.getByText(/Khan Academy/)).toBeInTheDocument();
    expect(screen.getByText(/NIST Dictionary/)).toBeInTheDocument();
  });

  it('toggles score sorting client side when the Score header is clicked', async () => {
    const push = jest.fn();
    const fetchMock = jest.fn();

    jest.requireMock('next/navigation').useRouter.mockReturnValue({
      push,
      replace: jest.fn(),
      back: jest.fn(),
    });
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      value: fetchMock,
    });

    renderWithProviders(<BigOAnalysisCard files={files} search="" />);

    await userEvent.click(screen.getByRole('button', { name: /score/i }));

    expect(dataRows()[0]).toHaveTextContent('low.ts');
    expect(dataRows()[1]).toHaveTextContent('medium.ts');
    expect(dataRows()[2]).toHaveTextContent('high.ts');
    expect(push).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
