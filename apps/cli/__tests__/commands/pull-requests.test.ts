import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { commands } from '../../src';
import { formatPullRequestMetrics } from '../../src/formatters';
import { formatPRSummary } from '../../src/commands/prs';
import { GitHubPullRequestsFetchRepository, PRsService, PullRequestFactory } from '@smmachine/core';
import type { PRFilters, PRSummaryResponse } from '@smmachine/core';

describe('cli: Pull Request Commands', () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  let fetchPRsMock: ReturnType<typeof vi.fn>;
  let fetchPRCommentsMock: ReturnType<typeof vi.fn>;
  let loadPrsWithFiltersMock: ReturnType<typeof vi.fn>;
  let getSummaryMock: ReturnType<typeof vi.fn>;
  let getMetricsMock: ReturnType<typeof vi.fn>;
  let getMetricsByMonthMock: ReturnType<typeof vi.fn>;
  let getMetricsByWeekMock: ReturnType<typeof vi.fn>;
  let getThroughTimeMock: ReturnType<typeof vi.fn>;
  let getByAuthorMock: ReturnType<typeof vi.fn>;
  let getAverageReviewTimeMock: ReturnType<typeof vi.fn>;
  let getAverageOpenByMock: ReturnType<typeof vi.fn>;

  const summaryResponse: PRSummaryResponse = {
    result: {
      total_prs: 2,
      merged_prs: 1,
      closed_prs: 2,
      prs_without_conclusion: 1,
      open_prs: 0,
      unique_authors: 2,
      unique_labels: 1,
      avg_comments_per_pr: 1.5,
      labels: [{ label: 'bug', prs: 1 }],
      first_pr: {
        number: 1,
        title: 'First change',
        author: 'alice',
        created: '2025-01-01T00:00:00Z',
        closed: '2025-01-02T00:00:00Z',
      },
      last_pr: {
        number: 2,
        title: 'Last change',
        author: 'bob',
        created: '2025-01-03T00:00:00Z',
        merged: '2025-01-04T00:00:00Z',
        closed: '2025-01-04T00:00:00Z',
      },
      most_commented_pr: {
        number: 2,
        title: 'Last change',
        author: 'bob',
        comments: 2,
      },
      most_commented_prs: [],
      top_commenter: { login: 'reviewer', comments: 2 },
      top_themes: [{ text: 'github', value: 2 }],
      time_to_first_comment_hours: {
        average: 12.345,
        median: 12.345,
        min: 1,
        max: 24,
        prs_with_comment: 1,
        prs_without_comment: 1,
      },
    },
  };

  const getOutput = () =>
    consoleSpy.mock.calls
      .flat()
      .filter((value: unknown): value is string => typeof value === 'string')
      .join('\n');

  const baseFilters: PRFilters = {
    startDate: undefined,
    endDate: undefined,
    excludeAuthors: [],
    excludeCommenters: [],
    authors: [],
    labels: [],
    rawFilters: undefined,
    cleaning: { weekends: 'include', outlierMode: 'include' },
  };

  beforeEach(() => {
    vi.stubEnv('SMM_STORE_DATA_AT', '/tmp');
    vi.stubEnv('OWNER_REPO_GIT_PROVIDER', 'github');
    vi.stubEnv('OWNER_REPO_GITHUB_TOKEN', 'fake-token');
    vi.stubEnv('OWNER_REPO_GIT_REPOSITORY_PATH', '/tmp/repo');

    fetchPRsMock = vi.fn().mockResolvedValue([]);
    fetchPRCommentsMock = vi.fn().mockResolvedValue([]);
    loadPrsWithFiltersMock = vi.fn().mockResolvedValue([]);
    getSummaryMock = vi.fn().mockResolvedValue(summaryResponse);
    getMetricsMock = vi.fn().mockResolvedValue({ averageComments: 1.5 });
    getMetricsByMonthMock = vi
      .fn()
      .mockResolvedValue([
        { period: '2026-01', count: 5, averageComments: 1.5, averageOpenDays: 2.5 },
      ]);
    getMetricsByWeekMock = vi
      .fn()
      .mockResolvedValue([
        { period: '2026-W01', count: 3, averageComments: 2, averageOpenDays: 1.5 },
      ]);
    getThroughTimeMock = vi.fn().mockResolvedValue([
      { date: '2026-01', kind: 'Opened', count: 5 },
      { date: '2026-01', kind: 'Closed', count: 4 },
    ]);
    getByAuthorMock = vi.fn().mockResolvedValue([{ author: 'alice', count: 5 }]);
    getAverageReviewTimeMock = vi.fn().mockResolvedValue([{ author: 'alice', avg_days: 2.5 }]);
    getAverageOpenByMock = vi.fn().mockResolvedValue([{ period: '2026-W01', avg_days: 2.5 }]);

    // Read-side factory: return a stubbed repository so no SQLite access happens.
    vi.spyOn(PullRequestFactory, 'create').mockReturnValue({
      loadPrsWithFilters: loadPrsWithFiltersMock,
    } as never);

    // Fetch-side repository: stub prototype methods so the real fetch never runs.
    vi.spyOn(GitHubPullRequestsFetchRepository.prototype, 'fetchPRs').mockImplementation(
      fetchPRsMock
    );
    vi.spyOn(GitHubPullRequestsFetchRepository.prototype, 'fetchPRComments').mockImplementation(
      fetchPRCommentsMock
    );

    // Service: stub every method the CLI invokes so we can assert call args.
    vi.spyOn(PRsService.prototype, 'getSummary').mockImplementation(getSummaryMock);
    vi.spyOn(PRsService.prototype, 'getMetrics').mockImplementation(getMetricsMock);
    vi.spyOn(PRsService.prototype, 'getMetricsByMonth').mockImplementation(getMetricsByMonthMock);
    vi.spyOn(PRsService.prototype, 'getMetricsByWeek').mockImplementation(getMetricsByWeekMock);
    vi.spyOn(PRsService.prototype, 'getThroughTime').mockImplementation(getThroughTimeMock);
    vi.spyOn(PRsService.prototype, 'getByAuthor').mockImplementation(getByAuthorMock);
    vi.spyOn(PRsService.prototype, 'getAverageReviewTime').mockImplementation(
      getAverageReviewTimeMock
    );
    vi.spyOn(PRsService.prototype, 'getAverageOpenBy').mockImplementation(getAverageOpenByMock);

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code ?? 0})`);
    });

    program = commands();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('command registration', () => {
    it('registers prs command group', () => {
      const prsCommand = program.commands.find((cmd) => cmd.name() === 'prs');
      expect(prsCommand).toBeDefined();
      expect(prsCommand!.description()).toBe('Pull request operations');
    });

    it('registers every PR subcommand', () => {
      const prsCommand = program.commands.find((cmd) => cmd.name() === 'prs');
      const names = prsCommand!.commands.map((cmd) => cmd.name());
      expect(names).toEqual(
        expect.arrayContaining([
          'fetch',
          'fetch-comments',
          'summary',
          'by-month',
          'by-week',
          'through-time',
          'by-author',
          'average-review-time',
          'average-open',
          'average-comments',
        ])
      );
    });
  });

  describe('prs fetch', () => {
    // `--project owner/repo` is required because the fetch action reads
    // `config.githubRepository` to construct the Git provider clients.
    const projectArgs = ['--project', 'owner/repo'];

    it('forwards all options to fetchPRs', async () => {
      await program.parseAsync(
        [
          ...projectArgs,
          'prs',
          'fetch',
          '--force',
          '--update',
          '--start-date',
          '2026-01-01',
          '--end-date',
          '2026-01-31',
          '--raw-filters',
          'status=open',
        ],
        { from: 'user' }
      );

      expect(fetchPRsMock).toHaveBeenCalledWith({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        rawFilters: 'status=open',
        forceRefresh: true,
        incrementalUpdate: true,
      });
    });

    it('passes undefined values when no options are given', async () => {
      await program.parseAsync([...projectArgs, 'prs', 'fetch'], { from: 'user' });

      expect(fetchPRsMock).toHaveBeenCalledWith({
        startDate: undefined,
        endDate: undefined,
        rawFilters: undefined,
        forceRefresh: undefined,
        incrementalUpdate: undefined,
      });
    });

    it('prints a success message after fetching', async () => {
      await program.parseAsync([...projectArgs, 'prs', 'fetch'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('🔄 Fetching pull requests from the configured Git provider...');
      expect(output).toContain('✅ Fetch data has been completed');
    });
  });

  describe('prs fetch-comments', () => {
    // `--project owner/repo` is required because the fetch-comments action
    // constructs the Git provider clients via createPRsOrchestratorFetch.
    const projectArgs = ['--project', 'owner/repo'];

    it('loads PRs and calls fetchPRComments for each PR number', async () => {
      loadPrsWithFiltersMock.mockResolvedValueOnce([{ number: 1 }, { number: 2 }, { number: 3 }]);

      await program.parseAsync([...projectArgs, 'prs', 'fetch-comments', '--force', '--update'], {
        from: 'user',
      });

      expect(loadPrsWithFiltersMock).toHaveBeenCalledWith(baseFilters);
      expect(fetchPRCommentsMock).toHaveBeenCalledTimes(3);
      expect(fetchPRCommentsMock).toHaveBeenNthCalledWith(1, 1, {
        forceRefresh: true,
        incrementalUpdate: true,
      });
      expect(fetchPRCommentsMock).toHaveBeenNthCalledWith(2, 2, {
        forceRefresh: true,
        incrementalUpdate: true,
      });
      expect(fetchPRCommentsMock).toHaveBeenNthCalledWith(3, 3, {
        forceRefresh: true,
        incrementalUpdate: true,
      });
    });

    it('does not fetch comments when there are no PRs', async () => {
      loadPrsWithFiltersMock.mockResolvedValueOnce([]);

      await program.parseAsync([...projectArgs, 'prs', 'fetch-comments'], { from: 'user' });

      expect(fetchPRCommentsMock).not.toHaveBeenCalled();
    });

    it('forwards filter options through to loadPrsWithFilters', async () => {
      loadPrsWithFiltersMock.mockResolvedValueOnce([]);

      await program.parseAsync(
        [
          ...projectArgs,
          'prs',
          'fetch-comments',
          '--start-date',
          '2026-01-01',
          '--end-date',
          '2026-01-31',
          '--raw-filters',
          'status=open',
        ],
        { from: 'user' }
      );

      expect(loadPrsWithFiltersMock).toHaveBeenCalledWith({
        ...baseFilters,
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        rawFilters: 'status=open',
      });
    });

    it('defaults force and update to undefined when not provided', async () => {
      loadPrsWithFiltersMock.mockResolvedValueOnce([{ number: 42 }]);

      await program.parseAsync([...projectArgs, 'prs', 'fetch-comments'], { from: 'user' });

      expect(fetchPRCommentsMock).toHaveBeenCalledWith(42, {
        forceRefresh: undefined,
        incrementalUpdate: undefined,
      });
    });
  });

  describe('prs summary', () => {
    it('forwards date filters to getSummary', async () => {
      await program.parseAsync(
        ['prs', 'summary', '--start-date', '2026-01-01', '--end-date', '2026-01-31'],
        { from: 'user' }
      );

      expect(getSummaryMock).toHaveBeenCalledWith({
        ...baseFilters,
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });
    });

    it('parses comma-separated author and label filters', async () => {
      await program.parseAsync(
        [
          'prs',
          'summary',
          '--authors',
          'alice,bob',
          '--exclude-authors',
          'carol',
          '--labels',
          'bug,feature',
          '--exclude-commenters',
          'dave',
        ],
        { from: 'user' }
      );

      expect(getSummaryMock).toHaveBeenCalledWith({
        ...baseFilters,
        authors: ['alice', 'bob'],
        excludeAuthors: ['carol'],
        labels: ['bug', 'feature'],
        excludeCommenters: ['dave'],
      });
    });

    it('forwards raw-filters verbatim to getSummary', async () => {
      await program.parseAsync(['prs', 'summary', '--raw-filters', 'status=draft,author=john'], {
        from: 'user',
      });

      expect(getSummaryMock).toHaveBeenCalledWith({
        ...baseFilters,
        rawFilters: 'status=draft,author=john',
      });
    });

    it('uses default include/include cleaning when no cleaning options are given', async () => {
      await program.parseAsync(['prs', 'summary'], { from: 'user' });

      expect(getSummaryMock).toHaveBeenCalledWith(baseFilters);
    });

    it('renders the summary text by default', async () => {
      await program.parseAsync(['prs', 'summary'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('📊 Generating PR summary...');
      expect(output).toContain('PRs Summary:');
      expect(output).toContain('Total PRs: 2');
      expect(output).toContain('✅ Summary generated');
    });

    it('renders the summary as JSON when --output json is provided', async () => {
      await program.parseAsync(['prs', 'summary', '--output', 'json'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('"total_prs": 2');
      expect(output).toContain('"unique_authors": 2');
    });
  });

  describe('prs by-month', () => {
    it('forwards filters to getMetricsByMonth', async () => {
      await program.parseAsync(
        ['prs', 'by-month', '--start-date', '2026-01-01', '--exclude-authors', 'carol'],
        { from: 'user' }
      );

      expect(getMetricsByMonthMock).toHaveBeenCalledWith({
        ...baseFilters,
        startDate: '2026-01-01',
        excludeAuthors: ['carol'],
      });
    });

    it('prints the by-month header in text output', async () => {
      await program.parseAsync(['prs', 'by-month'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('=== PRs by Month ===');
    });

    it('prints JSON when --output json is provided', async () => {
      await program.parseAsync(['prs', 'by-month', '--output', 'json'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('"period": "2026-01"');
    });
  });

  describe('prs by-week', () => {
    it('forwards filters to getMetricsByWeek', async () => {
      await program.parseAsync(
        ['prs', 'by-week', '--start-date', '2026-01-01', '--exclude-commenters', 'dave'],
        { from: 'user' }
      );

      expect(getMetricsByWeekMock).toHaveBeenCalledWith({
        ...baseFilters,
        startDate: '2026-01-01',
        excludeCommenters: ['dave'],
      });
    });

    it('prints the by-week header in text output', async () => {
      await program.parseAsync(['prs', 'by-week'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('=== PRs by Week ===');
    });

    it('prints JSON when --output json is provided', async () => {
      await program.parseAsync(['prs', 'by-week', '--output', 'json'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('"period": "2026-W01"');
    });
  });

  describe('prs through-time', () => {
    it('forwards filters and aggregateBy to getThroughTime', async () => {
      await program.parseAsync(
        ['prs', 'through-time', '--start-date', '2026-01-01', '--aggregate-by', 'month'],
        { from: 'user' }
      );

      expect(getThroughTimeMock).toHaveBeenCalledWith(
        {
          ...baseFilters,
          startDate: '2026-01-01',
        },
        'month'
      );
    });

    it('defaults aggregateBy to undefined when not provided', async () => {
      await program.parseAsync(['prs', 'through-time'], { from: 'user' });

      expect(getThroughTimeMock).toHaveBeenCalledWith(baseFilters, undefined);
    });

    it('prints through-time rows in text output', async () => {
      await program.parseAsync(['prs', 'through-time'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('=== PRs Through Time ===');
      expect(output).toContain('2026-01 | Opened: 5');
      expect(output).toContain('2026-01 | Closed: 4');
    });

    it('prints JSON when --output json is provided', async () => {
      await program.parseAsync(['prs', 'through-time', '--output', 'json'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('"kind": "Opened"');
    });
  });

  describe('prs by-author', () => {
    it('forwards filters and top to getByAuthor', async () => {
      await program.parseAsync(['prs', 'by-author', '--top', '5', '--authors', 'alice'], {
        from: 'user',
      });

      expect(getByAuthorMock).toHaveBeenCalledWith(
        {
          ...baseFilters,
          authors: ['alice'],
        },
        5
      );
    });

    it('defaults top to 10 when not provided', async () => {
      await program.parseAsync(['prs', 'by-author'], { from: 'user' });

      expect(getByAuthorMock).toHaveBeenCalledWith(baseFilters, 10);
    });

    it('prints authors grouped in text output', async () => {
      await program.parseAsync(['prs', 'by-author'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('=== PRs by Author ===');
      expect(output).toContain('alice: 5 PRs');
    });

    it('prints JSON when --output json is provided', async () => {
      await program.parseAsync(['prs', 'by-author', '--output', 'json'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('"author": "alice"');
    });
  });

  describe('prs average-review-time', () => {
    it('forwards filters, cleaning options, and top to getAverageReviewTime', async () => {
      await program.parseAsync(
        [
          'prs',
          'average-review-time',
          '--top',
          '3',
          '--weekends',
          'exclude',
          '--outlier-mode',
          'flag',
        ],
        { from: 'user' }
      );

      expect(getAverageReviewTimeMock).toHaveBeenCalledWith(
        {
          ...baseFilters,
          cleaning: { weekends: 'exclude', outlierMode: 'flag' },
        },
        3
      );
    });

    it('defaults top to 10 and cleaning to include/include', async () => {
      await program.parseAsync(['prs', 'average-review-time'], { from: 'user' });

      expect(getAverageReviewTimeMock).toHaveBeenCalledWith(baseFilters, 10);
    });

    it('prints average review time by author in text output', async () => {
      await program.parseAsync(['prs', 'average-review-time'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('=== Average Review Time by Author ===');
      expect(output).toContain('alice: 2.50 days');
    });

    it('prints JSON when --output json is provided', async () => {
      await program.parseAsync(['prs', 'average-review-time', '--output', 'json'], {
        from: 'user',
      });

      const output = getOutput();
      expect(output).toContain('"avg_days": 2.5');
    });
  });

  describe('prs average-open', () => {
    it('forwards filters, cleaning options, and aggregateBy to getAverageOpenBy', async () => {
      await program.parseAsync(
        [
          'prs',
          'average-open',
          '--aggregate-by',
          'week',
          '--weekends',
          'exclude',
          '--outlier-mode',
          'flag',
        ],
        { from: 'user' }
      );

      expect(getAverageOpenByMock).toHaveBeenCalledWith(
        {
          ...baseFilters,
          cleaning: { weekends: 'exclude', outlierMode: 'flag' },
        },
        'week'
      );
    });

    it('defaults aggregateBy to undefined when not provided', async () => {
      await program.parseAsync(['prs', 'average-open'], { from: 'user' });

      expect(getAverageOpenByMock).toHaveBeenCalledWith(baseFilters, undefined);
    });

    it('prints average open time per period in text output', async () => {
      await program.parseAsync(['prs', 'average-open'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('=== Average PR Open Time ===');
      expect(output).toContain('2026-W01: 2.50 days');
    });

    it('prints JSON when --output json is provided', async () => {
      await program.parseAsync(['prs', 'average-open', '--output', 'json'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('"avg_days": 2.5');
    });
  });

  describe('prs average-comments', () => {
    it('calls getMetrics when no --aggregate-by is provided', async () => {
      await program.parseAsync(
        ['prs', 'average-comments', '--weekends', 'exclude', '--outlier-mode', 'flag'],
        { from: 'user' }
      );

      expect(getMetricsMock).toHaveBeenCalledWith({
        ...baseFilters,
        cleaning: { weekends: 'exclude', outlierMode: 'flag' },
      });
      expect(getMetricsByMonthMock).not.toHaveBeenCalled();
      expect(getMetricsByWeekMock).not.toHaveBeenCalled();
    });

    it('calls getMetricsByMonth when --aggregate-by month is provided', async () => {
      await program.parseAsync(['prs', 'average-comments', '--aggregate-by', 'month'], {
        from: 'user',
      });

      expect(getMetricsByMonthMock).toHaveBeenCalledWith(baseFilters);
      expect(getMetricsMock).not.toHaveBeenCalled();
      expect(getMetricsByWeekMock).not.toHaveBeenCalled();
    });

    it('calls getMetricsByWeek when --aggregate-by week is provided', async () => {
      await program.parseAsync(['prs', 'average-comments', '--aggregate-by', 'week'], {
        from: 'user',
      });

      expect(getMetricsByWeekMock).toHaveBeenCalledWith(baseFilters);
      expect(getMetricsMock).not.toHaveBeenCalled();
      expect(getMetricsByMonthMock).not.toHaveBeenCalled();
    });

    it('prints average comments text output without --aggregate-by', async () => {
      await program.parseAsync(['prs', 'average-comments'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('=== Average Comments per PR ===');
      expect(output).toContain('Average Comments: 1.5');
    });

    it('prints per-period output when --aggregate-by month is provided', async () => {
      await program.parseAsync(['prs', 'average-comments', '--aggregate-by', 'month'], {
        from: 'user',
      });

      const output = getOutput();
      expect(output).toContain('=== Average Comments per PR by month ===');
      expect(output).toContain('2026-01: 1.5 avg comments (5 PRs)');
    });
  });

  describe('Output Formatters', () => {
    it('should format PR summary in the expected CLI shape', () => {
      const output = formatPRSummary(summaryResponse.result);

      expect(output).toContain('PRs Summary:');
      expect(output).toContain('PRs Without Conclusion: 1');
      expect(output).toContain('Average of comments per PR: 1.5');
      expect(output).toContain('  - bug: 1 PRs');
      expect(output).toContain('Most commented PR:');
      expect(output).toContain('Top commenter:');
      expect(output).toContain('Top themes:');
      expect(output).toContain('Time to first comment (hours):');
    });

    it('should format PR metrics in text format', () => {
      const data = {
        totalPRs: 42,
        leadTime: { average: 2.5, unit: 'days' },
        commentSummary: { total: 156 },
        labelSummary: { bug: 8, feature: 15 },
      };

      const output = formatPullRequestMetrics(data, { format: 'text' });
      expect(output).toContain('Pull Request Metrics');
      expect(output).toContain('42');
      expect(output).toContain('2.5 days');
    });

    it('should format PR metrics in JSON format', () => {
      const data = {
        totalPRs: 42,
        leadTime: { average: 2.5, unit: 'days' },
      };

      const output = formatPullRequestMetrics(data, { format: 'json' });
      const parsed = JSON.parse(output);
      expect(parsed.totalPRs).toBe(42);
      expect(parsed.leadTime.average).toBe(2.5);
    });

    it('should format PR metrics in CSV format', () => {
      const data = {
        totalPRs: 42,
        leadTime: { average: 2.5, unit: 'days' },
        commentSummary: { total: 156 },
      };

      const output = formatPullRequestMetrics(data, { format: 'csv' });
      expect(output).toContain('metric,value');
      expect(output).toContain('total_prs,42');
      expect(output).toContain('lead_time_days,2.5');
    });
  });
});
