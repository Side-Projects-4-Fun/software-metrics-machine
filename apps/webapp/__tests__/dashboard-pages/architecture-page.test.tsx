import React from "react";
import { render, screen } from "@testing-library/react";
import ArchitecturePage from "@/app/dashboard/architecture/page";
import { architectureAPI } from "@/server/api/architecture";
import type { ArchitectureSummary, ArchitectureView, ArchitectureEvaluation } from "@/server/api/architecture";
import { FiltersProvider } from "@/components/filters/FiltersContext";

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  usePathname: jest.fn(() => '/dashboard/architecture'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(() => undefined),
  })),
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href, 'data-testid': 'mock-link' }, children);
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('@/server/api/architecture', () => ({
  architectureAPI: {
    summary: jest.fn(),
    view: jest.fn(),
    evaluate: jest.fn(),
  },
}));

jest.mock('mermaid', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    render: jest.fn().mockResolvedValue({ svg: '<svg data-testid="mermaid-svg">mock-svg</svg>' }),
  },
}));

const mockArchitectureAPI = architectureAPI as jest.Mocked<typeof architectureAPI>;

const mockSummary: ArchitectureSummary = {
  snapshot_id: 'snapshot-1',
  generated_at: '2026-01-01T00:00:00Z',
  project: 'my-project',
  commit_count: 42,
  views: [
    { level: 'context', title: 'System Context', nodes: 3, edges: 2 },
    { level: 'container', title: 'Containers', nodes: 5, edges: 4 },
  ],
};

const mockView: ArchitectureView = {
  id: 'view-1',
  level: 'container',
  title: 'Containers',
  nodes: [
    { id: 'web', kind: 'container', name: 'Web App', technology: 'Next.js', description: 'Frontend' },
    { id: 'api', kind: 'container', name: 'API', technology: 'NestJS', description: 'Backend' },
  ],
  edges: [
    { id: 'e1', source: 'web', target: 'api', kind: 'uses', description: 'HTTP', confidence: 0.95 },
  ],
};

const mockEvaluation: ArchitectureEvaluation = {
  generatedAt: '2026-01-01T00:00:00Z',
  signals: [
    { id: 's1', title: 'Healthy Architecture', description: 'All good', severity: 'good', category: 'structure', metrics: [] },
  ],
  summary: {
    totalContainers: 2,
    totalEdges: 1,
    avgConfidence: 95,
    orphanNodes: 0,
  },
};

describe('Architecture Dashboard - User Journey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockArchitectureAPI.summary.mockResolvedValue({ result: mockSummary } as never);
    mockArchitectureAPI.view.mockResolvedValue({ result: mockView } as never);
    mockArchitectureAPI.evaluate.mockResolvedValue(mockEvaluation as never);
  });

  it('shows snapshot metadata when data is loaded', async () => {
    const ui = await ArchitecturePage({ searchParams: Promise.resolve({}) });
    render(<FiltersProvider>{ui}</FiltersProvider>);

    expect(screen.getByText('Architecture Snapshot')).toBeInTheDocument();
    expect(screen.getByText('snapshot-1')).toBeInTheDocument();
    expect(screen.getByText('2026-01-01T00:00:00Z')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders the view title and diagram', async () => {
    const ui = await ArchitecturePage({ searchParams: Promise.resolve({}) });
    render(<FiltersProvider>{ui}</FiltersProvider>);

    expect(screen.getAllByText('Containers')).toHaveLength(2);
    expect(screen.getByText('Mermaid C4 Diagram')).toBeInTheDocument();
    await screen.findByTestId('mermaid-svg');
  });

  it('renders evaluation card when evaluation data is available', async () => {
    const ui = await ArchitecturePage({ searchParams: Promise.resolve({}) });
    render(<FiltersProvider>{ui}</FiltersProvider>);

    expect(screen.getByText('Architecture Health Summary')).toBeInTheDocument();
  });

  it('renders elements list from view nodes', async () => {
    const ui = await ArchitecturePage({ searchParams: Promise.resolve({}) });
    render(<FiltersProvider>{ui}</FiltersProvider>);

    expect(screen.getByText('Elements')).toBeInTheDocument();
    expect(screen.getByText('Web App')).toBeInTheDocument();
    expect(screen.getByText('API')).toBeInTheDocument();
    expect(screen.getByText('Next.js')).toBeInTheDocument();
  });

  it('renders relationships list from view edges', async () => {
    const ui = await ArchitecturePage({ searchParams: Promise.resolve({}) });
    render(<FiltersProvider>{ui}</FiltersProvider>);

    expect(screen.getByText('Relationships')).toBeInTheDocument();
    expect(screen.getByText('Confidence: 95%')).toBeInTheDocument();
  });

  it('renders architecture level tabs', async () => {
    const ui = await ArchitecturePage({ searchParams: Promise.resolve({}) });
    render(<FiltersProvider>{ui}</FiltersProvider>);

    expect(screen.getByText('CONTEXT')).toBeInTheDocument();
    expect(screen.getByText('CONTAINER')).toBeInTheDocument();
  });

  it('shows empty state when no snapshot is available', async () => {
    mockArchitectureAPI.summary.mockResolvedValue({ result: null } as never);
    mockArchitectureAPI.view.mockResolvedValue({ result: null } as never);

    const ui = await ArchitecturePage({ searchParams: Promise.resolve({}) });
    render(<FiltersProvider>{ui}</FiltersProvider>);

    expect(screen.getByText('No architecture snapshot available')).toBeInTheDocument();
    expect(screen.getByText(/Run CLI generation first/)).toBeInTheDocument();
  });

  it('hides evaluation card when evaluate returns null', async () => {
    mockArchitectureAPI.evaluate.mockResolvedValue(null as never);

    const ui = await ArchitecturePage({ searchParams: Promise.resolve({}) });
    render(<FiltersProvider>{ui}</FiltersProvider>);

    expect(screen.queryByText('Architecture Health Summary')).not.toBeInTheDocument();
  });

  it('renders with selected level from search params', async () => {
    // Override view mock to return context-level view for this test
    const contextView: ArchitectureView = { ...mockView, level: 'context', title: 'System Context' };
    mockArchitectureAPI.view.mockResolvedValue({ result: contextView } as never);

    const ui = await ArchitecturePage({ searchParams: Promise.resolve({ level: 'context' }) });
    render(<FiltersProvider>{ui}</FiltersProvider>);

    expect(screen.getByText('System Context')).toBeInTheDocument();
  });
});
