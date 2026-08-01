import { resolveReport } from '@/app/reports/shared';

jest.mock('@/server/api/client');
jest.mock('@/server/api/pipeline', () => ({ pipelineAPI: { evaluate: jest.fn() } }));
jest.mock('@/server/api/pullRequest', () => ({ pullRequestAPI: { evaluate: jest.fn() } }));
jest.mock('@/server/api/sourceCode', () => ({ sourceCodeAPI: { evaluate: jest.fn() } }));
jest.mock('@/server/api/architecture', () => ({ architectureAPI: { evaluate: jest.fn() } }));
jest.mock('@/server/api/sonarqube', () => ({ sonarqubeAPI: { evaluate: jest.fn() } }));

import { pipelineAPI } from '@/server/api/pipeline';
import { pullRequestAPI } from '@/server/api/pullRequest';
import { sourceCodeAPI } from '@/server/api/sourceCode';
import { architectureAPI } from '@/server/api/architecture';
import { sonarqubeAPI } from '@/server/api/sonarqube';

type TestFilterSection = 'pipelines' | 'pull-requests' | 'source-code' | 'architecture' | 'sonarqube';

function evaluateMock(section: TestFilterSection): jest.Mock {
  switch (section) {
    case 'pull-requests': return pullRequestAPI.evaluate as jest.Mock;
    case 'pipelines': return pipelineAPI.evaluate as jest.Mock;
    case 'source-code': return sourceCodeAPI.evaluate as jest.Mock;
    case 'architecture': return architectureAPI.evaluate as jest.Mock;
    case 'sonarqube': return sonarqubeAPI.evaluate as jest.Mock;
  }
}

