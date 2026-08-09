import { createUrlBuilder } from '@/server/utils/urlBuilder';
import { DashboardConfigurationBuilder } from '../../builders/builders';

describe('createUrlBuilder', () => {
  it('builds a GitHub Actions job metrics link with workflow and job filters', () => {
    const config = new DashboardConfigurationBuilder()
      .withGithubRepository('acme/widgets')
      .build();
    const builder = createUrlBuilder(config);

    expect(builder.getJobRunsUrl('Build and Test', '.github/workflows/ci.yml')).toBe(
      'https://github.com/acme/widgets/actions/metrics/performance?tab=jobs&filters=workflow_file_name%3A%22ci.yml%22+job_name%3A%22Build%20and%20Test%22'
    );
  });

  it('builds a GitHub Actions job metrics link without a workflow filter', () => {
    const config = new DashboardConfigurationBuilder()
      .withGithubRepository('acme/widgets')
      .build();
    const builder = createUrlBuilder(config);

    expect(builder.getJobRunsUrl('deploy')).toBe(
      'https://github.com/acme/widgets/actions/metrics/performance?tab=jobs&filters=job_name%3A%22deploy%22'
    );
  });

  it('builds a GitHub Actions job metrics link with the dashboard date range', () => {
    const config = new DashboardConfigurationBuilder()
      .withGithubRepository('acme/widgets')
      .build();
    const builder = createUrlBuilder(config);

    expect(
      builder.getJobRunsUrl('deploy', '.github/workflows/release.yml', {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      })
    ).toBe(
      'https://github.com/acme/widgets/actions/metrics/performance?dateRangeType=DATE_RANGE_TYPE_CUSTOM&tab=jobs&filters=workflow_file_name%3A%22release.yml%22+job_name%3A%22deploy%22&range=1767225600000-1769903999999'
    );
  });

  it('builds a GitHub Actions job metrics link with GitHub-visible date boundaries', () => {
    const config = new DashboardConfigurationBuilder()
      .withGithubRepository('acme/widgets')
      .build();
    const builder = createUrlBuilder(config);

    expect(
      builder.getJobRunsUrl('deploy', '.github/workflows/release.yml', {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        timezone: 'Europe/Madrid',
      })
    ).toBe(
      'https://github.com/acme/widgets/actions/metrics/performance?dateRangeType=DATE_RANGE_TYPE_CUSTOM&tab=jobs&filters=workflow_file_name%3A%22release.yml%22+job_name%3A%22deploy%22&range=1767225600000-1769903999999'
    );
  });

  it('builds a GitHub Actions workflow metrics link with the dashboard date range', () => {
    const config = new DashboardConfigurationBuilder()
      .withGithubRepository('acme/widgets')
      .build();
    const builder = createUrlBuilder(config);

    expect(
      builder.getWorkflowJobsMetricsUrl('.github/workflows/ci.yml', {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      })
    ).toBe(
      'https://github.com/acme/widgets/actions/metrics/performance?dateRangeType=DATE_RANGE_TYPE_CUSTOM&tab=jobs&filters=workflow_file_name%3A%22ci.yml%22&range=1767225600000-1769903999999'
    );
  });

  it('builds a GitHub Actions metrics link with exact dashboard datetime boundaries', () => {
    const config = new DashboardConfigurationBuilder()
      .withGithubRepository('acme/widgets')
      .build();
    const builder = createUrlBuilder(config);

    expect(
      builder.getJobRunsUrl('deploy', '.github/workflows/release.yml', {
        startDate: '2026-01-01T08:30:00+01:00',
        endDate: '2026-01-31T17:45:00+01:00',
      })
    ).toBe(
      'https://github.com/acme/widgets/actions/metrics/performance?dateRangeType=DATE_RANGE_TYPE_CUSTOM&tab=jobs&filters=workflow_file_name%3A%22release.yml%22+job_name%3A%22deploy%22&range=1767256200000-1769881500000'
    );
  });

  it('preserves the selected Madrid wall-clock datetimes for GitHub metrics links', () => {
    const config = new DashboardConfigurationBuilder()
      .withGithubRepository('acme/widgets')
      .build();
    const builder = createUrlBuilder(config);

    expect(
      builder.getJobRunsUrl('deploy', '.github/workflows/release.yml', {
        startDate: '2026-05-01T00:00:00+02:00',
        endDate: '2026-05-31T23:59:00+02:00',
        timezone: 'Europe/Madrid',
      })
    ).toBe(
      'https://github.com/acme/widgets/actions/metrics/performance?dateRangeType=DATE_RANGE_TYPE_CUSTOM&tab=jobs&filters=workflow_file_name%3A%22release.yml%22+job_name%3A%22deploy%22&range=1777593600000-1780271940000'
    );
  });

  it('builds a GitHub Actions usage link with GitHub-visible DST day boundaries', () => {
    const config = new DashboardConfigurationBuilder()
      .withGithubRepository('acme/widgets')
      .build();
    const builder = createUrlBuilder(config);

    expect(
      builder.getActionPerformanceForJobUrl('deploy', 'release.yml', 'day', '2026-03-29', 'Europe/Madrid')
    ).toBe(
      'https://github.com/acme/widgets/actions/metrics/usage?dateRangeType=DATE_RANGE_TYPE_CUSTOM&tab=jobs&filters=workflow_file_name%3A%22release.yml%22+job_name%3A%22deploy%22&range=1774742400000-1774828799999'
    );
  });

  it('builds a GitHub Actions usage link with GitHub-visible month boundaries', () => {
    const config = new DashboardConfigurationBuilder()
      .withGithubRepository('acme/widgets')
      .build();
    const builder = createUrlBuilder(config);

    expect(
      builder.getActionPerformanceForJobUrl('deploy', 'release.yml', 'month', '2026-03-15', 'Europe/Madrid')
    ).toBe(
      'https://github.com/acme/widgets/actions/metrics/usage?dateRangeType=DATE_RANGE_TYPE_CUSTOM&tab=jobs&filters=workflow_file_name%3A%22release.yml%22+job_name%3A%22deploy%22&range=1772323200000-1775001599999'
    );
  });

  it('builds a GitLab CI jobs link filtered by job search and ref', () => {
    const config = new DashboardConfigurationBuilder()
      .withGitProvider('gitlab')
      .withGithubRepository('acme/widgets')
      .build();
    const builder = createUrlBuilder(config);

    expect(
      builder.getJobRunsUrl('Build and Test', 'main', {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      })
    ).toBe(
      'https://gitlab.com/acme/widgets/-/jobs?scope%5B%5D=all&search=Build+and+Test&ref=main&created_after=2026-01-01T00%3A00%3A00Z&created_before=2026-01-31T23%3A59%3A59Z'
    );
  });

  it('builds a GitLab MR link using a self-hosted instance URL', () => {
    const config = new DashboardConfigurationBuilder()
      .withGitProvider('gitlab')
      .withGitlabUrl('https://gitlab.example.com/acme/widgets')
      .build();
    const builder = createUrlBuilder(config);

    expect(builder.getChangeRequestUrl(42)).toBe(
      'https://gitlab.example.com/acme/widgets/-/merge_requests/42'
    );
  });

  it('builds a GitLab CI action performance link for a deployment frequency dot', () => {
    const config = new DashboardConfigurationBuilder()
      .withGitProvider('gitlab')
      .withGithubRepository('acme/widgets')
      .build();
    const builder = createUrlBuilder(config);

    const url = builder.getActionPerformanceForJobUrl('deploy', 'main', 'day', '2026-03-29');
    expect(url).toContain('/-/jobs?');
    expect(url).toContain('search=deploy');
    expect(url).toContain('ref=main');
    expect(url).toContain('created_after=');
    expect(url).toContain('created_before=');
  });
});
