import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Parity improvement tests — verifies that the MCP tool handlers forward all
 * new filter fields (rawFilters, filter, period, aggregateBy, minCoupling,
 * minShared, authors, entity, section) to the reader methods.
 *
 * The `metrics-reader` module is mocked so the tool handlers run without a
 * configured data store. Each mock captures the forwarded arguments.
 */
const mocks = {
  getChangeRequestSummary: vi.fn(async () => ({})),
  getChangeRequestThroughTime: vi.fn(async () => ({})),
  getChangeRequestReviewTime: vi.fn(async () => ({})),
  getChangeRequestOpenTime: vi.fn(async () => ({})),
  getChangeRequestComments: vi.fn(async () => ({})),
  getChangeRequestMetricsByMonth: vi.fn(async () => ({})),
  getChangeRequestMetricsByWeek: vi.fn(async () => ({})),
  getPipelineDashboard: vi.fn(async () => ({ runs_by: [] })),
  getDoraMetrics: vi.fn(async () => ({})),
  getCodePairingIndex: vi.fn(async () => ({})),
  getCodeChurn: vi.fn(async () => ({})),
  getCodeCoupling: vi.fn(async () => []),
  getCodeEntityOwnership: vi.fn(async () => []),
  listSavedFilters: vi.fn(async () => ({ version: 1, filters: [], reports: [] })),
  getSavedFilter: vi.fn(async () => null),
};

vi.mock('../src/metrics-reader', () => ({
  McpMetricsReader: vi.fn(),
  createMcpMetricsReader: vi.fn(() => mocks),
}));

const { tools, findTool } = await import('../src/tools');

describe('change request rawFilters and filter wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('smm_get_change_request_summary forwards rawFilters and filter', async () => {
    const tool = findTool('smm_get_change_request_summary');
    expect(tool).toBeDefined();

    await tool!.handler({
      project: 'owner/repo',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      rawFilters: 'status=draft,author=john',
      filter: 'my-saved-filter',
    });

    expect(mocks.getChangeRequestSummary).toHaveBeenCalledTimes(1);
    const forwarded = mocks.getChangeRequestSummary.mock.calls[0][0];
    expect(forwarded.rawFilters).toBe('status=draft,author=john');
    expect(forwarded.filter).toBe('my-saved-filter');
  });

  it('smm_get_change_request_review_time forwards rawFilters and filter', async () => {
    const tool = findTool('smm_get_change_request_review_time');
    expect(tool).toBeDefined();

    await tool!.handler({
      project: 'owner/repo',
      rawFilters: 'status=merged',
      filter: 'ci-filter',
    });

    expect(mocks.getChangeRequestReviewTime).toHaveBeenCalledTimes(1);
    const forwarded = mocks.getChangeRequestReviewTime.mock.calls[0][0];
    expect(forwarded.rawFilters).toBe('status=merged');
    expect(forwarded.filter).toBe('ci-filter');
  });

  it('smm_get_change_request_open_time forwards rawFilters and filter', async () => {
    const tool = findTool('smm_get_change_request_open_time');
    expect(tool).toBeDefined();

    await tool!.handler({
      project: 'owner/repo',
      rawFilters: 'label=bug',
      filter: 'bug-filter',
    });

    expect(mocks.getChangeRequestOpenTime).toHaveBeenCalledTimes(1);
    const forwarded = mocks.getChangeRequestOpenTime.mock.calls[0][0];
    expect(forwarded.rawFilters).toBe('label=bug');
    expect(forwarded.filter).toBe('bug-filter');
  });

  it('smm_get_change_request_through_time forwards rawFilters and filter', async () => {
    const tool = findTool('smm_get_change_request_through_time');
    expect(tool).toBeDefined();

    await tool!.handler({
      project: 'owner/repo',
      rawFilters: 'author=alice',
      filter: 'alice-filter',
    });

    expect(mocks.getChangeRequestThroughTime).toHaveBeenCalledTimes(1);
    const forwarded = mocks.getChangeRequestThroughTime.mock.calls[0][0];
    expect(forwarded.rawFilters).toBe('author=alice');
    expect(forwarded.filter).toBe('alice-filter');
  });
});

describe('change request comments aggregateBy wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('smm_get_change_request_comments forwards aggregateBy', async () => {
    const tool = findTool('smm_get_change_request_comments');
    expect(tool).toBeDefined();

    await tool!.handler({
      project: 'owner/repo',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      aggregateBy: 'month',
      method: 'median',
    });

    expect(mocks.getChangeRequestComments).toHaveBeenCalledTimes(1);
    const forwarded = mocks.getChangeRequestComments.mock.calls[0][0];
    expect(forwarded.aggregateBy).toBe('month');
    expect(forwarded.method).toBe('median');
  });
});