function makeFilter(section: TestFilterSection, overrides: Record<string, unknown> = {}) {
  return {
    id: `f_${section}`,
    name: `Filter for ${section}`,
    section,
    pathname: `/dashboard/${section}`,
    filters: {
      startDate: '',
      endDate: '',
      timezone: '',
      workflowStatus: [],
      workflowConclusions: [],
      jobSelector: [],
      branch: [],
      event: [],
      authorSelect: [],
      excludeAuthorSelect: [],
      excludeCommenterSelect: [],
      labelSelector: [],
      aggregateBy: 'week' as const,
      weekends: 'include' as const,
      outlierMode: 'include' as const,
      compareStartDate: '',
      compareEndDate: '',
      rawFilters: '',
      period: 'week' as const,
      ignorePatternFiles: '',
      includePatternFiles: '',
      authorSelectSourceCode: [],
      topEntries: 20,
      aggregateMetric: 'avg',
      sonarqubeRemoveFolders: true,
      method: 'average',
      ...overrides,
    },
    repository: 'owner/repo',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('resolveReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('dispatches to the correct evaluate endpoint per section and returns results', async () => {
    const pipelineEval = evaluateMock('pipelines');
    const prEval = evaluateMock('pull-requests');

    pipelineEval.mockResolvedValue({ generatedAt: 't1', signals: [], summary: { totalRuns: 42 } });
    prEval.mockResolvedValue({ generatedAt: 't2', signals: [], summary: { totalPRs: 7 } });

    const result = await resolveReport(
      {
        id: 'r1',
        name: 'Report 1',
        repository: 'owner/repo',
        sections: [
          { section: 'pipelines', savedFilterId: 'f_pipelines' },
          { section: 'pull-requests' as const, savedFilterId: 'f_pull-requests' },
        ],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      new Map([
        ['f_pipelines', makeFilter('pipelines')],
        ['f_pull-requests', makeFilter('pull-requests')],
      ]),
    );

    expect(result.windows[0].evaluations.pipelines).toEqual({ generatedAt: 't1', signals: [], summary: { totalRuns: 42 } });
    expect(result.windows[0].evaluations['pull-requests']).toEqual({ generatedAt: 't2', signals: [], summary: { totalPRs: 7 } });
    expect(result.windows[0].errors).toEqual({});
  });

  it('reports missing filter references in errors', async () => {
    const result = await resolveReport(
      {
        id: 'r1',
        name: 'Report 1',
        repository: 'owner/repo',
        sections: [{ section: 'pipelines', savedFilterId: 'deleted-id' }],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      new Map(),
    );

    expect(result.windows[0].errors.pipelines).toBe('Referenced saved filter not found.');
    expect(result.windows[0].evaluations.pipelines).toBeUndefined();
  });

  it('overrides startDate and endDate from the report onto the saved filter before evaluate', async () => {
    const pipelineEval = evaluateMock('pipelines');
    pipelineEval.mockResolvedValue({ generatedAt: '', signals: [], summary: {} });

    await resolveReport(
      {
        id: 'r1',
        name: 'Override Report',
        repository: 'owner/repo',
        sections: [{ section: 'pipelines', savedFilterId: 'f_pipelines' }],
        startDateOverride: '2026-06-01',
        endDateOverride: '2026-06-30',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      new Map([['f_pipelines', makeFilter('pipelines')]]),
    );

    const params = pipelineEval.mock.calls[0][0];
    expect(params.start_date).toBe('2026-06-01');
    expect(params.end_date).toBe('2026-06-30');
  });

  it('surfaces evaluate API errors per-section', async () => {
    const pipelineEval = evaluateMock('pipelines');
    pipelineEval.mockRejectedValue(new Error('Service unavailable'));

    const result = await resolveReport(
      {
        id: 'r1',
        name: 'Error Report',
        repository: 'owner/repo',
        sections: [{ section: 'pipelines', savedFilterId: 'f_pipelines' }],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      new Map([['f_pipelines', makeFilter('pipelines')]]),
    );

    expect(result.windows[0].errors.pipelines).toBe('Service unavailable');
    expect(result.windows[0].evaluations.pipelines).toBeUndefined();
  });

  it('dispatches to every section type correctly', async () => {
    for (const section of ['pipelines', 'pull-requests', 'source-code', 'architecture', 'sonarqube'] as TestFilterSection[]) {
      evaluateMock(section).mockResolvedValue({ generatedAt: '', signals: [], summary: {} });
    }

    const result = await resolveReport(
      {
        id: 'r1',
        name: 'Full Report',
        repository: 'owner/repo',
        sections: [
          { section: 'pipelines', savedFilterId: 'f_pipelines' },
          { section: 'pull-requests' as const, savedFilterId: 'f_pull-requests' },
          { section: 'source-code' as const, savedFilterId: 'f_source-code' },
          { section: 'architecture' as const, savedFilterId: 'f_architecture' },
          { section: 'sonarqube' as const, savedFilterId: 'f_sonarqube' },
        ],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      new Map([
        ['f_pipelines', makeFilter('pipelines')],
        ['f_pull-requests', makeFilter('pull-requests')],
        ['f_source-code', makeFilter('source-code')],
        ['f_architecture', makeFilter('architecture')],
        ['f_sonarqube', makeFilter('sonarqube')],
      ]),
    );

    expect(result.windows[0].evaluations.pipelines).toBeDefined();
    expect(result.windows[0].evaluations['pull-requests']).toBeDefined();
    expect(result.windows[0].evaluations['source-code']).toBeDefined();
    expect(result.windows[0].evaluations.architecture).toBeDefined();
    expect(result.windows[0].evaluations.sonarqube).toBeDefined();
    expect(result.windows[0].errors).toEqual({});
  });

  it('resolves multiple windows when dateWindows are provided', async () => {
    const pipelineEval = evaluateMock('pipelines');
    pipelineEval
      .mockResolvedValueOnce({ generatedAt: 'w1', signals: [], summary: { totalRuns: 10 } })
      .mockResolvedValueOnce({ generatedAt: 'w2', signals: [], summary: { totalRuns: 20 } });

    const result = await resolveReport(
      {
        id: 'r1',
        name: 'Multi Window Report',
        repository: 'owner/repo',
        sections: [{ section: 'pipelines', savedFilterId: 'f_pipelines' }],
        dateWindows: [
          { startDate: '2026-06-01', endDate: '2026-06-07', label: 'Week 1' },
          { startDate: '2026-06-08', endDate: '2026-06-14', label: 'Week 2' },
        ],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      new Map([['f_pipelines', makeFilter('pipelines')]]),
    );

    expect(result.windows).toHaveLength(2);
    expect(result.windows[0].window?.label).toBe('Week 1');
    expect(result.windows[1].window?.label).toBe('Week 2');
    expect(result.windows[0].evaluations.pipelines).toEqual({
      generatedAt: 'w1', signals: [], summary: { totalRuns: 10 },
    });
    expect(result.windows[1].evaluations.pipelines).toEqual({
      generatedAt: 'w2', signals: [], summary: { totalRuns: 20 },
    });
  });
});
