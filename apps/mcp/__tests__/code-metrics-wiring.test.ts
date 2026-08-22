import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Regression tests for the wiring bug where `smm_get_code_metrics` and
 * `smm_evaluate_code` advertised `includePatterns` / `ignorePatterns` in their
 * input schema but silently dropped them before calling the reader.
 *
 * The `metrics-reader` module is mocked so the tool handlers run without a
 * configured data store. The mock captures the forwarded filters.
 */
const getCodeMetricsMock = vi.fn(async () => ({
  pairingIndex: null,
  codeChurn: { data: [] },
  fileCoupling: [],
}));
const evaluateCodeMock = vi.fn(async () => ({ signals: [] }));

vi.mock('../src/metrics-reader', () => ({
  McpMetricsReader: vi.fn(),
  createMcpMetricsReader: vi.fn(() => ({
    getCodeMetrics: getCodeMetricsMock,
    evaluateCode: evaluateCodeMock,
  })),
}));

const { tools, findTool } = await import('../src/tools');

describe('code metrics pattern filter wiring', () => {
  beforeEach(() => {
    getCodeMetricsMock.mockClear();
    evaluateCodeMock.mockClear();
  });

  it('smm_get_code_metrics forwards includePatterns and ignorePatterns to the reader', async () => {
    const tool = findTool('smm_get_code_metrics');
    expect(tool).toBeDefined();

    await tool!.handler({
      project: 'owner/repo',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      authors: 'alice',
      includePatterns: 'src/**',
      ignorePatterns: '**/*.spec.ts',
    });

    expect(getCodeMetricsMock).toHaveBeenCalledTimes(1);
    expect(getCodeMetricsMock).toHaveBeenCalledWith({
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      authors: 'alice',
      includePatterns: 'src/**',
      ignorePatterns: '**/*.spec.ts',
    });
  });

  it('smm_get_code_metrics forwards undefined patterns when omitted', async () => {
    const tool = findTool('smm_get_code_metrics');
    expect(tool).toBeDefined();

    await tool!.handler({
      project: 'owner/repo',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    });

    expect(getCodeMetricsMock).toHaveBeenCalledTimes(1);
    expect(getCodeMetricsMock).toHaveBeenCalledWith({
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      authors: undefined,
      includePatterns: undefined,
      ignorePatterns: undefined,
    });
  });

  it('smm_evaluate_code forwards includePatterns and ignorePatterns to the reader', async () => {
    const tool = findTool('smm_evaluate_code');
    expect(tool).toBeDefined();

    await tool!.handler({
      project: 'owner/repo',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      authors: 'bob',
      includePatterns: 'apps/**',
      ignorePatterns: '**/*.test.ts',
    });

    expect(evaluateCodeMock).toHaveBeenCalledTimes(1);
    expect(evaluateCodeMock).toHaveBeenCalledWith({
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      authors: 'bob',
      includePatterns: 'apps/**',
      ignorePatterns: '**/*.test.ts',
    });
  });

  it('smm_evaluate_code forwards undefined patterns when omitted', async () => {
    const tool = findTool('smm_evaluate_code');
    expect(tool).toBeDefined();

    await tool!.handler({
      project: 'owner/repo',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    });

    expect(evaluateCodeMock).toHaveBeenCalledTimes(1);
    expect(evaluateCodeMock).toHaveBeenCalledWith({
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      authors: undefined,
      includePatterns: undefined,
      ignorePatterns: undefined,
    });
  });

  it('tools array includes both smm_get_code_metrics and smm_evaluate_code', () => {
    const names = tools.map((t) => t.name);
    expect(names).toContain('smm_get_code_metrics');
    expect(names).toContain('smm_evaluate_code');
  });
});
