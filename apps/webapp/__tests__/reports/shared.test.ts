import { resolveReport } from '@/app/reports/shared';
import { SavedFilterBuilder, ReportEntryBuilder } from '../builders/builders';

jest.mock('@/server/api/client');
jest.mock('@/server/api/pipeline', () => ({ pipelineAPI: { evaluate: jest.fn() } }));
jest.mock('@/server/api/changeRequest', () => ({ changeRequestAPI: { evaluate: jest.fn() } }));
jest.mock('@/server/api/sourceCode', () => ({ sourceCodeAPI: { evaluate: jest.fn() } }));
jest.mock('@/server/api/architecture', () => ({ architectureAPI: { evaluate: jest.fn() } }));
jest.mock('@/server/api/sonarqube', () => ({ sonarqubeAPI: { evaluate: jest.fn() } }));

import { pipelineAPI } from '@/server/api/pipeline';
import { changeRequestAPI } from '@/server/api/changeRequest';
import { sourceCodeAPI } from '@/server/api/sourceCode';
import { architectureAPI } from '@/server/api/architecture';
import { sonarqubeAPI } from '@/server/api/sonarqube';

type TestFilterSection = 'pipelines' | 'change-requests' | 'source-code' | 'architecture' | 'sonarqube';

function evaluateMock(section: TestFilterSection): jest.Mock {
  switch (section) {
    case 'change-requests': return changeRequestAPI.evaluate as jest.Mock;
    case 'pipelines': return pipelineAPI.evaluate as jest.Mock;
    case 'source-code': return sourceCodeAPI.evaluate as jest.Mock;
    case 'architecture': return architectureAPI.evaluate as jest.Mock;
    case 'sonarqube': return sonarqubeAPI.evaluate as jest.Mock;
  }
}

function buildFilter(section: TestFilterSection) {
  return new SavedFilterBuilder()
    .withId(`f_${section}`)
    .withName(`Filter for ${section}`)
    .withSection(section)
    .build();
}

