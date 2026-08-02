import { buildDashboardLink } from '@/lib/dashboard-links';
import type { DashboardFilters } from '@/components/filters/DashboardFilters';

function createFilters(overrides: Partial<DashboardFilters> = {}): DashboardFilters {
  return {
    startDate: '',
    endDate: '',
    workflowStatus: [],
    workflowConclusions: [],
    jobSelector: [],
    branch: [],
    event: [],
    authorSelect: [],
    excludeAuthorSelect: [],
    excludeCommenterSelect: [],
    labelSelector: [],
    aggregateBy: 'week',
    weekends: 'include',
    outlierMode: 'include',
    compareStartDate: '',
    compareEndDate: '',
    rawFilters: '',
    period: 'week',
    ignorePatternFiles: '',
    includePatternFiles: '',
    authorSelectSourceCode: [],
    topEntries: 20,
    aggregateMetric: 'avg',
    sonarqubeRemoveFolders: true,
    ...overrides,
  };
}

describe('buildDashboardLink', () => {
  it('builds a pipelines dashboard link with default filters', () => {
    const link = buildDashboardLink('pipelines', createFilters());

    expect(link).toContain('/dashboard/pipelines?');
    // serializeDashboardFilters includes all non-empty values for URL fidelity
    expect(link).toContain('aggregateBy=week');
    expect(link).toContain('outlierMode=include');
    expect(link).toContain('weekends=include');
  });

  it('builds a pipelines dashboard link with date range filters', () => {
    const filters = createFilters({
      startDate: '2026-01-01',
      endDate: '2026-06-30',
    });

    const link = buildDashboardLink('pipelines', filters);

    expect(link).toContain('/dashboard/pipelines?');
    expect(link).toContain('startDate=2026-01-01');
    expect(link).toContain('endDate=2026-06-30');
  });

  it('builds a pull-requests dashboard link with author and label filters', () => {
    const filters = createFilters({
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      authorSelect: ['alice', 'bob'],
      labelSelector: ['bug', 'feature'],
      aggregateBy: 'month',
    });

    const link = buildDashboardLink('pull-requests', filters);

    expect(link).toContain('/dashboard/pull-requests?');
    expect(link).toContain('startDate=2026-03-01');
    expect(link).toContain('endDate=2026-03-31');
    expect(link).toContain('authorSelect=alice%2Cbob');
    expect(link).toContain('labelSelector=bug%2Cfeature');
    expect(link).toContain('aggregateBy=month');
  });

  it('builds a source-code dashboard link with file pattern and author filters', () => {
    const filters = createFilters({
      startDate: '2026-01-01',
      endDate: '2026-06-01',
      ignorePatternFiles: '*.test.ts,*.spec.ts',
      includePatternFiles: 'src/**/*.ts',
      authorSelectSourceCode: ['charlie'],
      topEntries: 15,
      typeChurn: 'removed',
    });

    const link = buildDashboardLink('source-code', filters);

    expect(link).toContain('/dashboard/source-code?');
    expect(link).toContain('ignorePatternFiles=*.test.ts%2C*.spec.ts');
    expect(link).toContain('includePatternFiles=src%2F**%2F*.ts');
    expect(link).toContain('authorSelectSourceCode=charlie');
    expect(link).toContain('topEntries=15');
    expect(link).toContain('typeChurn=removed');
  });

  it('builds an architecture dashboard link', () => {
    const filters = createFilters({
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    });

    const link = buildDashboardLink('architecture', filters);

    expect(link).toContain('/dashboard/architecture?');
    expect(link).toContain('startDate=2026-04-01');
    expect(link).toContain('endDate=2026-04-30');
  });

  it('builds a sonarqube dashboard link with remove-folders setting', () => {
    const filters = createFilters({
      sonarqubeRemoveFolders: false,
    });

    const link = buildDashboardLink('sonarqube', filters);

    expect(link).toContain('/dashboard/sonarqube?');
    expect(link).toContain('sonarqubeRemoveFolders=false');
  });

  it('builds a pipelines dashboard link with outlier and weekend settings', () => {
    const filters = createFilters({
      outlierMode: 'flag',
      weekends: 'exclude',
      method: 'median',
    });

    const link = buildDashboardLink('pipelines', filters);

    expect(link).toContain('outlierMode=flag');
    expect(link).toContain('weekends=exclude');
    expect(link).toContain('method=median');
  });

  it('includes default filter values in query string for explicitness', () => {
    const filters = createFilters({
      startDate: '2026-01-01',
    });

    const link = buildDashboardLink('pull-requests', filters);

    expect(link).toContain('startDate=2026-01-01');
    // serializeDashboardFilters includes all non-empty values for URL fidelity
    expect(link).toContain('aggregateBy=week');
  });
});
