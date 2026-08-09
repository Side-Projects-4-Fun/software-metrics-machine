import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Command } from 'commander';
import { commands } from '../../src';
import { formatChangeRequestMetrics } from '../../src/formatters';
import { formatChangeRequestSummary } from '../../src/commands/change-requests';
import {
  GitHubPullRequestsFetchRepository,
  ChangeRequestsService,
  ChangeRequestFactory,
} from '@smmachine/core';
import type { ChangeRequestFilters, ChangeRequestSummaryResponse } from '@smmachine/core';

describe('cli: Change Request Commands', () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  let fetchPRsMock: ReturnType<typeof vi.fn>;
  let fetchPRCommentsMock: ReturnType<typeof vi.fn>;
  let loadChangeRequestsWithFiltersMock: ReturnType<typeof vi.fn>;
  let getSummaryMock: ReturnType<typeof vi.fn>;
  let getMetricsMock: ReturnType<typeof vi.fn>;
  let getMetricsByMonthMock: ReturnType<typeof vi.fn>;
  let getMetricsByWeekMock: ReturnType<typeof vi.fn>;
  let getThroughTimeMock: ReturnType<typeof vi.fn>;
  let getByAuthorMock: ReturnType<typeof vi.fn>;

  const summaryResponse: ChangeRequestSummaryResponse = {
    result: {
      total_change_requests: 2,
      merged_change_requests: 1,
      closed_change_requests: 2,
      change_requests_without_conclusion: 1,
      open_change_requests: 0,
      unique_authors: 2,
      unique_labels: 1,
      comments_per_change_request: 1.5,
      labels: [{ label: 'bug', change_requests: 1 }],
      first_change_request: {
        number: 1,
        title: 'First change',
        author: 'alice',
        created: '2025-01-01T00:00:00Z',
        closed: '2025-01-02T00:00:00Z',
      },
      last_change_request: {
        number: 2,
        title: 'Last change',
        author: 'bob',
        created: '2025-01-03T00:00:00Z',
        merged: '2025-01-04T00:00:00Z',
        closed: '2025-01-04T00:00:00Z',
      },
      most_commented_change_request: {
        number: 2,
        title: 'Last change',
        author: 'bob',
        comments: 2,
      },
      most_commented_change_requests: [],
      top_commenter: { login: 'reviewer', comments: 2 },
      top_themes: [{ text: 'github', value: 2 }],
      time_to_first_comment_hours: {
        average: 12.345,
        median: 12.345,
        min: 1,
        max: 24,
        change_requests_with_comment: 1,
        change_requests_without_comment: 1,
      },
    },
  };

  const getOutput = () =>
    consoleSpy.mock.calls
      .flat()
      .filter((value: unknown): value is string => typeof value === 'string')
      .join('\n');

  const baseFilters: ChangeRequestFilters = {
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
    loadChangeRequestsWithFiltersMock = vi.fn().mockResolvedValue([]);
    getSummaryMock = vi.fn().mockResolvedValue(summaryResponse);
    getMetricsMock = vi.fn().mockResolvedValue({ comments: 1.5, method: 'average' });
    getMetricsByMonthMock = vi.fn().mockResolvedValue([
      {
        period: '2026-01',
        count: 5,
        comments: 1.5,
        openDays: 2.5,
        method: 'average',
      },
    ]);
    getMetricsByWeekMock = vi.fn().mockResolvedValue([
      {
        period: '2026-W01',
        count: 3,
        comments: 2,
        openDays: 1.5,
        method: 'average',
      },
    ]);
    getThroughTimeMock = vi.fn().mockResolvedValue([
      { date: '2026-01', kind: 'Opened', count: 5 },
      { date: '2026-01', kind: 'Closed', count: 4 },
    ]);
    getByAuthorMock = vi.fn().mockResolvedValue([{ author: 'alice', count: 5 }]);

    // Read-side factory: return a stubbed repository so no SQLite access happens.
    vi.spyOn(ChangeRequestFactory, 'create').mockReturnValue({
      loadChangeRequestsWithFilters: loadChangeRequestsWithFiltersMock,
    } as never);

    // Fetch-side repository: stub prototype methods so the real fetch never runs.
    vi.spyOn(GitHubPullRequestsFetchRepository.prototype, 'fetchPRs').mockImplementation(
      fetchPRsMock
    );
    vi.spyOn(GitHubPullRequestsFetchRepository.prototype, 'fetchPRComments').mockImplementation(
      fetchPRCommentsMock
    );

    // Service: stub every method the CLI invokes so we can assert call args.
    vi.spyOn(ChangeRequestsService.prototype, 'getSummary').mockImplementation(getSummaryMock);
    vi.spyOn(ChangeRequestsService.prototype, 'getMetrics').mockImplementation(getMetricsMock);
    vi.spyOn(ChangeRequestsService.prototype, 'getMetricsByMonth').mockImplementation(
      getMetricsByMonthMock
    );
    vi.spyOn(ChangeRequestsService.prototype, 'getMetricsByWeek').mockImplementation(
      getMetricsByWeekMock
    );
    vi.spyOn(ChangeRequestsService.prototype, 'getThroughTime').mockImplementation(
      getThroughTimeMock
    );
    vi.spyOn(ChangeRequestsService.prototype, 'getByAuthor').mockImplementation(getByAuthorMock);

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
    it('registers change-requests command group', () => {
      const changeRequestsCommand = program.commands.find(
        (cmd) => cmd.name() === 'change-requests'
      );
      expect(changeRequestsCommand).toBeDefined();
      expect(changeRequestsCommand!.description()).toBe('Change request operations');
    });

    it('registers every change-request subcommand', () => {
      const changeRequestsCommand = program.commands.find(
        (cmd) => cmd.name() === 'change-requests'
      );
      const names = changeRequestsCommand!.commands.map((cmd) => cmd.name());
      expect(names).toEqual(
        expect.arrayContaining([
          'fetch',
          'fetch-comments',
          'summary',
          'by-month',
          'by-week',
          'through-time',
          'by-author',
        ])
      );
    });
  });

  describe('change-requests fetch', () => {
    // `--project owner/repo` is required because the fetch action reads
    // `config.githubRepository` to construct the Git provider clients.
    const projectArgs = ['--project', 'owner/repo'];

    it('forwards all options to fetchPRs', async () => {
      await program.parseAsync(
        [
          ...projectArgs,
          'change-requests',
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
      await program.parseAsync([...projectArgs, 'change-requests', 'fetch'], { from: 'user' });

      expect(fetchPRsMock).toHaveBeenCalledWith({
        startDate: undefined,
        endDate: undefined,
        rawFilters: undefined,
        forceRefresh: undefined,
        incrementalUpdate: undefined,
      });
    });

    it('prints a success message after fetching', async () => {
      await program.parseAsync([...projectArgs, 'change-requests', 'fetch'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('🔄 Fetching change requests from the configured Git provider...');
      expect(output).toContain('✅ Fetch data has been completed');
    });
  });

  describe('change-requests fetch-comments', () => {
    const projectArgs = ['--project', 'owner/repo'];

    it('loads change requests and calls fetchPRComments for each change request number', async () => {
      loadChangeRequestsWithFiltersMock.mockResolvedValueOnce([
        { number: 1 },
        { number: 2 },
        { number: 3 },
      ]);

      await program.parseAsync(
        [...projectArgs, 'change-requests', 'fetch-comments', '--force', '--update'],
        { from: 'user' }
      );

      expect(loadChangeRequestsWithFiltersMock).toHaveBeenCalledWith(baseFilters);
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

    it('does not fetch comments when there are no change requests', async () => {
      loadChangeRequestsWithFiltersMock.mockResolvedValueOnce([]);

      await program.parseAsync([...projectArgs, 'change-requests', 'fetch-comments'], {
        from: 'user',
      });

      expect(fetchPRCommentsMock).not.toHaveBeenCalled();
    });

    it('forwards filter options through to loadChangeRequestsWithFilters', async () => {
      loadChangeRequestsWithFiltersMock.mockResolvedValueOnce([]);

      await program.parseAsync(
        [
          ...projectArgs,
          'change-requests',
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

      expect(loadChangeRequestsWithFiltersMock).toHaveBeenCalledWith({
        ...baseFilters,
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        rawFilters: 'status=open',
      });
    });

    it('defaults force and update to undefined when not provided', async () => {
      loadChangeRequestsWithFiltersMock.mockResolvedValueOnce([{ number: 42 }]);

      await program.parseAsync([...projectArgs, 'change-requests', 'fetch-comments'], {
        from: 'user',
      });

      expect(fetchPRCommentsMock).toHaveBeenCalledWith(42, {
        forceRefresh: undefined,
        incrementalUpdate: undefined,
      });
    });
  });

  describe('change-requests summary', () => {
    it('forwards date filters to getSummary', async () => {
      await program.parseAsync(
        ['change-requests', 'summary', '--start-date', '2026-01-01', '--end-date', '2026-01-31'],
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
          'change-requests',
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
      await program.parseAsync(
        ['change-requests', 'summary', '--raw-filters', 'status=draft,author=john'],
        { from: 'user' }
      );

      expect(getSummaryMock).toHaveBeenCalledWith({
        ...baseFilters,
        rawFilters: 'status=draft,author=john',
      });
    });

    it('uses default include/include cleaning when no cleaning options are given', async () => {
      await program.parseAsync(['change-requests', 'summary'], { from: 'user' });

      expect(getSummaryMock).toHaveBeenCalledWith(baseFilters);
    });

    it('renders the summary text by default', async () => {
      await program.parseAsync(['change-requests', 'summary'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('📊 Generating change request summary...');
      expect(output).toContain('Change Requests Summary:');
      expect(output).toContain('Total change requests: 2');
      expect(output).toContain('✅ Summary generated');
    });

    it('renders the summary as JSON when --output json is provided', async () => {
      await program.parseAsync(['change-requests', 'summary', '--output', 'json'], {
        from: 'user',
      });

      const output = getOutput();
      expect(output).toContain('"total_change_requests": 2');
      expect(output).toContain('"unique_authors": 2');
    });
  });

  describe('change-requests by-month', () => {
    it('forwards filters to getMetricsByMonth', async () => {
      await program.parseAsync(
        ['change-requests', 'by-month', '--start-date', '2026-01-01', '--exclude-authors', 'carol'],
        { from: 'user' }
      );

      expect(getMetricsByMonthMock).toHaveBeenCalledWith({
        ...baseFilters,
        startDate: '2026-01-01',
        excludeAuthors: ['carol'],
      });
    });

    it('prints the by-month header in text output', async () => {
      await program.parseAsync(['change-requests', 'by-month'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('=== Change Requests by Month ===');
    });

    it('prints JSON when --output json is provided', async () => {
      await program.parseAsync(['change-requests', 'by-month', '--output', 'json'], {
        from: 'user',
      });

      const output = getOutput();
      expect(output).toContain('"period": "2026-01"');
    });
  });

  describe('change-requests by-week', () => {
    it('forwards filters to getMetricsByWeek', async () => {
      await program.parseAsync(
        [
          'change-requests',
          'by-week',
          '--start-date',
          '2026-01-01',
          '--exclude-commenters',
          'dave',
        ],
        { from: 'user' }
      );

      expect(getMetricsByWeekMock).toHaveBeenCalledWith({
        ...baseFilters,
        startDate: '2026-01-01',
        excludeCommenters: ['dave'],
      });
    });

    it('prints the by-week header in text output', async () => {
      await program.parseAsync(['change-requests', 'by-week'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('=== Change Requests by Week ===');
    });

    it('prints JSON when --output json is provided', async () => {
      await program.parseAsync(['change-requests', 'by-week', '--output', 'json'], {
        from: 'user',
      });

      const output = getOutput();
      expect(output).toContain('"period": "2026-W01"');
    });
  });

  describe('change-requests through-time', () => {
    it('forwards filters and aggregateBy to getThroughTime', async () => {
      await program.parseAsync(
        [
          'change-requests',
          'through-time',
          '--start-date',
          '2026-01-01',
          '--aggregate-by',
          'month',
        ],
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
      await program.parseAsync(['change-requests', 'through-time'], { from: 'user' });

      expect(getThroughTimeMock).toHaveBeenCalledWith(baseFilters, undefined);
    });

    it('prints through-time rows in text output', async () => {
      await program.parseAsync(['change-requests', 'through-time'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('=== Change Requests Through Time ===');
      expect(output).toContain('2026-01 | Opened: 5');
      expect(output).toContain('2026-01 | Closed: 4');
    });

    it('prints JSON when --output json is provided', async () => {
      await program.parseAsync(['change-requests', 'through-time', '--output', 'json'], {
        from: 'user',
      });

      const output = getOutput();
      expect(output).toContain('"kind": "Opened"');
    });
  });

  describe('change-requests by-author', () => {
    it('forwards filters and top to getByAuthor', async () => {
      await program.parseAsync(
        ['change-requests', 'by-author', '--top', '5', '--authors', 'alice'],
        { from: 'user' }
      );

      expect(getByAuthorMock).toHaveBeenCalledWith(
        {
          ...baseFilters,
          authors: ['alice'],
        },
        5
      );
    });

    it('defaults top to 10 when not provided', async () => {
      await program.parseAsync(['change-requests', 'by-author'], { from: 'user' });

      expect(getByAuthorMock).toHaveBeenCalledWith(baseFilters, 10);
    });

    it('prints authors grouped in text output', async () => {
      await program.parseAsync(['change-requests', 'by-author'], { from: 'user' });

      const output = getOutput();
      expect(output).toContain('=== Change Requests by Author ===');
      expect(output).toContain('alice: 5 change requests');
    });

    it('prints JSON when --output json is provided', async () => {
      await program.parseAsync(['change-requests', 'by-author', '--output', 'json'], {
        from: 'user',
      });

      const output = getOutput();
      expect(output).toContain('"author": "alice"');
    });
  });

  describe('Output Formatters', () => {
    it('should format change request summary in the expected CLI shape', () => {
      const output = formatChangeRequestSummary(summaryResponse.result);

      expect(output).toContain('Change Requests Summary:');
      expect(output).toContain('Change requests without conclusion: 1');
      expect(output).toContain('Comments per change request: 1.5');
      expect(output).toContain('  - bug: 1 change requests');
      expect(output).toContain('Most commented change request:');
      expect(output).toContain('Top commenter:');
      expect(output).toContain('Top themes:');
      expect(output).toContain('Time to first comment:');
    });

    it('should format change request metrics in text format', () => {
      const data = {
        totalChangeRequests: 42,
        leadTime: { average: 2.5, unit: 'days' },
        commentSummary: { total: 156 },
        labelSummary: { bug: 8, feature: 15 },
      };

      const output = formatChangeRequestMetrics(data, { format: 'text' });
      expect(output).toContain('Change Request Metrics');
      expect(output).toContain('42');
      expect(output).toContain('2d 12h');
    });

    it('should format change request metrics in JSON format', () => {
      const data = {
        totalChangeRequests: 42,
        leadTime: { average: 2.5, unit: 'days' },
      };

      const output = formatChangeRequestMetrics(data, { format: 'json' });
      const parsed = JSON.parse(output);
      expect(parsed.totalChangeRequests).toBe(42);
      expect(parsed.leadTime.average).toBe(2.5);
    });

    it('should format change request metrics in CSV format', () => {
      const data = {
        totalChangeRequests: 42,
        leadTime: { average: 2.5, unit: 'days' },
        commentSummary: { total: 156 },
      };

      const output = formatChangeRequestMetrics(data, { format: 'csv' });
      expect(output).toContain('metric,value');
      expect(output).toContain('total_prs,42');
      expect(output).toContain('lead_time_days,2.5');
    });
  });
});
