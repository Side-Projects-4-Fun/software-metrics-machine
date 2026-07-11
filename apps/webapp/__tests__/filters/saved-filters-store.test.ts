import {
  dashboardPathForSection,
  dashboardSectionFromPathname,
  SavedFiltersStorageAdapter,
  SavedFiltersStore,
} from '@/components/filters/saved-filters-store';
import { defaultFilters } from '@/components/filters/DashboardFilters';

class InMemoryAdapter implements SavedFiltersStorageAdapter {
  private readonly values: Record<string, string> = {};

  async getItem(key: string): Promise<string | null> {
    return this.values[key] ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values[key] = value;
  }
}

describe('saved-filters-store', () => {
  it('saves and reads filters by section', async () => {
    const store = new SavedFiltersStore(new InMemoryAdapter(), 'test.saved.filters');

    await store.save('insights', '/dashboard/insights', 'My Insights', defaultFilters, 'repo1');
    await store.save('pipelines', '/dashboard/pipelines', 'My Pipeline', defaultFilters, 'repo1');

    const insights = await store.getBySection('insights', 'repo1');
    const pipelines = await store.getBySection('pipelines', 'repo1');

    expect(insights).toHaveLength(1);
    expect(insights[0]?.name).toBe('My Insights');
    expect(pipelines).toHaveLength(1);
    expect(pipelines[0]?.name).toBe('My Pipeline');
  });

  it('filters are scoped by repository', async () => {
    const store = new SavedFiltersStore(new InMemoryAdapter(), 'test.saved.filters');

    await store.save('insights', '/dashboard/insights', 'My Insights', defaultFilters, 'repo1');
    await store.save('insights', '/dashboard/insights', 'My Insights', defaultFilters, 'repo2');

    const repo1Insights = await store.getBySection('insights', 'repo1');
    const repo2Insights = await store.getBySection('insights', 'repo2');

    expect(repo1Insights).toHaveLength(1);
    expect(repo1Insights[0]?.repository).toBe('repo1');
    expect(repo2Insights).toHaveLength(1);
    expect(repo2Insights[0]?.repository).toBe('repo2');
  });

  it('creates a unique suffix when names collide in same section and repository', async () => {
    const store = new SavedFiltersStore(new InMemoryAdapter(), 'test.saved.filters');

    await store.save('insights', '/dashboard/insights', 'Team Alpha', defaultFilters, 'repo1');
    const second = await store.save('insights', '/dashboard/insights', 'Team Alpha', defaultFilters, 'repo1');

    expect(second.name).toBe('Team Alpha (2)');
  });

  it('allows same name in different repositories', async () => {
    const store = new SavedFiltersStore(new InMemoryAdapter(), 'test.saved.filters');

    const repo1 = await store.save('insights', '/dashboard/insights', 'Team Alpha', defaultFilters, 'repo1');
    const repo2 = await store.save('insights', '/dashboard/insights', 'Team Alpha', defaultFilters, 'repo2');

    expect(repo1.name).toBe('Team Alpha');
    expect(repo2.name).toBe('Team Alpha');
  });

  it('removes a saved filter by id', async () => {
    const store = new SavedFiltersStore(new InMemoryAdapter(), 'test.saved.filters');

    const created = await store.save('source-code', '/dashboard/source-code', 'Churn Snapshot', defaultFilters, 'repo1');
    await store.remove(created.id);

    const sourceCode = await store.getBySection('source-code', 'repo1');
    expect(sourceCode).toHaveLength(0);
  });

  it('updates an existing saved filter by id', async () => {
    const store = new SavedFiltersStore(new InMemoryAdapter(), 'test.saved.filters');

    const created = await store.save('source-code', '/dashboard/source-code', 'Churn Snapshot', defaultFilters, 'repo1');
    const updatedFilters = {
      ...defaultFilters,
      topEntries: 50,
      workflowStatus: ['completed'],
    };

    await store.update(created.id, updatedFilters);

    const sourceCode = await store.getBySection('source-code', 'repo1');
    expect(sourceCode).toHaveLength(1);
    expect(sourceCode[0]?.id).toBe(created.id);
    expect(sourceCode[0]?.name).toBe('Churn Snapshot');
    expect(sourceCode[0]?.filters.topEntries).toBe(50);
    expect(sourceCode[0]?.filters.workflowStatus).toEqual(['completed']);
  });

  it('maps pathname and section helpers', () => {
    expect(dashboardSectionFromPathname('/dashboard/pull-requests')).toBe('pull-requests');
    expect(dashboardSectionFromPathname('/dashboard/source-code')).toBe('source-code');
    expect(dashboardSectionFromPathname('/dashboard')).toBe('insights');

    expect(dashboardPathForSection('insights')).toBe('/dashboard/insights');
  });
});
