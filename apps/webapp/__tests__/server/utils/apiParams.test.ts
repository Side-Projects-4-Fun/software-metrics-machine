import { buildPipelineApiParams, buildPullRequestApiParams } from '@/server/utils/apiParams';

describe('buildPullRequestApiParams', () => {
  it('includes status when pullRequestStatus is provided', () => {
    const params = buildPullRequestApiParams({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      authorSelect: ['alice'],
      excludeAuthorSelect: ['bot'],
      excludeCommenterSelect: ['renovate'],
      labelSelector: ['bug'],
      pullRequestStatus: 'merged',
      aggregateBy: 'week',
      timezone: 'Europe/Madrid',
      weekends: 'weekends_only',
      outlierMode: 'flag',
    });

    expect(params.status).toBe('merged');
    expect(params.start_date).toBe('2026-01-01');
    expect(params.end_date).toBe('2026-01-31');
    expect(params.authors).toBe('alice');
    expect(params.exclude_authors).toBe('bot');
    expect(params.exclude_commenters).toBe('renovate');
    expect(params.labels).toBe('bug');
    expect(params.timezone).toBe('Europe/Madrid');
    expect(params.weekends).toBe('weekends_only');
    expect(params.outlier_mode).toBe('flag');
  });

  it('omits status when pullRequestStatus is not provided', () => {
    const params = buildPullRequestApiParams({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      authorSelect: [],
      labelSelector: [],
      aggregateBy: 'month',
    });

    expect(params.status).toBeUndefined();
  });
});

describe('buildPipelineApiParams', () => {
  it('includes average cleanup filters', () => {
    const params = buildPipelineApiParams({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      workflowSelector: 'release.yml',
      workflowStatus: ['completed'],
      workflowConclusions: ['success'],
      jobSelector: ['deploy'],
      branch: ['main'],
      event: ['push'],
      aggregateMetric: 'avg',
      weekends: 'weekends_only',
      outlierMode: 'exclude',
    });

    expect(params.weekends).toBe('weekends_only');
    expect(params.outlier_mode).toBe('exclude');
    expect(params.workflow_path).toBe('release.yml');
    expect(params.job_name).toBe('deploy');
  });
});
