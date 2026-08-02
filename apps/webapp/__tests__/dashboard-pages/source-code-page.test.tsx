import React from "react";
import { render, screen } from "@testing-library/react";
import SourceCodePage from "@/app/dashboard/source-code/page";
import { FiltersProvider } from "@/components/filters/FiltersContext";
import { LinkBuilderProvider } from "@/components/providers/LinkBuilderContext";
import { ConfigurationProvider } from "@/components/providers/ConfigurationContext";
import { sourceCodeAPI, sonarqubeAPI } from "@/server/api";
import type { DashboardGlobalConfiguration } from "@/server/api/configuration";

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  usePathname: jest.fn(() => '/dashboard/source-code'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(() => undefined),
  })),
}));

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

const mockConfig: DashboardGlobalConfiguration = {
  git_provider: 'github',
  github_repository: 'owner/repo',
  git_repository_location: '/tmp/repo',
  store_data: false,
  deployment_frequency_targets: [],
  main_branch: 'main',
  dashboard_start_date: null,
  dashboard_end_date: null,
  dashboard_color: '#1976d2',
  logging_level: 'info',
  jira_url: null,
  jira_email: null,
  jira_token: null,
  jira_project: null,
  sonar_url: null,
  sonar_project: null,
};

function Providers({ children }: { children: React.ReactNode }) {
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
  mockSourceCode.evaluate.mockResolvedValue({
    generatedAt: '2026-01-01T00:00:00Z',
    signals: [{ id: 'churn', title: 'Churn', description: 'Moderate', severity: 'warning', category: 'churn', metrics: [{ label: 'Lines', value: '500' }] }],
    summary: { totalChurn: 500, linesAdded: 300, linesDeleted: 200, hotspots: 2, avgPairingIndex: 45, totalCouplingPairs: 10, highComplexityFiles: 3 },
  } as never);
  mockSourceCode.entityChurn.mockResolvedValue({ result: [{ entity: 'src/app.ts', added: 100, deleted: 50, commits: 10 }] } as never);
  mockSourceCode.coupling.mockResolvedValue({ result: [{ entity: 'src/app.ts', coupled: 'src/utils.ts', degree: 5, averageRevs: 3 }] } as never);
  mockSourceCode.layeredCoupling.mockResolvedValue({ result: [{ entity: 'src/app.ts', coupled: 'src/utils.ts', degree: 5, averageRevs: 3 }] } as never);
  mockSourceCode.entityEffort.mockResolvedValue({ result: [{ entity: 'src/app.ts', 'total-revs': 50 }] } as never);
  mockSourceCode.codeChurn.mockResolvedValue({ result: [{ date: '2026-01-01', type: 'added', value: 100 }] } as never);
  mockSourceCode.entityOwnership.mockResolvedValue({ result: [{ entity: 'src/app.ts', author: 'alice', added: 80, deleted: 20 }] } as never);
  mockSourceCode.pairingIndex.mockResolvedValue({ result: {
    pairing_index_percentage: 45, total_analyzed_commits: 100, paired_commits: 45,
    top_pairs: [{ author: 'alice', co_author: 'bob', paired_commits: 10 }],
    latest_paired_commits: [{ hash: 'abc', author: 'alice', co_authors: ['bob'], timestamp: '2026-01-01', subject: 'feat: stuff' }],
  } } as never);
  mockSourceCode.bigOFiles.mockResolvedValue({ result: [] } as never);
  mockSonarqube.componentTree.mockResolvedValue({ result: [] } as never);
}

describe('Source Code Dashboard - User Journey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    // Code churn and coupling metrics
    expect(screen.getByText('Code Churn Over Time')).toBeInTheDocument();
    expect(screen.getByText('Code Coupling (Top 20)')).toBeInTheDocument();

    // Entity-level metrics
    expect(screen.getByText('Entity Churn (Top 20)')).toBeInTheDocument();
    expect(screen.getByText('Entity Effort (Top 20)')).toBeInTheDocument();
    expect(screen.getByText('Ownership')).toBeInTheDocument();

    // Collaboration metrics
    expect(screen.getByText('Who Paired The Most With Whom')).toBeInTheDocument();

    // Advanced analysis
    expect(screen.getByText('Layered Coupling')).toBeInTheDocument();
  });

  it('handles empty/null data gracefully', async () => {
    mockSourceCode.evaluate.mockResolvedValue(null as never);
    mockSourceCode.entityChurn.mockResolvedValue({ result: [] } as never);
    mockSourceCode.coupling.mockResolvedValue({ result: [] } as never);
    mockSourceCode.layeredCoupling.mockResolvedValue({ result: [] } as never);
    mockSourceCode.entityEffort.mockResolvedValue({ result: [] } as never);
    mockSourceCode.codeChurn.mockResolvedValue({ result: [] } as never);
    mockSourceCode.entityOwnership.mockResolvedValue({ result: [] } as never);
    mockSourceCode.pairingIndex.mockResolvedValue(null as never);
    mockSourceCode.bigOFiles.mockResolvedValue({ result: [] } as never);
    mockSonarqube.componentTree.mockResolvedValue({ result: [] } as never);

    const ui = await SourceCodePage({ searchParams: Promise.resolve({}) });
    render(<Providers>{ui}</Providers>);

    // Page should render without error even with empty data
    expect(screen.getByText('Code Churn Over Time')).toBeInTheDocument();
  });
});
