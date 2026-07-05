import { describe, it, expect, beforeEach } from 'vitest';
import { IReadPullRequestsRepository } from '..';
import { PRsService } from '..';
import {
  PullRequestBuilder,
  ReadPullRequestsRepositoryBuilder,
} from '../../../test/builders';
import { MockLoggerBuilder } from '../../../test/mock-logger-builder';
import { TimeZoneProvider } from '../../../infrastructure/timezone-provider';

const logger = new MockLoggerBuilder().build();

describe('PRsService', () => {
  let prsService: PRsService;
  let mockPrRepo: IReadPullRequestsRepository;

  beforeEach(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const prs = [
      new PullRequestBuilder()
        .withAuthor('Alice')
        .withTitle('Feature A')
        .withCreatedAt(oneWeekAgo.toISOString())
        .withMergedAt(twoDaysAgo.toISOString())
        .withComments(5)
        .withLabels([{ name: 'enhancement' }])
        .build(),
      new PullRequestBuilder()
        .withAuthor('Bob')
        .withTitle('Fix bug B')
        .withCreatedAt(new Date().toISOString())
        .withComments(2)
        .withLabels([{ name: 'bugfix' }])
        .build(),
    ];

    mockPrRepo = new ReadPullRequestsRepositoryBuilder().withPullRequests(prs).build();

    prsService = new PRsService(mockPrRepo, new TimeZoneProvider('UTC'), logger);
  });

  it('should calculate overall metrics', async () => {
    const metrics = await prsService.getMetrics();

    expect(metrics.totalPRs).toBeGreaterThan(0);
    expect(metrics.averageOpenDays).toBeGreaterThanOrEqual(0);
    expect(metrics.averageComments).toBeGreaterThanOrEqual(0);
    expect(metrics.mergedPRs).toBeGreaterThanOrEqual(0);
  });

  it('should calculate PR summary for CLI and REST consumers', async () => {
    const prs = [
      new PullRequestBuilder()
        .withId(101)
        .withNumber(1)
        .withTitle('First change')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withUpdatedAt('2025-01-01T00:00:00Z')
        .withClosedAt('2025-01-02T00:00:00Z')
        .withAuthor('alice', 1)
        .withLabels([{ name: 'bug' }])
        .withUrl('https://example.test/pulls/1')
        .withCommentDetails([
          {
            url: 'https://example.test/comments/1',
            body: 'github code review',
            pull_request_review_id: 1,
            id: 1,
            createdAt: '2025-01-01T02:00:00Z',
            author: { login: 'reviewer', id: 3 },
            reactions: {
              url: '',
              total_count: 0,
              '+1': 0,
              '-1': 0,
              laugh: 0,
              hooray: 0,
              confused: 0,
              heart: 0,
              rocket: 0,
              eyes: 0,
            },
          },
        ])
        .build(),
      new PullRequestBuilder()
        .withId(102)
        .withNumber(2)
        .withTitle('Second change')
        .withCreatedAt('2025-01-03T00:00:00Z')
        .withUpdatedAt('2025-01-03T00:00:00Z')
        .withMergedAt('2025-01-04T00:00:00Z')
        .withClosedAt('2025-01-04T00:00:00Z')
        .withState('merged')
        .withAuthor('bob', 2)
        .withLabels([{ name: 'bug' }])
        .withUrl('https://example.test/pulls/2')
        .withCommentDetails([
          {
            url: 'https://example.test/comments/2',
            body: 'github code',
            pull_request_review_id: 2,
            id: 2,
            createdAt: '2025-01-03T04:00:00Z',
            author: { login: 'reviewer', id: 3 },
            reactions: {
              url: '',
              total_count: 0,
              '+1': 0,
              '-1': 0,
              laugh: 0,
              hooray: 0,
              confused: 0,
              heart: 0,
              rocket: 0,
              eyes: 0,
            },
          },
          {
            url: 'https://example.test/comments/3',
            body: 'code',
            pull_request_review_id: 3,
            id: 3,
            createdAt: '2025-01-03T05:00:00Z',
            author: { login: 'other-reviewer', id: 4 },
            reactions: {
              url: '',
              total_count: 0,
              '+1': 0,
              '-1': 0,
              laugh: 0,
              hooray: 0,
              confused: 0,
              heart: 0,
              rocket: 0,
              eyes: 0,
            },
          },
        ])
        .build(),
    ];
    prsService = new PRsService(
      new ReadPullRequestsRepositoryBuilder().withPullRequests(prs).build(),
      new TimeZoneProvider('UTC'),
      logger
    );

    const summary = (await prsService.getSummary()).result;

    expect(summary.total_prs).toBe(2);
    expect(summary.merged_prs).toBe(1);
    expect(summary.closed_prs).toBe(2);
    expect(summary.prs_without_conclusion).toBe(1);
    expect(summary.avg_comments_per_pr).toBe(1.5);
    expect(summary.labels).toEqual([{ label: 'bug', prs: 2 }]);
    expect(summary.first_pr?.number).toBe(1);
    expect(summary.last_pr?.number).toBe(2);
    expect(summary.most_commented_pr).toMatchObject({ number: 2, comments: 2 });
    expect(summary.top_commenter).toEqual({ login: 'reviewer', comments: 2 });
    expect(summary.time_to_first_comment_hours).toMatchObject({
      average: 3,
      median: 3,
      min: 2,
      max: 4,
      prs_with_comment: 2,
      prs_without_comment: 0,
    });
  });

  it('should get metrics by month', async () => {
    const metrics = await prsService.getMetricsByMonth();

    expect(Array.isArray(metrics)).toBe(true);
    for (const month of metrics) {
      expect(month.period).toMatch(/^\d{4}-\d{2}$/); // YYYY-MM format
      expect(month.count).toBeGreaterThanOrEqual(0);
      expect(month.averageOpenDays).toBeGreaterThanOrEqual(0);
    }
  });

  it('should get metrics by week', async () => {
    const metrics = await prsService.getMetricsByWeek();

    expect(Array.isArray(metrics)).toBe(true);
    for (const week of metrics) {
      expect(week.period).toMatch(/^\d{4}-W\d{2}$/); // YYYY-Wxx format
      expect(week.count).toBeGreaterThanOrEqual(0);
    }
  });

  it('should get label summaries', async () => {
    const labels = await prsService.getLabelSummaries();

    expect(Array.isArray(labels)).toBe(true);
    for (const label of labels) {
      expect(label.label).toBeDefined();
      expect(label.count).toBeGreaterThan(0);
      expect(label.averageOpenDays).toBeGreaterThanOrEqual(0);
    }
  });

  it('should filter PRs by author', async () => {
    const metrics = await prsService.getMetrics({
      authors: ['Alice'],
    });

    expect(metrics).toBeDefined();
    expect(metrics.totalPRs).toBeGreaterThanOrEqual(0);
  });

  it('should filter PRs by state merged', async () => {
    const metrics = await prsService.getMetrics({
      state: 'merged',
    });

    expect(metrics.mergedPRs).toBeGreaterThanOrEqual(0);
  });

  describe('getMetrics', () => {
    it('should exclude weekend PRs before calculating metrics when weekends filter is set to exclude', async () => {
      const saturdayPr = new PullRequestBuilder()
        .withId(1)
        .withTitle('Saturday PR')
        .withCreatedAt('2026-06-06T10:00:00Z')
        .build();
      const mondayPr = new PullRequestBuilder()
        .withId(2)
        .withTitle('Monday PR')
        .withCreatedAt('2026-06-08T10:00:00Z')
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([saturdayPr, mondayPr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const includeMetrics = await prsService.getMetrics({
        cleaning: { weekends: 'include' },
      });
      const excludeMetrics = await prsService.getMetrics({
        cleaning: { weekends: 'exclude' },
      });
      const weekendsOnlyMetrics = await prsService.getMetrics({
        cleaning: { weekends: 'weekends_only' },
      });

      expect(includeMetrics.totalPRs).toBe(2);
      expect(excludeMetrics.totalPRs).toBe(1);
      expect(excludeMetrics.openPRs).toBe(1);
      expect(weekendsOnlyMetrics.totalPRs).toBe(1);
      expect(weekendsOnlyMetrics.openPRs).toBe(1);
    });

    it('should classify open, closed-not-merged, and merged PRs and apply the totalComments fallback', async () => {
      const openPr = new PullRequestBuilder().withId(1).withTitle('Open PR').build();
      const closedNotMergedPr = new PullRequestBuilder()
        .withId(2)
        .withTitle('Closed not merged')
        .withClosedAt('2025-01-05T00:00:00Z')
        .build();
      const mergedPr = new PullRequestBuilder()
        .withId(3)
        .withTitle('Merged PR')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withMergedAt('2025-01-02T00:00:00Z')
        .build();
      const prWithUndefinedTotalComments = new PullRequestBuilder()
        .withId(4)
        .withTitle('No comments field')
        .withComments(undefined)
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder()
          .withPullRequests([openPr, closedNotMergedPr, mergedPr, prWithUndefinedTotalComments])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const metrics = await prsService.getMetrics();

      expect(metrics.openPRs).toBe(2);
      expect(metrics.closedPRs).toBe(1);
      expect(metrics.mergedPRs).toBe(1);
      expect(metrics.totalPRs).toBe(4);
      expect(metrics.averageComments).toBe(0);
    });

    it('should exclude PRs with zero or negative totalComments from most_commented_prs', async () => {
      const zeroComments = new PullRequestBuilder().withId(1).withTitle('Zero comments').build();
      const negativeComments = new PullRequestBuilder()
        .withId(2)
        .withTitle('Negative comments')
        .withComments(-1)
        .build();
      const withComments = new PullRequestBuilder()
        .withId(3)
        .withTitle('Has comments')
        .withComments(3)
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder()
          .withPullRequests([zeroComments, negativeComments, withComments])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const metrics = await prsService.getMetrics();

      expect(metrics.most_commented_prs).toHaveLength(1);
      expect(metrics.most_commented_prs[0].pull_request_id).toBe(3);
    });

    it('should default averageOpenDays and averageComments to 0 for an empty PR list', async () => {
      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const metrics = await prsService.getMetrics();

      expect(metrics.totalPRs).toBe(0);
      expect(metrics.averageOpenDays).toBe(0);
      expect(metrics.averageComments).toBe(0);
      expect(metrics.most_commented_prs).toEqual([]);
    });
  });

  describe('getMetricsByWeek', () => {
    it('should skip PRs with no mergedAt when grouping by week', async () => {
      const mergedPr = new PullRequestBuilder()
        .withId(1)
        .withTitle('Merged PR')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withMergedAt('2025-01-02T00:00:00Z')
        .build();
      const unmergedPr = new PullRequestBuilder()
        .withId(2)
        .withTitle('Unmerged PR')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([mergedPr, unmergedPr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const weeks = await prsService.getMetricsByWeek();

      const totalCounted = weeks.reduce((sum, week) => sum + week.count, 0);
      expect(totalCounted).toBe(1);
    });

    it('should group two merged PRs into the same week bucket', async () => {
      const firstMergedPr = new PullRequestBuilder()
        .withId(1)
        .withTitle('First merged PR')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withMergedAt('2025-01-02T00:00:00Z')
        .build();
      const secondMergedPr = new PullRequestBuilder()
        .withId(2)
        .withTitle('Second merged PR')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withMergedAt('2025-01-03T00:00:00Z')
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder()
          .withPullRequests([firstMergedPr, secondMergedPr])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const weeks = await prsService.getMetricsByWeek();

      expect(weeks).toHaveLength(1);
      expect(weeks[0].count).toBe(2);
    });
  });

  describe('getLabelSummaries', () => {
    it('should fall back to an empty label list when a PR has no labels', async () => {
      const noLabelsPr = new PullRequestBuilder()
        .withId(1)
        .withTitle('No labels')
        .withLabels(undefined)
        .build();
      const labeledPr = new PullRequestBuilder()
        .withId(2)
        .withTitle('Labeled')
        .withLabels([{ name: 'bug' }])
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([noLabelsPr, labeledPr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const labels = await prsService.getLabelSummaries();

      expect(labels).toEqual([{ label: 'bug', count: 1, averageOpenDays: expect.any(Number) }]);
    });

    it('should use closedAt to compute open days for a closed-not-merged labeled PR', async () => {
      const closedNotMergedPr = new PullRequestBuilder()
        .withId(1)
        .withTitle('Closed not merged')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withClosedAt('2025-01-03T00:00:00Z')
        .withLabels([{ name: 'bug' }])
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([closedNotMergedPr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const labels = await prsService.getLabelSummaries();

      expect(labels).toEqual([{ label: 'bug', count: 1, averageOpenDays: 2 }]);
    });

    it('should accumulate two PRs sharing the same label under one entry', async () => {
      const firstBugPr = new PullRequestBuilder()
        .withId(1)
        .withTitle('First bug PR')
        .withLabels([{ name: 'bug' }])
        .build();
      const secondBugPr = new PullRequestBuilder()
        .withId(2)
        .withTitle('Second bug PR')
        .withLabels([{ name: 'bug' }])
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([firstBugPr, secondBugPr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const labels = await prsService.getLabelSummaries();

      expect(labels).toEqual([{ label: 'bug', count: 2, averageOpenDays: expect.any(Number) }]);
    });
  });

  describe('getSummary', () => {
    it('should exclude authorless PRs from the unique author count and use "unknown" for most_commented_pr/top_commenter', async () => {
      const authorlessPr = new PullRequestBuilder()
        .withId(1)
        .withTitle('No author')
        .withComments(2)
        .withoutAuthor()
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([authorlessPr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await prsService.getSummary()).result;

      expect(summary.unique_authors).toBe(0);
      expect(summary.most_commented_pr?.author).toBe('unknown');
    });

    it('should exclude PRs missing id, title, or url from most_commented_prs', async () => {
      const missingId = new PullRequestBuilder()
        .withId(undefined)
        .withTitle('Missing id')
        .withComments(5)
        .build();
      const missingTitle = new PullRequestBuilder()
        .withId(2)
        .withTitle(undefined)
        .withComments(4)
        .build();
      const missingUrl = new PullRequestBuilder()
        .withId(3)
        .withTitle('Missing url')
        .withComments(3)
        .withUrl(undefined)
        .build();
      const valid = new PullRequestBuilder()
        .withId(4)
        .withTitle('Valid PR')
        .withComments(1)
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder()
          .withPullRequests([missingId, missingTitle, missingUrl, valid])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await prsService.getSummary()).result;

      expect(summary.most_commented_prs).toHaveLength(1);
      expect(summary.most_commented_prs[0].pull_request_id).toBe(4);
    });

    it('should return null most_commented_pr when the top PR by sort has zero comments', async () => {
      const noComments = new PullRequestBuilder().withId(1).withTitle('No comments').build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([noComments]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await prsService.getSummary()).result;

      expect(summary.most_commented_pr).toBeNull();
    });

    it('should return null first_pr, last_pr, and top_commenter for an empty PR list', async () => {
      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await prsService.getSummary()).result;

      expect(summary.first_pr).toBeNull();
      expect(summary.last_pr).toBeNull();
      expect(summary.top_commenter).toBeNull();
      expect(summary.most_commented_pr).toBeNull();
    });

    it('should break label-count ties alphabetically by label name', async () => {
      const prWithZebra = new PullRequestBuilder()
        .withId(1)
        .withTitle('Zebra labeled')
        .withLabels([{ name: 'zebra' }])
        .build();
      const prWithAlpha = new PullRequestBuilder()
        .withId(2)
        .withTitle('Alpha labeled')
        .withLabels([{ name: 'alpha' }])
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder()
          .withPullRequests([prWithZebra, prWithAlpha])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await prsService.getSummary()).result;

      expect(summary.labels).toEqual([
        { label: 'alpha', prs: 1 },
        { label: 'zebra', prs: 1 },
      ]);
    });

    it('should fall back to an empty label list in the summary when a PR has no labels', async () => {
      const noLabelsPr = new PullRequestBuilder()
        .withId(1)
        .withTitle('No labels')
        .withLabels(undefined)
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([noLabelsPr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await prsService.getSummary()).result;

      expect(summary.labels).toEqual([]);
      expect(summary.unique_labels).toBe(0);
    });

    it('should fall back to an empty string for a label with no name', async () => {
      const prWithUnnamedLabel = new PullRequestBuilder()
        .withId(1)
        .withTitle('Unnamed label')
        .withLabels([{}])
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([prWithUnnamedLabel]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await prsService.getSummary()).result;

      expect(summary.labels).toEqual([]);
    });

    it('should break comment-count ties alphabetically by commenter login', async () => {
      const pr = new PullRequestBuilder()
        .withId(1)
        .withTitle('Tied commenters')
        .withCommentDetails([
          { body: 'hi', author: { login: 'zoe', id: 1 } },
          { body: 'hi', author: { login: 'amy', id: 2 } },
        ])
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([pr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await prsService.getSummary()).result;

      expect(summary.top_commenter).toEqual({ login: 'amy', comments: 1 });
    });
  });

  describe('getThroughTime', () => {
    it('should not record a Closed count for PRs with neither mergedAt nor closedAt', async () => {
      const openPr = new PullRequestBuilder()
        .withId(1)
        .withTitle('Still open')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([openPr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const rows = await prsService.getThroughTime();

      const closedRow = rows.find((row) => row.kind === 'Closed');
      expect(closedRow?.count).toBe(0);
      const openedRow = rows.find((row) => row.kind === 'Opened');
      expect(openedRow?.count).toBe(1);
    });

    it('should record a Closed count on the mergedAt period for a merged PR', async () => {
      const mergedPr = new PullRequestBuilder()
        .withId(1)
        .withTitle('Merged PR')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withMergedAt('2025-01-08T00:00:00Z')
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([mergedPr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const rows = await prsService.getThroughTime();

      const totalClosed = rows
        .filter((row) => row.kind === 'Closed')
        .reduce((sum, row) => sum + row.count, 0);
      expect(totalClosed).toBe(1);
    });

    it('should default to week aggregation when aggregateBy is omitted', async () => {
      const pr = new PullRequestBuilder()
        .withId(1)
        .withTitle('PR')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([pr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const rows = await prsService.getThroughTime();

      expect(rows[0].date).toMatch(/^\d{4}-W\d{2}$/);
    });

    it('should aggregate by day when aggregateBy is "day"', async () => {
      const pr = new PullRequestBuilder()
        .withId(1)
        .withTitle('PR')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([pr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const rows = await prsService.getThroughTime(undefined, 'day');

      expect(rows[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should aggregate by month when aggregateBy is "month"', async () => {
      const pr = new PullRequestBuilder()
        .withId(1)
        .withTitle('PR')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([pr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const rows = await prsService.getThroughTime(undefined, 'month');

      expect(rows[0].date).toMatch(/^\d{4}-\d{2}$/);
    });

    it('should fall back to week aggregation for an invalid aggregateBy value', async () => {
      const pr = new PullRequestBuilder()
        .withId(1)
        .withTitle('PR')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([pr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const rows = await prsService.getThroughTime(undefined, 'fortnight');

      expect(rows[0].date).toMatch(/^\d{4}-W\d{2}$/);
    });
  });

  describe('getByAuthor', () => {
    it('should group authorless PRs under "unknown"', async () => {
      const authorlessPr = new PullRequestBuilder()
        .withId(1)
        .withTitle('No author')
        .withoutAuthor()
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([authorlessPr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await prsService.getByAuthor();

      expect(result).toEqual([{ author: 'unknown', count: 1 }]);
    });

    it('should default to top 10 when top is omitted, and respect an explicit top value', async () => {
      const prs = Array.from({ length: 12 }, (_, i) =>
        new PullRequestBuilder()
          .withId(i + 1)
          .withTitle(`PR ${i}`)
          .withAuthor(`author${i}`)
          .build()
      );

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests(prs).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const defaultTop = await prsService.getByAuthor();
      const explicitTop = await prsService.getByAuthor(undefined, 3);

      expect(defaultTop).toHaveLength(10);
      expect(explicitTop).toHaveLength(3);
    });
  });

  describe('toTimestamp (via getAverageReviewTime)', () => {
    it('should treat an unparseable date string as timestamp 0', async () => {
      const invalidDatePr = new PullRequestBuilder()
        .withId(1)
        .withTitle('Invalid date')
        .withAuthor('alice')
        .withCreatedAt('not-a-real-date')
        .withClosedAt('2025-01-03T00:00:00Z')
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([invalidDatePr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await prsService.getAverageReviewTime();

      expect(result[0].avg_days).toEqual(expect.any(Number));
      expect(Number.isFinite(result[0].avg_days)).toBe(true);
    });
  });

  describe('getAverageReviewTime', () => {
    it('should use closedAt when mergedAt is absent, and mergedAt when both are present', async () => {
      const closedOnly = new PullRequestBuilder()
        .withId(1)
        .withTitle('Closed only')
        .withAuthor('alice')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withClosedAt('2025-01-03T00:00:00Z')
        .build();
      const mergedAndClosed = new PullRequestBuilder()
        .withId(2)
        .withTitle('Merged and closed')
        .withAuthor('bob')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withMergedAt('2025-01-02T00:00:00Z')
        .withClosedAt('2025-01-05T00:00:00Z')
        .build();
      const authorless = new PullRequestBuilder()
        .withId(3)
        .withTitle('Authorless')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withClosedAt('2025-01-02T00:00:00Z')
        .withoutAuthor()
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder()
          .withPullRequests([closedOnly, mergedAndClosed, authorless])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await prsService.getAverageReviewTime();

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ author: 'alice', avg_days: 2 }),
          expect.objectContaining({ author: 'bob', avg_days: 1 }),
          expect.objectContaining({ author: 'unknown', avg_days: 1 }),
        ])
      );
    });

    it('should default to top 10 when top is omitted, and respect an explicit top value', async () => {
      const prs = Array.from({ length: 12 }, (_, i) =>
        new PullRequestBuilder()
          .withId(i + 1)
          .withTitle(`PR ${i}`)
          .withAuthor(`author${i}`)
          .withCreatedAt('2025-01-01T00:00:00Z')
          .withMergedAt('2025-01-02T00:00:00Z')
          .build()
      );

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests(prs).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const defaultTop = await prsService.getAverageReviewTime();
      const explicitTop = await prsService.getAverageReviewTime(undefined, 3);

      expect(defaultTop).toHaveLength(10);
      expect(explicitTop).toHaveLength(3);
    });
  });

  describe('getAverageOpenBy', () => {
    it('should fall back to createdAt for the end timestamp when a PR has neither mergedAt nor closedAt', async () => {
      const stillOpenPr = new PullRequestBuilder()
        .withId(1)
        .withTitle('Still open')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([stillOpenPr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await prsService.getAverageOpenBy();

      expect(result).toEqual([{ period: expect.any(String), avg_days: 0 }]);
    });

    it('should use closedAt when mergedAt is absent', async () => {
      const closedOnly = new PullRequestBuilder()
        .withId(1)
        .withTitle('Closed only')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withClosedAt('2025-01-03T00:00:00Z')
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([closedOnly]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await prsService.getAverageOpenBy();

      expect(result).toEqual([{ period: expect.any(String), avg_days: 2 }]);
    });

    it('should aggregate by day when aggregateBy is "day"', async () => {
      const pr = new PullRequestBuilder()
        .withId(1)
        .withTitle('PR')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withMergedAt('2025-01-02T00:00:00Z')
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([pr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await prsService.getAverageOpenBy(undefined, 'day');

      expect(result[0].period).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should sort multiple periods chronologically', async () => {
      const laterPr = new PullRequestBuilder()
        .withId(1)
        .withTitle('Later PR')
        .withCreatedAt('2025-02-01T00:00:00Z')
        .withMergedAt('2025-02-02T00:00:00Z')
        .build();
      const earlierPr = new PullRequestBuilder()
        .withId(2)
        .withTitle('Earlier PR')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withMergedAt('2025-01-02T00:00:00Z')
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([laterPr, earlierPr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await prsService.getAverageOpenBy(undefined, 'month');

      expect(result.map((r) => r.period)).toEqual(['2025-01', '2025-02']);
    });
  });

  describe('extractTopThemes (via getSummary)', () => {
    it('should skip PRs with no comments and PRs whose comment bodies are empty/whitespace-only', async () => {
      const noCommentsPr = new PullRequestBuilder().withId(1).withTitle('No comments').build();
      const whitespaceOnlyPr = new PullRequestBuilder()
        .withId(2)
        .withTitle('Whitespace only')
        .withCommentDetails([{ body: '   ' }, { body: '' }])
        .build();
      const meaningfulPr = new PullRequestBuilder()
        .withId(3)
        .withTitle('Meaningful')
        .withCommentDetails([{ body: 'database migration database migration' }])
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder()
          .withPullRequests([noCommentsPr, whitespaceOnlyPr, meaningfulPr])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await prsService.getSummary()).result;

      expect(summary.top_themes).toEqual(
        expect.arrayContaining([{ text: 'database migration', value: 2 }])
      );
    });

    it('should exclude short words (<3 chars) and numeric-only tokens from themes', async () => {
      const pr = new PullRequestBuilder()
        .withId(1)
        .withTitle('Short and numeric tokens')
        .withCommentDetails([{ body: 'ok 42 cache cache cache' }])
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([pr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await prsService.getSummary()).result;

      expect(summary.top_themes).toEqual(expect.arrayContaining([{ text: 'cache', value: 3 }]));
      expect(summary.top_themes.some((theme) => theme.text.includes('ok'))).toBe(false);
      expect(summary.top_themes.some((theme) => theme.text.includes('42'))).toBe(false);
    });
  });

  describe('calculateFirstCommentTimeSummary (via getSummary)', () => {
    it('should ignore PRs with no comments and PRs whose comments all lack createdAt', async () => {
      const noCommentsPr = new PullRequestBuilder().withId(1).withTitle('No comments').build();
      const commentsWithoutCreatedAt = new PullRequestBuilder()
        .withId(2)
        .withTitle('No createdAt on comments')
        .withCommentDetails([{ body: 'hi', createdAt: undefined }])
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder()
          .withPullRequests([noCommentsPr, commentsWithoutCreatedAt])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await prsService.getSummary()).result;

      expect(summary.time_to_first_comment_hours).toEqual({
        average: 0,
        median: 0,
        min: 0,
        max: 0,
        prs_with_comment: 0,
        prs_without_comment: 2,
      });
    });

    it('should skip a PR whose first comment is timestamped before the PR was opened', async () => {
      const backdatedCommentPr = new PullRequestBuilder()
        .withId(1)
        .withTitle('Backdated comment')
        .withCreatedAt('2025-01-05T00:00:00Z')
        .withCommentDetails([{ body: 'too early', createdAt: '2025-01-01T00:00:00Z' }])
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([backdatedCommentPr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await prsService.getSummary()).result;

      expect(summary.time_to_first_comment_hours.prs_with_comment).toBe(0);
      expect(summary.time_to_first_comment_hours.prs_without_comment).toBe(1);
    });

    it('should skip a PR with an empty createdAt (unparseable PR-opened timestamp)', async () => {
      const noCreatedAtPr = new PullRequestBuilder()
        .withId(1)
        .withTitle('No createdAt')
        .withCreatedAt('')
        .withCommentDetails([{ body: 'first', createdAt: '2025-01-01T01:00:00Z' }])
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([noCreatedAtPr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await prsService.getSummary()).result;

      expect(summary.time_to_first_comment_hours.prs_with_comment).toBe(0);
      expect(summary.time_to_first_comment_hours.prs_without_comment).toBe(1);
    });

    it('should compute the odd-length median from a single PR with a comment', async () => {
      const pr = new PullRequestBuilder()
        .withId(1)
        .withTitle('Single comment')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withCommentDetails([{ body: 'first', createdAt: '2025-01-01T05:00:00Z' }])
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([pr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await prsService.getSummary()).result;

      expect(summary.time_to_first_comment_hours).toMatchObject({
        average: 5,
        median: 5,
        min: 5,
        max: 5,
        prs_with_comment: 1,
        prs_without_comment: 0,
      });
    });

    it('should compute the even-length median from two PRs with comments', async () => {
      const prA = new PullRequestBuilder()
        .withId(1)
        .withTitle('PR A')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withCommentDetails([{ body: 'first', createdAt: '2025-01-01T02:00:00Z' }])
        .build();
      const prB = new PullRequestBuilder()
        .withId(2)
        .withTitle('PR B')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withCommentDetails([{ body: 'first', createdAt: '2025-01-01T08:00:00Z' }])
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([prA, prB]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await prsService.getSummary()).result;

      expect(summary.time_to_first_comment_hours).toMatchObject({
        average: 5,
        median: 5,
        min: 2,
        max: 8,
        prs_with_comment: 2,
        prs_without_comment: 0,
      });
    });

    it('should default average and median to 0 when zero PRs have comments', async () => {
      const pr = new PullRequestBuilder().withId(1).withTitle('No comments').build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([pr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await prsService.getSummary()).result;

      expect(summary.time_to_first_comment_hours.average).toBe(0);
      expect(summary.time_to_first_comment_hours.median).toBe(0);
    });
  });

  describe('getFirstCommentTime', () => {
    it('should ignore PRs with no comments and PRs whose comments all lack createdAt', async () => {
      const noCommentsPr = new PullRequestBuilder().withId(1).withTitle('No comments').build();
      const commentsWithoutCreatedAt = new PullRequestBuilder()
        .withId(2)
        .withTitle('No createdAt')
        .withCommentDetails([{ body: 'hi', createdAt: undefined }])
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder()
          .withPullRequests([noCommentsPr, commentsWithoutCreatedAt])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await prsService.getFirstCommentTime();

      expect(result).toEqual([]);
    });

    it('should skip a PR whose first comment is timestamped before the PR was opened', async () => {
      const backdatedCommentPr = new PullRequestBuilder()
        .withId(1)
        .withTitle('Backdated comment')
        .withAuthor('alice')
        .withCreatedAt('2025-01-05T00:00:00Z')
        .withCommentDetails([{ body: 'too early', createdAt: '2025-01-01T00:00:00Z' }])
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([backdatedCommentPr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await prsService.getFirstCommentTime();

      expect(result).toEqual([]);
    });

    it('should group by author and respect the default and explicit top values', async () => {
      const prs = Array.from({ length: 12 }, (_, i) =>
        new PullRequestBuilder()
          .withId(i + 1)
          .withTitle(`PR ${i}`)
          .withAuthor(`author${i}`)
          .withCreatedAt('2025-01-01T00:00:00Z')
          .withCommentDetails([{ body: 'first', createdAt: '2025-01-01T01:00:00Z' }])
          .build()
      );

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests(prs).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const defaultTop = await prsService.getFirstCommentTime();
      const explicitTop = await prsService.getFirstCommentTime(undefined, 3);

      expect(defaultTop).toHaveLength(10);
      expect(explicitTop).toHaveLength(3);
      expect(defaultTop[0]).toMatchObject({ avg_hours: 1, prs_with_comments: 1 });
    });

    it('should use "unknown" for PRs with no author', async () => {
      const authorlessPr = new PullRequestBuilder()
        .withId(1)
        .withTitle('No author')
        .withoutAuthor()
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withCommentDetails([{ body: 'first', createdAt: '2025-01-01T01:00:00Z' }])
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([authorlessPr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await prsService.getFirstCommentTime();

      expect(result).toEqual([{ author: 'unknown', avg_hours: 1, prs_with_comments: 1 }]);
    });

    it('should pick the earliest comment as first when a PR has multiple comments', async () => {
      const pr = new PullRequestBuilder()
        .withId(1)
        .withTitle('Multiple comments')
        .withAuthor('alice')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withCommentDetails([
          { body: 'later', createdAt: '2025-01-01T05:00:00Z' },
          { body: 'earlier', createdAt: '2025-01-01T01:00:00Z' },
        ])
        .build();

      prsService = new PRsService(
        new ReadPullRequestsRepositoryBuilder().withPullRequests([pr]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await prsService.getFirstCommentTime();

      expect(result).toEqual([{ author: 'alice', avg_hours: 1, prs_with_comments: 1 }]);
    });
  });
});
