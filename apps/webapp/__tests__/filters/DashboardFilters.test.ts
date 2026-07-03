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
    });

    expect(params.get('workflowSelector')).toBe('release.yml');
    expect(params.get('workflowStatus')).toBe('completed');
    expect(params.get('timezone')).toBe('Europe/Madrid');
    expect(params.get('weekends')).toBe('weekends_only');
    expect(params.get('outlierMode')).toBe('flag');
  });

  it('parses filter state from search params', () => {
    const filters = parseDashboardFilters(
      {
        workflowSelector: 'release.yml',
        workflowStatus: 'completed',
        timezone: 'Europe/Madrid',
        weekends: 'weekends_only',
        outlierMode: 'flag',
      },
      defaultFilters,
    );

    expect(filters.workflowSelector).toBe('release.yml');
    expect(filters.workflowStatus).toEqual(['completed']);
    expect(filters.timezone).toBe('Europe/Madrid');
    expect(filters.weekends).toBe('weekends_only');
    expect(filters.outlierMode).toBe('flag');
  });

  it('parses false boolean filters from search params', () => {
    const filters = parseDashboardFilters(
      { sonarqubeRemoveFolders: 'false' },
      defaultFilters,
    );

    expect(filters.sonarqubeRemoveFolders).toBe(false);
  });
});