describe('resolveReport', () => {
  it('dispatches to the correct evaluate endpoint per section and returns results', async () => {
    const pipelineEval = evaluateMock('pipelines');
    const prEval = evaluateMock('change-requests');

    pipelineEval.mockResolvedValue({ generatedAt: 't1', signals: [], summary: { totalRuns: 42 } });
    prEval.mockResolvedValue({ generatedAt: 't2', signals: [], summary: { totalChangeRequests: 7 } });

    const result = await resolveReport(
      new ReportEntryBuilder()
        .withId('r1')
        .withName('Report 1')
        .withSections([
          { section: 'pipelines', savedFilterId: 'f_pipelines' },
          { section: 'change-requests', savedFilterId: 'f_change-requests' },
        ])
        .build(),
      new Map([
        ['f_pipelines', buildFilter('pipelines')],
        ['f_change-requests', buildFilter('change-requests')],
      ]),
    );

    expect(result.windows[0].evaluations['pipelines-f_pipelines']).toEqual({ generatedAt: 't1', signals: [], summary: { totalRuns: 42 } });
    expect(result.windows[0].evaluations['change-requests-f_change-requests']).toEqual({ generatedAt: 't2', signals: [], summary: { totalChangeRequests: 7 } });
    expect(result.windows[0].errors).toEqual({});
  });

  it('reports missing filter references in errors', async () => {
    const result = await resolveReport(
      new ReportEntryBuilder()
        .withId('r1')
        .withName('Report 1')
        .withSections([{ section: 'pipelines', savedFilterId: 'deleted-id' }])
        .build(),
      new Map(),
    );

    expect(result.windows[0].errors['pipelines-deleted-id']).toBe('Referenced saved filter not found.');
    expect(result.windows[0].evaluations['pipelines-deleted-id']).toBeUndefined();
  });

  it('overrides startDate and endDate from the report onto the saved filter before evaluate', async () => {
    const pipelineEval = evaluateMock('pipelines');
    pipelineEval.mockResolvedValue({ generatedAt: '', signals: [], summary: {} });

    await resolveReport(
      new ReportEntryBuilder()
        .withId('r1')
        .withName('Override Report')
        .withSections([{ section: 'pipelines', savedFilterId: 'f_pipelines' }])
        .withStartDateOverride('2026-06-01')
        .withEndDateOverride('2026-06-30')
        .build(),
      new Map([['f_pipelines', buildFilter('pipelines')]]),
    );

    const params = pipelineEval.mock.calls[0][0];
    expect(params.start_date).toBe('2026-06-01');
    expect(params.end_date).toBe('2026-06-30');
  });

  it('surfaces evaluate API errors per-section', async () => {
    const pipelineEval = evaluateMock('pipelines');
    pipelineEval.mockRejectedValue(new Error('Service unavailable'));

    const result = await resolveReport(
      new ReportEntryBuilder()
        .withId('r1')
        .withName('Error Report')
        .withSections([{ section: 'pipelines', savedFilterId: 'f_pipelines' }])
        .build(),
      new Map([['f_pipelines', buildFilter('pipelines')]]),
    );

    expect(result.windows[0].errors['pipelines-f_pipelines']).toBe('Service unavailable');
    expect(result.windows[0].evaluations['pipelines-f_pipelines']).toBeUndefined();
  });

  it('dispatches to every section type correctly', async () => {
    for (const section of ['pipelines', 'change-requests', 'source-code', 'architecture', 'sonarqube'] as TestFilterSection[]) {
      evaluateMock(section).mockResolvedValue({ generatedAt: '', signals: [], summary: {} });
    }

    const result = await resolveReport(
      new ReportEntryBuilder()
        .withId('r1')
        .withName('Full Report')
        .withSections([
          { section: 'pipelines', savedFilterId: 'f_pipelines' },
          { section: 'change-requests', savedFilterId: 'f_change-requests' },
          { section: 'source-code', savedFilterId: 'f_source-code' },
          { section: 'architecture', savedFilterId: 'f_architecture' },
          { section: 'sonarqube', savedFilterId: 'f_sonarqube' },
        ])
        .build(),
      new Map([
        ['f_pipelines', buildFilter('pipelines')],
        ['f_change-requests', buildFilter('change-requests')],
        ['f_source-code', buildFilter('source-code')],
        ['f_architecture', buildFilter('architecture')],
        ['f_sonarqube', buildFilter('sonarqube')],
      ]),
    );

    expect(result.windows[0].evaluations['pipelines-f_pipelines']).toBeDefined();
    expect(result.windows[0].evaluations['change-requests-f_change-requests']).toBeDefined();
    expect(result.windows[0].evaluations['source-code-f_source-code']).toBeDefined();
    expect(result.windows[0].evaluations['architecture-f_architecture']).toBeDefined();
    expect(result.windows[0].evaluations['sonarqube-f_sonarqube']).toBeDefined();
    expect(result.windows[0].errors).toEqual({});
  });

  it('resolves multiple windows when dateWindows are provided', async () => {
    const pipelineEval = evaluateMock('pipelines');
    pipelineEval
      .mockResolvedValueOnce({ generatedAt: 'w1', signals: [], summary: { totalRuns: 10 } })
      .mockResolvedValueOnce({ generatedAt: 'w2', signals: [], summary: { totalRuns: 20 } });

    const result = await resolveReport(
      new ReportEntryBuilder()
        .withId('r1')
        .withName('Multi Window Report')
        .withSections([{ section: 'pipelines', savedFilterId: 'f_pipelines' }])
        .withDateWindows([
          { startDate: '2026-06-01', endDate: '2026-06-07', label: 'Week 1' },
          { startDate: '2026-06-08', endDate: '2026-06-14', label: 'Week 2' },
        ])
        .build(),
      new Map([['f_pipelines', buildFilter('pipelines')]]),
    );

    expect(result.windows).toHaveLength(2);
    expect(result.windows[0].window?.label).toBe('Week 1');
    expect(result.windows[1].window?.label).toBe('Week 2');
    expect(result.windows[0].evaluations['pipelines-f_pipelines']).toEqual({
      generatedAt: 'w1', signals: [], summary: { totalRuns: 10 },
    });
    expect(result.windows[1].evaluations['pipelines-f_pipelines']).toEqual({
      generatedAt: 'w2', signals: [], summary: { totalRuns: 20 },
    });
  });
});
