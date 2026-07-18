import {
  defaultFilters,
  parseDashboardFilters,
  serializeDashboardFilters,
} from '@/components/filters/DashboardFilters';

describe('DashboardFilters', () => {
  it('serializes filter state', () => {
    const params = serializeDashboardFilters({
      ...defaultFilters,
      workflowSelector: 'release.yml',
      workflowStatus: ['completed'],
      timezone: 'Europe/Madrid',
      weekends: 'weekends_only',
      outlierMode: 'flag',
      metric: 'coverage',
      category: 'quality',
      compareStartDate: '2026-06-01',
      compareEndDate: '2026-06-30',
      rawFilters: 'status=success',
      period: 'month',
    });

    expect(params.get('workflowSelector')).toBe('release.yml');
    expect(params.get('workflowStatus')).toBe('completed');
    expect(params.get('timezone')).toBe('Europe/Madrid');
    expect(params.get('weekends')).toBe('weekends_only');
    expect(params.get('outlierMode')).toBe('flag');
    expect(params.get('metric')).toBe('coverage');
    expect(params.get('category')).toBe('quality');
    expect(params.get('compareStartDate')).toBe('2026-06-01');
    expect(params.get('compareEndDate')).toBe('2026-06-30');
    expect(params.get('rawFilters')).toBe('status=success');
    expect(params.get('period')).toBe('month');
  });

  it('parses filter state from search params', () => {
    const filters = parseDashboardFilters(
      {
        workflowSelector: 'release.yml',
        workflowStatus: 'completed',
        timezone: 'Europe/Madrid',
        weekends: 'weekends_only',
        outlierMode: 'flag',
        metric: 'coverage',
        category: 'quality',
        compare_start_date: '2026-06-01',
        compare_end_date: '2026-06-30',
        raw_filters: 'status=success',
        period: 'month',
      },
      defaultFilters,
    );

    expect(filters.workflowSelector).toBe('release.yml');
    expect(filters.workflowStatus).toEqual(['completed']);
    expect(filters.timezone).toBe('Europe/Madrid');
    expect(filters.weekends).toBe('weekends_only');
    expect(filters.outlierMode).toBe('flag');
    expect(filters.metric).toBe('coverage');
    expect(filters.category).toBe('quality');
    expect(filters.compareStartDate).toBe('2026-06-01');
    expect(filters.compareEndDate).toBe('2026-06-30');
    expect(filters.rawFilters).toBe('status=success');
    expect(filters.period).toBe('month');
  });

  it('parses false boolean filters from search params', () => {
    const filters = parseDashboardFilters(
      { sonarqubeRemoveFolders: 'false' },
      defaultFilters,
    );

    expect(filters.sonarqubeRemoveFolders).toBe(false);
  });

  it('does not serialize the default engineering health period', () => {
    const params = serializeDashboardFilters({
      ...defaultFilters,
      workflowSelector: 'release.yml',
    });

    expect(params.get('period')).toBeNull();
  });
});
