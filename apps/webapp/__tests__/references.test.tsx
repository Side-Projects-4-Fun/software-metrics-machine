import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReferencesPage from '@/app/dashboard/references/page';
import { MetricCatalogEntryBuilder } from './builders/api-response/metric-catalog.builder';
import { renderWithProviders } from './utils/test-providers';
import { suppressConsoleError } from './utils/suppress-console';

const mockGetMetricCatalog = jest.fn();

jest.mock('@/server/metric-catalog', () => ({
  getMetricCatalog: () => mockGetMetricCatalog(),
}));

jest.mock('@mui/icons-material/ExpandMore', () => {
  const MockIcon = () => <span data-testid="icon-expand-more" />;
  return { __esModule: true, default: MockIcon };
});
jest.mock('@mui/icons-material/ExpandLess', () => {
  const MockIcon = () => <span data-testid="icon-expand-less" />;
  return { __esModule: true, default: MockIcon };
});

const reviewTime = new MetricCatalogEntryBuilder()
  .withId('cr-review-time')
  .withNamespace('cr')
  .withLabel('Review time')
  .withDescription('Days from change request creation to review.')
  .withDirection('lower_is_better')
  .withTarget({ operator: 'lt', value: 24, description: '< 24 hours' })
  .withSources([
    {
      label: 'Forsgren et al. (2018) — Accelerate: The Science of Lean Software and DevOps',
      url: 'https://itrevolution.com/product/accelerate/',
    },
    {
      label: 'Bacchelli & Bird (2013) — ICSE on expectations and challenges of modern code review',
      url: 'https://doi.org/10.1109/ICSE.2013.6606625',
    },
  ])
  .build();

const bigO = new MetricCatalogEntryBuilder()
  .withId('code-big-o')
  .withNamespace('code')
  .withLabel('Big O')
  .withDescription('Asymptotic complexity classification per file.')
  .build();

const undocumented = new MetricCatalogEntryBuilder()
  .withId('issue-total')
  .withNamespace('issue')
  .withLabel('Issue total')
  .withDescription('Total issues in the selected window.')
  .withTarget(undefined)
  .withSources(undefined)
  .build();

const catalog = [reviewTime, bigO, undocumented];

async function renderPage() {
  const ui = await ReferencesPage();
  return renderWithProviders(ui);
}

describe('ReferencesPage', () => {
  beforeEach(() => {
    mockGetMetricCatalog.mockResolvedValue(catalog);
  });

  it('renders the page title and description', async () => {
    await renderPage();

    expect(screen.getByText('References & Sources')).toBeInTheDocument();
    expect(screen.getByText(/Academic papers, industry reports and books/)).toBeInTheDocument();
    expect(screen.getByText('How Outliers Work In SMM')).toBeInTheDocument();
  });

  it('summarises documented metrics, sources and the full catalog', async () => {
    await renderPage();

    expect(screen.getByText('2 documented metrics')).toBeInTheDocument();
    expect(screen.getByText('5 sources')).toBeInTheDocument();
    expect(screen.getByText('3 catalogued metrics')).toBeInTheDocument();
  });

  it('groups documented metrics by catalog namespace', async () => {
    await renderPage();

    expect(screen.getByText('Change Requests')).toBeInTheDocument();
    expect(screen.getByText('Source Code')).toBeInTheDocument();
    expect(screen.queryByText('Issues')).not.toBeInTheDocument();
  });

  it('renders catalog ids, targets and descriptions', async () => {
    await renderPage();

    expect(screen.getByText('Review time')).toBeInTheDocument();
    expect(screen.getByText('cr-review-time')).toBeInTheDocument();
    expect(screen.getByText('< 24 hours')).toBeInTheDocument();
    expect(screen.getByText(/Days from change request creation to review\./)).toBeInTheDocument();

    expect(screen.getByText('Big O')).toBeInTheDocument();
    expect(screen.getByText('Review O(n^2+) hotspots')).toBeInTheDocument();
  });

  it('shows how many sources back each metric', async () => {
    await renderPage();

    expect(screen.getByText('2 sources available')).toBeInTheDocument();
  });

  it('expands the external references of a metric', async () => {
    await renderPage();

    await userEvent.click(screen.getAllByLabelText('expand sources')[0]);

    expect(screen.getAllByText(/Forsgren et al\. \(2018\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bacchelli & Bird \(2013\)/).length).toBeGreaterThan(0);
  });

  it('collapses sources again', async () => {
    await renderPage();

    await userEvent.click(screen.getAllByLabelText('expand sources')[0]);
    await userEvent.click(screen.getByLabelText('collapse sources'));

    await waitFor(() => {
      expect(screen.getAllByLabelText('expand sources').length).toBeGreaterThan(0);
    });
  });

  it('keeps the outlier references and implementation details', async () => {
    await renderPage();

    expect(screen.getByText('Pipeline Data Used')).toBeInTheDocument();
    expect(screen.getByText('Change Request Data Used')).toBeInTheDocument();
    expect(screen.getByText(/Kamei et al\. \(2013\)/)).toBeInTheDocument();
    expect(screen.getByText(/Rahman & Devanbu \(2013\)/)).toBeInTheDocument();
  });

  it('surfaces a readable error when the catalog cannot be loaded', async () => {
    const suppression = suppressConsoleError();
    mockGetMetricCatalog.mockRejectedValue(new Error('API error: unavailable'));

    await renderPage();

    expect(
      screen.getByText('Failed to load the metric catalog. Verify that the REST API is running.')
    ).toBeInTheDocument();
    expect(screen.getByText('0 documented metrics')).toBeInTheDocument();

    suppression.restore();
  });
});