describe('change request by-month and by-week tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('smm_get_change_request_metrics_by_month exists and forwards to reader', async () => {
    const tool = findTool('smm_get_change_request_metrics_by_month');
    expect(tool).toBeDefined();

    await tool!.handler({
      project: 'owner/repo',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      method: 'p90',
    });

    expect(mocks.getChangeRequestMetricsByMonth).toHaveBeenCalledTimes(1);
    const forwarded = mocks.getChangeRequestMetricsByMonth.mock.calls[0][0];
    expect(forwarded.startDate).toBe('2026-07-01');
    expect(forwarded.method).toBe('p90');
  });

  it('smm_get_change_request_metrics_by_week exists and forwards to reader', async () => {
    const tool = findTool('smm_get_change_request_metrics_by_week');
    expect(tool).toBeDefined();

    await tool!.handler({
      project: 'owner/repo',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      method: 'average',
    });

    expect(mocks.getChangeRequestMetricsByWeek).toHaveBeenCalledTimes(1);
    const forwarded = mocks.getChangeRequestMetricsByWeek.mock.calls[0][0];
    expect(forwarded.startDate).toBe('2026-07-01');
    expect(forwarded.method).toBe('average');
  });
});

describe('pipeline rawFilters, filter, and period wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('smm_get_pipeline_dashboard forwards rawFilters, filter, and period', async () => {
    const tool = findTool('smm_get_pipeline_dashboard');
    expect(tool).toBeDefined();

    await tool!.handler({
      project: 'owner/repo',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      rawFilters: 'status=success,branch=main',
      filter: 'ci-main',
      period: 'week',
    });

    expect(mocks.getPipelineDashboard).toHaveBeenCalledTimes(1);
    const forwarded = mocks.getPipelineDashboard.mock.calls[0][0];
    expect(forwarded.rawFilters).toBe('status=success,branch=main');
    expect(forwarded.filter).toBe('ci-main');
    expect(forwarded.period).toBe('week');
  });

  it('smm_get_dora_metrics forwards rawFilters, filter, and period', async () => {
    const tool = findTool('smm_get_dora_metrics');
    expect(tool).toBeDefined();

    await tool!.handler({
      project: 'owner/repo',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      rawFilters: 'branch=main',
      filter: 'deploy-filter',
      period: 'day',
    });

    expect(mocks.getDoraMetrics).toHaveBeenCalledTimes(1);
    const forwarded = mocks.getDoraMetrics.mock.calls[0][0];
    expect(forwarded.rawFilters).toBe('branch=main');
    expect(forwarded.filter).toBe('deploy-filter');
    expect(forwarded.period).toBe('day');
  });
});

describe('code numeric threshold wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('smm_get_code_pairing_index forwards minShared', async () => {
    const tool = findTool('smm_get_code_pairing_index');
    expect(tool).toBeDefined();

    await tool!.handler({
      project: 'owner/repo',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      minShared: 5,
    });

    expect(mocks.getCodePairingIndex).toHaveBeenCalledTimes(1);
    const forwarded = mocks.getCodePairingIndex.mock.calls[0][0];
    expect(forwarded.minShared).toBe(5);
  });

  it('smm_get_code_churn forwards authors for per-author churn', async () => {
    const tool = findTool('smm_get_code_churn');
    expect(tool).toBeDefined();

    await tool!.handler({
      project: 'owner/repo',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      authors: 'alice,bob',
    });

    expect(mocks.getCodeChurn).toHaveBeenCalledTimes(1);
    const forwarded = mocks.getCodeChurn.mock.calls[0][0];
    expect(forwarded.authors).toBe('alice,bob');
  });

  it('smm_get_code_coupling forwards minCoupling', async () => {
    const tool = findTool('smm_get_code_coupling');
    expect(tool).toBeDefined();

    await tool!.handler({
      project: 'owner/repo',
      minCoupling: 50,
      includePatterns: 'src/**',
    });

    expect(mocks.getCodeCoupling).toHaveBeenCalledTimes(1);
    const forwarded = mocks.getCodeCoupling.mock.calls[0][0];
    expect(forwarded.minCoupling).toBe(50);
  });

  it('smm_get_code_entity_ownership forwards entity filter', async () => {
    const tool = findTool('smm_get_code_entity_ownership');
    expect(tool).toBeDefined();

    await tool!.handler({
      project: 'owner/repo',
      entity: 'src/index',
    });

    expect(mocks.getCodeEntityOwnership).toHaveBeenCalledTimes(1);
    const forwarded = mocks.getCodeEntityOwnership.mock.calls[0][0];
    expect(forwarded.entity).toBe('src/index');
  });
});

describe('saved filter tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('smm_list_saved_filters forwards section filter', async () => {
    const tool = findTool('smm_list_saved_filters');
    expect(tool).toBeDefined();

    await tool!.handler({
      project: 'owner/repo',
      section: 'pipelines',
    });

    expect(mocks.listSavedFilters).toHaveBeenCalledTimes(1);
    const forwarded = mocks.listSavedFilters.mock.calls[0][0];
    expect(forwarded.section).toBe('pipelines');
  });

  it('smm_get_saved_filter exists and forwards name', async () => {
    const tool = findTool('smm_get_saved_filter');
    expect(tool).toBeDefined();

    await tool!.handler({
      project: 'owner/repo',
      name: 'CI Main',
    });

    expect(mocks.getSavedFilter).toHaveBeenCalledTimes(1);
    const forwarded = mocks.getSavedFilter.mock.calls[0][0];
    expect(forwarded.name).toBe('CI Main');
  });
});

describe('tools list includes all new tools', () => {
  it('contains all parity improvement tools', () => {
    const names = tools.map((t) => t.name);
    expect(names).toContain('smm_get_change_request_metrics_by_month');
    expect(names).toContain('smm_get_change_request_metrics_by_week');
    expect(names).toContain('smm_get_saved_filter');
  });
});
