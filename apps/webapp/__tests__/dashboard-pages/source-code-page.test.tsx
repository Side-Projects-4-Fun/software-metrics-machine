import React from 'react';
import { render, screen } from '@testing-library/react';
import SourceCodePage from '@/app/dashboard/source-code/page';
import { FiltersProvider } from '@/components/filters/FiltersContext';
import { LinkBuilderProvider } from '@/components/providers/LinkBuilderContext';
import { ConfigurationProvider } from '@/components/providers/ConfigurationContext';
import { sourceCodeAPI, sonarqubeAPI } from '@/server/api';
import { DashboardConfigurationBuilder } from '../builders/builders';
import { CodeEvaluationBuilder } from '../builders/api-response/code-evaluation.builder';
import { PairingIndexBuilder } from '../builders/api-response/pairing-index.builder';

jest.mock('@/server/api', () => ({
  sourceCodeAPI: {
    evaluate: jest.fn(),
    entityChurn: jest.fn(),
    coupling: jest.fn(),
    layeredCoupling: jest.fn(),
    entityEffort: jest.fn(),
    codeChurn: jest.fn(),
    entityOwnership: jest.fn(),
    pairingIndex: jest.fn(),
    bigOFiles: jest.fn(),
  },
  sonarqubeAPI: {
    componentTree: jest.fn(),
  },
}));

const mockSourceCode = sourceCodeAPI as jest.Mocked<typeof sourceCodeAPI>;
const mockSonarqube = sonarqubeAPI as jest.Mocked<typeof sonarqubeAPI>;

const mockConfig = new DashboardConfigurationBuilder().build();

function Providers({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <ConfigurationProvider config={mockConfig}>
      <FiltersProvider>
        <LinkBuilderProvider config={mockConfig}>
          {children}
        </LinkBuilderProvider>
      </FiltersProvider>
    </ConfigurationProvider>
  );
}

function setupMockApiResponse() {
  mockSourceCode.evaluate.mockResolvedValue(
    new CodeEvaluationBuilder()
      .withSignals([
        {
          id: 'churn',
          title: 'Churn',
          description: 'Moderate',
          severity: 'warning',
          category: 'churn',
          metrics: [{ label: 'Lines', value: '500' }],
        },
      ])
      .build()
  );
  mockSourceCode.entityChurn.mockResolvedValue([{ entity: 'src/app.ts', added: 100, deleted: 50, commits: 10 }]);
  mockSourceCode.coupling.mockResolvedValue([{ entity: 'src/app.ts', coupled: 'src/utils.ts', degree: 5, averageRevs: 3 }]);
  mockSourceCode.layeredCoupling.mockResolvedValue([{ entity: 'src/app.ts', coupled: 'src/utils.ts', degree: 5, averageRevs: 3 }]);
  mockSourceCode.entityEffort.mockResolvedValue([{ entity: 'src/app.ts', 'total-revs': 50 }]);
  mockSourceCode.codeChurn.mockResolvedValue([{ date: '2026-01-01', type: 'added', value: 100 }]);
  mockSourceCode.entityOwnership.mockResolvedValue([{ entity: 'src/app.ts', author: 'alice', added: 80, deleted: 20 }]);
  mockSourceCode.pairingIndex.mockResolvedValue(
    new PairingIndexBuilder().build()
  );
  mockSourceCode.bigOFiles.mockResolvedValue([]);
  mockSonarqube.componentTree.mockResolvedValue([]);
}

describe('Source Code Dashboard - User Journey', () => {
  beforeEach(() => {
    setupMockApiResponse();
  });

  it('renders code health evaluation section', async () => {
    const ui = await SourceCodePage({ searchParams: Promise.resolve({}) });
    render(<Providers>{ui}</Providers>);

    expect(screen.getByText('Code Health Summary')).toBeInTheDocument();
    expect(screen.getByText('Code Quality Signals')).toBeInTheDocument();
  });

  it('renders all metric card sections with data', async () => {
    const ui = await SourceCodePage({ searchParams: Promise.resolve({}) });
    render(<Providers>{ui}</Providers>);

    expect(screen.getByText('Code Churn Over Time')).toBeInTheDocument();
    expect(screen.getByText('Code Coupling (Top 20)')).toBeInTheDocument();

    expect(screen.getByText('Entity Churn (Top 20)')).toBeInTheDocument();
    expect(screen.getByText('Entity Effort (Top 20)')).toBeInTheDocument();
    expect(screen.getByText('Ownership')).toBeInTheDocument();

    expect(screen.getByText('Who Paired The Most With Whom')).toBeInTheDocument();

    expect(screen.getByText('Layered Coupling')).toBeInTheDocument();
  });

  it('handles empty/null data gracefully', async () => {
    mockSourceCode.evaluate.mockResolvedValue(null);
    mockSourceCode.entityChurn.mockResolvedValue([]);
    mockSourceCode.coupling.mockResolvedValue([]);
    mockSourceCode.layeredCoupling.mockResolvedValue([]);
    mockSourceCode.entityEffort.mockResolvedValue([]);
    mockSourceCode.codeChurn.mockResolvedValue([]);
    mockSourceCode.entityOwnership.mockResolvedValue([]);
    mockSourceCode.pairingIndex.mockResolvedValue(null);
    mockSourceCode.bigOFiles.mockResolvedValue([]);
    mockSonarqube.componentTree.mockResolvedValue([]);

    const ui = await SourceCodePage({ searchParams: Promise.resolve({}) });
    render(<Providers>{ui}</Providers>);

    expect(screen.getByText('Code Churn Over Time')).toBeInTheDocument();
  });
});
