import { describe, it, expect, beforeEach } from 'vitest';
import { IReadPullRequestsRepository, PairingIndexService, PipelinesRepository } from '..';
import { PRsService } from '..';
import { PipelinesService } from '..';
import {
  CommitBuilder,
  PullRequestBuilder,
  PipelineJobBuilder,
  PipelineRunBuilder,
  PipelineStepBuilder,
  RepositoryBuilder,
  ReadPullRequestsRepositoryBuilder,
  PipelinesRepositoryBuilder,
} from '../test/builders';
import { IRepository } from '..';
import { Commit } from '../domain-types';
import { MockLoggerBuilder } from '../test/mock-logger-builder';
import { TimeZoneProvider } from '../infrastructure/timezone-provider';

const logger = new MockLoggerBuilder().build();

describe('PairingIndexService', () => {
  let pairingService: PairingIndexService;
  let mockCommitRepo: IRepository<Commit>;

  beforeEach(() => {
    mockCommitRepo = new RepositoryBuilder<Commit>()
      .withLoadAll([
        new CommitBuilder()
          .withAuthor('Alice')
          .withMessage('Add feature')
          .withTimestamp('2024-01-01T10:00:00Z')
          .withFiles([{ path: 'src/main.ts', additions: 10, deletions: 0, status: 'added' }])
          .build(),
        new CommitBuilder()
          .withAuthor('Bob')
          .withMessage('Fix bug')
          .withTimestamp('2024-01-02T10:00:00Z')
          .withFiles([{ path: 'src/utils.ts', additions: 5, deletions: 2, status: 'modified' }])
          .build(),
      ])
      .build();

    pairingService = new PairingIndexService(mockCommitRepo, new TimeZoneProvider('UTC'), logger);
  });

  it('should calculate pairing index correctly', async () => {
    const result = await pairingService.getPairingIndex();

    expect(result.totalAnalyzedCommits).toBeGreaterThan(0);
    expect(result.pairingIndexPercentage).toBeGreaterThanOrEqual(0);
    expect(result.pairingIndexPercentage).toBeLessThanOrEqual(100);
  });

  it('should return 0 for pairing index when no commits', async () => {
    pairingService = new PairingIndexService(
      new RepositoryBuilder<Commit>().withLoadAll([]).build(),
      new TimeZoneProvider('UTC'),
      logger
    );

    const result = await pairingService.getPairingIndex();

    expect(result.totalAnalyzedCommits).toBe(0);
    expect(result.pairingIndexPercentage).toBe(0);
  });

  it('should filter commits by author', async () => {
    const result = await pairingService.getPairingIndex({
      selectedAuthors: ['Alice'],
    });

    expect(result).toBeDefined();
    expect(typeof result.pairingIndexPercentage).toBe('number');
  });

  it('should filter commits by exclude authors', async () => {
    const result = await pairingService.getPairingIndex({
      excludeAuthors: 'Bob',
    });

    expect(result).toBeDefined();
    expect(result.totalAnalyzedCommits).toBeGreaterThanOrEqual(0);
  });

  it('should round pairing index to 2 decimal places', async () => {
    const result = await pairingService.getPairingIndex();

    const decimalPlaces = result.pairingIndexPercentage.toString().split('.')[1]?.length || 0;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });

  it('should filter commits by start date', async () => {
    const result = await pairingService.getPairingIndex({
      startDate: '2024-01-02',
    });

    expect(result.totalAnalyzedCommits).toBe(1);
  });

  it('should filter commits by end date', async () => {
    const result = await pairingService.getPairingIndex({
      endDate: '2024-01-01',
    });

    expect(result.totalAnalyzedCommits).toBe(1);
  });

  it('should filter commits by date range', async () => {
    const result = await pairingService.getPairingIndex({
      startDate: '2024-01-01',
      endDate: '2024-01-01',
    });

    expect(result.totalAnalyzedCommits).toBe(1);
  });

  it('should return 0 when start date is after all commits', async () => {
    const result = await pairingService.getPairingIndex({
      startDate: '2025-01-01',
    });

    expect(result.totalAnalyzedCommits).toBe(0);
  });

  it('should return 0 when end date is before all commits', async () => {
    const result = await pairingService.getPairingIndex({
      endDate: '2023-01-01',
    });

    expect(result.totalAnalyzedCommits).toBe(0);
  });

  it('should count a commit with coAuthors but no files as paired', async () => {
    pairingService = new PairingIndexService(
      new RepositoryBuilder<Commit>()
        .withLoadAll([
          new CommitBuilder().withAuthor('Alice').withFiles([]).withCoAuthors(['Bob']).build(),
        ])
        .build(),
      new TimeZoneProvider('UTC'),
      logger
    );

    const result = await pairingService.getPairingIndex();

    expect(result.totalAnalyzedCommits).toBe(1);
    expect(result.pairedCommits).toBe(1);
  });

  it('should parse includeAuthors comma-separated string, trimming whitespace and dropping empty segments', async () => {
    pairingService = new PairingIndexService(
      new RepositoryBuilder<Commit>()
        .withLoadAll([
          new CommitBuilder().withAuthor('Alice').build(),
          new CommitBuilder().withAuthor('Bob').build(),
          new CommitBuilder().withAuthor('Carol').build(),
        ])
        .build(),
      new TimeZoneProvider('UTC'),
      logger
    );

    const result = await pairingService.getPairingIndex({
      includeAuthors: 'Alice, Bob,',
    });

    expect(result.totalAnalyzedCommits).toBe(2);
  });

  it('should merge includeAuthors string with selectedAuthors array', async () => {
    pairingService = new PairingIndexService(
      new RepositoryBuilder<Commit>()
        .withLoadAll([
          new CommitBuilder().withAuthor('Alice').build(),
          new CommitBuilder().withAuthor('Bob').build(),
          new CommitBuilder().withAuthor('Carol').build(),
        ])
        .build(),
      new TimeZoneProvider('UTC'),
      logger
    );

    const result = await pairingService.getPairingIndex({
      selectedAuthors: ['Alice'],
      includeAuthors: 'Bob',
    });

    expect(result.totalAnalyzedCommits).toBe(2);
  });

  describe('calculateTopPairings (via getPairingIndex)', () => {
    it('should produce one pairing entry per coAuthor on a commit with multiple coAuthors', async () => {
      pairingService = new PairingIndexService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([
            new CommitBuilder().withAuthor('Alice').withCoAuthors(['Bob', 'Carol']).build(),
          ])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex();

      expect(result.topPairings).toEqual(
        expect.arrayContaining([
          { author: 'Alice', coAuthor: 'Bob', pairedCommits: 1 },
          { author: 'Alice', coAuthor: 'Carol', pairedCommits: 1 },
        ])
      );
      expect(result.topPairings).toHaveLength(2);
    });

    it('should merge the same pair from two commits regardless of which author is primary', async () => {
      pairingService = new PairingIndexService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([
            new CommitBuilder().withAuthor('Alice').withCoAuthors(['Bob']).build(),
            new CommitBuilder().withAuthor('Bob').withCoAuthors(['Alice']).build(),
          ])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex();

      expect(result.topPairings).toEqual([{ author: 'Alice', coAuthor: 'Bob', pairedCommits: 2 }]);
    });

    it('should exclude a self-pair where the author and coAuthor are the same person case-insensitively', async () => {
      pairingService = new PairingIndexService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([
            new CommitBuilder().withAuthor('Alice').withCoAuthors(['alice']).build(),
          ])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex();

      expect(result.topPairings).toEqual([]);
    });

    it('should skip an empty-string or whitespace-only coAuthor entry', async () => {
      pairingService = new PairingIndexService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([
            new CommitBuilder().withAuthor('Alice').withCoAuthors(['   ']).build(),
          ])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex();

      expect(result.topPairings).toEqual([]);
    });

    it('should skip a commit whose author is empty or whitespace-only', async () => {
      pairingService = new PairingIndexService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([
            new CommitBuilder().withAuthor('   ').withCoAuthors(['Bob']).build(),
          ])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex();

      expect(result.topPairings).toEqual([]);
    });

    it('should sort pairings descending by pairedCommits, then by author, then by coAuthor', async () => {
      pairingService = new PairingIndexService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([
            // Alice/Bob paired twice -> highest count
            new CommitBuilder().withAuthor('Alice').withHash('c1').withCoAuthors(['Bob']).build(),
            new CommitBuilder().withAuthor('Alice').withHash('c2').withCoAuthors(['Bob']).build(),
            // Alice/Zoe and Alice/Yara both paired once -> tie broken by coAuthor
            new CommitBuilder().withAuthor('Alice').withHash('c3').withCoAuthors(['Zoe']).build(),
            new CommitBuilder().withAuthor('Alice').withHash('c4').withCoAuthors(['Yara']).build(),
          ])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex();

      expect(result.topPairings).toEqual([
        { author: 'Alice', coAuthor: 'Bob', pairedCommits: 2 },
        { author: 'Alice', coAuthor: 'Yara', pairedCommits: 1 },
        { author: 'Alice', coAuthor: 'Zoe', pairedCommits: 1 },
      ]);
    });

    it('should sort same-count, same-author pairings by coAuthor alphabetically using a third distinct pair', async () => {
      pairingService = new PairingIndexService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([
            new CommitBuilder().withAuthor('Bob').withHash('c1').withCoAuthors(['Carol']).build(),
            new CommitBuilder().withAuthor('Alice').withHash('c2').withCoAuthors(['Zoe']).build(),
            new CommitBuilder().withAuthor('Alice').withHash('c3').withCoAuthors(['Yara']).build(),
          ])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex();

      expect(result.topPairings).toEqual([
        { author: 'Alice', coAuthor: 'Yara', pairedCommits: 1 },
        { author: 'Alice', coAuthor: 'Zoe', pairedCommits: 1 },
        { author: 'Bob', coAuthor: 'Carol', pairedCommits: 1 },
      ]);
    });
  });

  describe('getLatestPairedCommits (via getPairingIndex)', () => {
    it('should only include commits with coAuthors, excluding unpaired commits from the latest list', async () => {
      pairingService = new PairingIndexService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([
            new CommitBuilder()
              .withAuthor('Alice')
              .withHash('paired-1')
              .withCoAuthors(['Bob'])
              .build(),
            new CommitBuilder().withAuthor('Carol').withHash('unpaired-1').build(),
          ])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex();

      expect(result.totalAnalyzedCommits).toBe(2);
      expect(result.latestPairedCommits).toHaveLength(1);
      expect(result.latestPairedCommits?.[0].hash).toBe('paired-1');
    });

    it('should sort latest paired commits by timestamp descending', async () => {
      pairingService = new PairingIndexService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([
            new CommitBuilder()
              .withAuthor('Alice')
              .withHash('older')
              .withTimestamp('2024-01-01T10:00:00Z')
              .withCoAuthors(['Bob'])
              .build(),
            new CommitBuilder()
              .withAuthor('Alice')
              .withHash('newer')
              .withTimestamp('2024-01-05T10:00:00Z')
              .withCoAuthors(['Bob'])
              .build(),
          ])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex();

      expect(result.latestPairedCommits?.map((c) => c.hash)).toEqual(['newer', 'older']);
    });

    it('should serialize a Date timestamp via toISOString', async () => {
      const dateTimestamp = new Date('2024-01-01T10:00:00Z');
      pairingService = new PairingIndexService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([
            new CommitBuilder()
              .withAuthor('Alice')
              .withHash('date-commit')
              .withCoAuthors(['Bob'])
              .withTimestamp(dateTimestamp)
              .build(),
          ])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex();

      expect(result.latestPairedCommits?.[0].timestamp).toBe(dateTimestamp.toISOString());
    });

    it('should use subject when set, falling back to msg, then to an empty string', async () => {
      pairingService = new PairingIndexService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([
            new CommitBuilder()
              .withAuthor('Alice')
              .withHash('with-subject')
              .withMessage('fallback msg')
              .withCoAuthors(['Bob'])
              .withSubject('explicit subject')
              .build(),
            new CommitBuilder()
              .withAuthor('Alice')
              .withHash('without-subject')
              .withMessage('used as fallback')
              .withCoAuthors(['Bob'])
              .build(),
            new CommitBuilder()
              .withAuthor('Alice')
              .withHash('neither')
              .withCoAuthors(['Bob'])
              .withSubject('')
              .withMessage('')
              .build(),
          ])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex();

      const byHash = new Map(result.latestPairedCommits?.map((c) => [c.hash, c.subject]));
      expect(byHash.get('with-subject')).toBe('explicit subject');
      expect(byHash.get('without-subject')).toBe('used as fallback');
      expect(byHash.get('neither')).toBe('');
    });
  });

  describe('filterByAuthors (via getPairingIndex)', () => {
    it('should exclude an author even when that author is also in selectedAuthors', async () => {
      pairingService = new PairingIndexService(
        new RepositoryBuilder<Commit>()
          .withLoadAll([
            new CommitBuilder().withAuthor('Alice').withHash('alice-commit').build(),
            new CommitBuilder().withAuthor('Bob').withHash('bob-commit').build(),
          ])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await pairingService.getPairingIndex({
        selectedAuthors: ['Alice', 'Bob'],
        excludeAuthors: 'Alice',
      });

      expect(result.totalAnalyzedCommits).toBe(1);
    });
  });
});

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

describe('PipelinesService', () => {
  let pipelinesService: PipelinesService;
  let mockPipelineRepo: PipelinesRepository;

  function buildDeployRun({
    id,
    number,
    name = 'Release',
    createdAt,
    updatedAt,
    path,
    jobId,
    jobName,
    jobStartedAt,
    jobCompletedAt,
  }: {
    id: string;
    number: number;
    name?: string;
    createdAt: string;
    updatedAt: string;
    path: string;
    jobId?: string;
    jobName?: string;
    jobStartedAt?: string;
    jobCompletedAt?: string;
  }) {
    const jobs =
      jobId && jobName
        ? [
            new PipelineJobBuilder()
              .withId(jobId)
              .withName(jobName)
              .withStatus('completed')
              .withConclusion('success')
              .withStartedAt(jobStartedAt)
              .withCompletedAt(jobCompletedAt)
              .build(),
          ]
        : [];

    return new PipelineRunBuilder()
      .withId(id)
      .withNumber(number)
      .withName(name)
      .withStatus('completed')
      .withConclusion('success')
      .withCreatedAt(createdAt)
      .withUpdatedAt(updatedAt)
      .withBranch('main')
      .withPath(path)
      .withJobs(jobs)
      .build();
  }

  beforeEach(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const runs = [
      new PipelineRunBuilder()
        .withNumber(1)
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt(oneWeekAgo.toISOString())
        .withStartedAt(oneWeekAgo.toISOString())
        .withCompletedAt(twoDaysAgo.toISOString())
        .withBranch('main')
        .build(),
      new PipelineRunBuilder()
        .withNumber(2)
        .withStatus('completed')
        .withConclusion('failure')
        .withCreatedAt(new Date().toISOString())
        .withStartedAt(new Date().toISOString())
        .withConclusion('failure')
        .build(),
    ];

    mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(runs).build();

    pipelinesService = new PipelinesService(
      mockPipelineRepo,
      undefined,
      logger,
      new TimeZoneProvider('UTC')
    );
  });

  it('should calculate overall metrics', async () => {
    const metrics = await pipelinesService.getMetrics();

    expect(metrics.totalRuns).toBeGreaterThan(0);
    expect(metrics.successfulRuns).toBeGreaterThanOrEqual(0);
    expect(metrics.failedRuns).toBeGreaterThanOrEqual(0);
    expect(metrics.successRate).toBeGreaterThanOrEqual(0);
    expect(metrics.successRate).toBeLessThanOrEqual(100);
  });

  it('should get deployment frequency by day', async () => {
    const freq = await pipelinesService.getDeploymentFrequency('day');

    expect(Array.isArray(freq)).toBe(true);
    for (const day of freq) {
      expect(day.period).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD format
      expect(day.count).toBeGreaterThanOrEqual(0);
    }
  });

  it('should get deployment frequency by week', async () => {
    const freq = await pipelinesService.getDeploymentFrequency('week');

    expect(Array.isArray(freq)).toBe(true);
    for (const week of freq) {
      expect(week.period).toMatch(/^\d{4}-W\d{2}$/); // YYYY-Wxx format
      expect(week.count).toBeGreaterThanOrEqual(0);
    }
  });

  it('should get deployment frequency by month', async () => {
    const freq = await pipelinesService.getDeploymentFrequency('month');

    expect(Array.isArray(freq)).toBe(true);
    for (const month of freq) {
      expect(month.period).toMatch(/^\d{4}-\d{2}$/); // YYYY-MM format
      expect(month.count).toBeGreaterThanOrEqual(0);
    }
  });

  it('should get job metrics', async () => {
    const jobMetrics = await pipelinesService.getJobMetrics();

    expect(Array.isArray(jobMetrics)).toBe(true);
    for (const job of jobMetrics) {
      expect(job.jobName).toBeDefined();
      expect(job.totalRuns).toBeGreaterThanOrEqual(0);
      expect(job.successRate).toBeGreaterThanOrEqual(0);
      expect(job.successRate).toBeLessThanOrEqual(100);
      expect(job.failureRate).toBeGreaterThanOrEqual(0);
      expect(job.failureRate).toBeLessThanOrEqual(100);
    }
  });

  it('should filter runs by branch', async () => {
    const metrics = await pipelinesService.getMetrics({
      targetBranch: 'main',
    });

    expect(metrics).toBeDefined();
    expect(metrics.totalRuns).toBeGreaterThanOrEqual(0);
  });

  it('should exclude weekend runs when weekends filter is set to exclude', async () => {
    const weekendAndWeekdayRuns = [
      new PipelineRunBuilder()
        .withId('run-saturday')
        .withNumber(1)
        .withName('Saturday run')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2026-06-06T10:00:00Z')
        .withUpdatedAt('2026-06-06T10:10:00Z')
        .withBranch('main')
        .withPath('.github/workflows/ci.yml')
        .build(),
      new PipelineRunBuilder()
        .withId('run-monday')
        .withNumber(2)
        .withName('Monday run')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2026-06-08T10:00:00Z')
        .withUpdatedAt('2026-06-08T10:10:00Z')
        .withBranch('main')
        .withPath('.github/workflows/ci.yml')
        .build(),
    ];

    mockPipelineRepo = new PipelinesRepositoryBuilder()
      .withPipelineRuns(weekendAndWeekdayRuns)
      .build();

    pipelinesService = new PipelinesService(
      mockPipelineRepo,
      undefined,
      logger,
      new TimeZoneProvider('UTC')
    );

    const includeMetrics = await pipelinesService.getMetrics({
      cleaning: { weekends: 'include' },
    });
    const excludeMetrics = await pipelinesService.getMetrics({
      cleaning: { weekends: 'exclude' },
    });
    const weekendsOnlyMetrics = await pipelinesService.getMetrics({
      cleaning: { weekends: 'weekends_only' },
    });

    expect(includeMetrics.totalRuns).toBe(2);
    expect(excludeMetrics.totalRuns).toBe(1);
    expect(excludeMetrics.successfulRuns).toBe(1);
    expect(weekendsOnlyMetrics.totalRuns).toBe(1);
    expect(weekendsOnlyMetrics.successfulRuns).toBe(1);
  });

  it('should aggregate deployment frequency for configured workflow and job targets', async () => {
    const deployRuns = [
      new PipelineRunBuilder()
        .withId('release-run')
        .withNumber(1)
        .withName('Release')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2025-01-01T08:00:00Z')
        .withUpdatedAt('2025-01-01T08:15:00Z')
        .withBranch('main')
        .withPath('.github/workflows/release.yml')
        .withJobs([
          new PipelineJobBuilder()
            .withId('release-job')
            .withName('deploy-production')
            .withStatus('completed')
            .withConclusion('success')
            .withStartedAt('2025-01-01T08:05:00Z')
            .withCompletedAt('2025-01-01T08:15:00Z')
            .build(),
        ])
        .build(),
      new PipelineRunBuilder()
        .withId('mobile-run')
        .withNumber(2)
        .withName('Mobile')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2025-01-01T09:00:00Z')
        .withUpdatedAt('2025-01-01T09:15:00Z')
        .withBranch('main')
        .withPath('.github/workflows/mobile.yml')
        .withJobs([
          new PipelineJobBuilder()
            .withId('mobile-job')
            .withName('deploy-mobile')
            .withStatus('completed')
            .withConclusion('success')
            .withStartedAt('2025-01-01T09:05:00Z')
            .withCompletedAt('2025-01-01T09:15:00Z')
            .build(),
        ])
        .build(),
    ];

    mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(deployRuns).build();

    pipelinesService = new PipelinesService(
      mockPipelineRepo,
      {
        getDeploymentFrequencyTargets: () => [
          { pipeline: '.github/workflows/release.yml', job: 'deploy-production' },
          { pipeline: '.github/workflows/mobile.yml', job: 'deploy-mobile' },
        ],
      } as any,
      logger,
      new TimeZoneProvider('UTC')
    );

    const frequency = await pipelinesService.getDeploymentFrequencyWithAllIntervals();

    expect(frequency).toHaveLength(2);
    expect(frequency).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pipeline: '.github/workflows/release.yml',
          job: 'deploy-production',
          daily_counts: 1,
          weekly_counts: 1,
          monthly_counts: 1,
        }),
        expect.objectContaining({
          pipeline: '.github/workflows/mobile.yml',
          job: 'deploy-mobile',
          daily_counts: 1,
          weekly_counts: 1,
          monthly_counts: 1,
        }),
      ])
    );
  });

  describe('getRunDurationMinutes', () => {
    it('should compute duration from jobs when available', () => {
      const run = {
        startedAt: '2025-01-01T10:00:00Z',
        completedAt: '2025-01-01T20:00:00Z', // stale updated_at: 10 hours later
        jobs: [
          {
            startedAt: '2025-01-01T10:01:00Z',
            completedAt: '2025-01-01T10:05:00Z',
          },
        ],
      };

      const duration = pipelinesService.getRunDurationMinutes(run);

      // Should use job timestamps (4 minutes), not run-level (600 minutes)
      expect(duration).toBe(4);
    });

    it('should return null when no valid jobs exist', () => {
      const run = {
        startedAt: '2025-01-01T10:00:00Z',
        completedAt: '2026-02-05T10:05:00Z', // stale updated_at: ~570,000 minutes
        jobs: [],
      };

      const duration = pipelinesService.getRunDurationMinutes(run);

      // Should NOT fall back to stale run-level timestamps
      expect(duration).toBeNull();
    });

    it('should return null when jobs have invalid timestamps', () => {
      const run = {
        startedAt: '2025-01-01T10:00:00Z',
        completedAt: '2025-01-01T10:05:00Z',
        jobs: [
          {
            startedAt: '2025-01-01T10:01:00Z',
            completedAt: '', // invalid
          },
        ],
      };

      const duration = pipelinesService.getRunDurationMinutes(run);

      expect(duration).toBeNull();
    });

    it('should use the earliest job start and latest job end', () => {
      const run = {
        startedAt: '2025-01-01T10:00:00Z',
        completedAt: '2025-01-01T20:00:00Z',
        jobs: [
          {
            startedAt: '2025-01-01T10:02:00Z',
            completedAt: '2025-01-01T10:05:00Z',
          },
          {
            startedAt: '2025-01-01T10:01:00Z',
            completedAt: '2025-01-01T10:10:00Z',
          },
        ],
      };

      const duration = pipelinesService.getRunDurationMinutes(run);

      // earliest start: 10:01, latest end: 10:10 => 9 minutes
      expect(duration).toBe(9);
    });
  });

  describe('getMetrics average duration', () => {
    it('should exclude runs without jobs from average duration', async () => {
      const runs = [
        new PipelineRunBuilder()
          .withId('run-1')
          .withNumber(1)
          .withName('Build')
          .withStatus('completed')
          .withConclusion('success')
          .withCreatedAt('2025-01-01T08:00:00Z')
          .withUpdatedAt('2025-01-01T08:15:00Z')
          .withStartedAt('2025-01-01T08:00:00Z')
          .withBranch('main')
          .withPath('.github/workflows/build.yml')
          .withJobs([
            new PipelineJobBuilder()
              .withId('job-1')
              .withName('test')
              .withStatus('completed')
              .withConclusion('success')
              .withStartedAt('2025-01-01T08:01:00Z')
              .withCompletedAt('2025-01-01T08:05:00Z')
              .build(),
          ])
          .build(),
        new PipelineRunBuilder()
          .withId('run-2')
          .withNumber(2)
          .withName('Build')
          .withStatus('completed')
          .withConclusion('success')
          .withCreatedAt('2025-01-01T09:00:00Z')
          .withUpdatedAt('2026-06-01T09:00:00Z')
          .withStartedAt('2025-01-01T09:00:00Z')
          .withBranch('main')
          .withPath('.github/workflows/build.yml')
          .withJobs([])
          .build(),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(runs).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const metrics = await pipelinesService.getMetrics();

      // Average should be 4 minutes (only from run-1), not ~570k minutes
      expect(metrics.averageDurationMinutes).toBe(4);
    });
  });

  describe('getRunMetricDate', () => {
    it('should use completedAt when present', () => {
      const date = pipelinesService.getRunMetricDate({
        createdAt: '2025-01-01T08:00:00Z',
        completedAt: '2025-01-02T08:00:00Z',
      });

      expect(date).toBe('2025-01-02T08:00:00Z');
    });

    it('should fall back to createdAt when completedAt is absent', () => {
      const date = pipelinesService.getRunMetricDate({
        createdAt: '2025-01-01T08:00:00Z',
      });

      expect(date).toBe('2025-01-01T08:00:00Z');
    });
  });

  describe('getDurationMinutes', () => {
    it('should return null when startedAt is missing', () => {
      const duration = pipelinesService.getDurationMinutes(undefined, '2025-01-01T08:05:00Z');

      expect(duration).toBeNull();
    });

    it('should return null when completedAt is missing', () => {
      const duration = pipelinesService.getDurationMinutes('2025-01-01T08:00:00Z', undefined);

      expect(duration).toBeNull();
    });

    it('should return null when completedAt is before startedAt', () => {
      const duration = pipelinesService.getDurationMinutes(
        '2025-01-01T08:05:00Z',
        '2025-01-01T08:00:00Z'
      );

      expect(duration).toBeNull();
    });

    it('should return the minute difference for a valid range', () => {
      const duration = pipelinesService.getDurationMinutes(
        '2025-01-01T08:00:00Z',
        '2025-01-01T08:10:00Z'
      );

      expect(duration).toBe(10);
    });
  });

  describe('getPeriodKey', () => {
    it('should delegate to the timezone provider for the day interval', () => {
      const key = pipelinesService.getPeriodKey('2025-01-15T08:00:00Z', 'day');

      expect(key).toBe('2025-01-15');
    });
  });

  describe('filterRunsByDateRange', () => {
    const runs = [
      { createdAt: '2025-01-01T08:00:00Z' },
      { createdAt: '2025-01-10T08:00:00Z' },
      { createdAt: '2025-01-20T08:00:00Z' },
    ];

    it('should return all runs unfiltered when no startDate or endDate is given', () => {
      const filtered = pipelinesService.filterRunsByDateRange(runs);

      expect(filtered).toEqual(runs);
    });

    it('should exclude runs before startDate when only startDate is given', () => {
      const filtered = pipelinesService.filterRunsByDateRange(runs, '2025-01-05T00:00:00Z');

      expect(filtered).toEqual([
        { createdAt: '2025-01-10T08:00:00Z' },
        { createdAt: '2025-01-20T08:00:00Z' },
      ]);
    });

    it('should exclude runs after endDate when only endDate is given', () => {
      const filtered = pipelinesService.filterRunsByDateRange(
        runs,
        undefined,
        '2025-01-15T00:00:00Z'
      );

      expect(filtered).toEqual([
        { createdAt: '2025-01-01T08:00:00Z' },
        { createdAt: '2025-01-10T08:00:00Z' },
      ]);
    });

    it('should exclude runs outside the range when both startDate and endDate are given', () => {
      const filtered = pipelinesService.filterRunsByDateRange(
        runs,
        '2025-01-05T00:00:00Z',
        '2025-01-15T00:00:00Z'
      );

      expect(filtered).toEqual([{ createdAt: '2025-01-10T08:00:00Z' }]);
    });

    it('should treat a date-only endDate as the end of that day', () => {
      const sameDay = [{ createdAt: '2025-01-10T23:30:00Z' }];

      const filtered = pipelinesService.filterRunsByDateRange(sameDay, undefined, '2025-01-10');

      expect(filtered).toEqual(sameDay);
    });

    it('should interpret week-only ranges using ISO week boundaries', () => {
      const weeklyRuns = [
        { createdAt: '2026-01-04T10:00:00Z' },
        { createdAt: '2026-01-06T10:00:00Z' },
        { createdAt: '2026-01-13T10:00:00Z' },
      ];

      const filtered = pipelinesService.filterRunsByDateRange(
        weeklyRuns,
        '2026-W02',
        '2026-W02'
      );

      expect(filtered).toEqual([{ createdAt: '2026-01-06T10:00:00Z' }]);
    });

    it('should treat a full ISO datetime endDate literally rather than as end-of-day', () => {
      const sameDay = [{ createdAt: '2025-01-10T23:30:00Z' }];

      const filtered = pipelinesService.filterRunsByDateRange(
        sameDay,
        undefined,
        '2025-01-10T12:00:00Z'
      );

      expect(filtered).toEqual([]);
    });

    it('should sort runs ascending by metric date when requested', () => {
      const unordered = [
        { createdAt: '2025-01-20T08:00:00Z' },
        { createdAt: '2025-01-01T08:00:00Z' },
        { createdAt: '2025-01-10T08:00:00Z' },
      ];

      const sorted = pipelinesService.filterRunsByDateRange(unordered, undefined, undefined, {
        sort_by: { created_at: 'asc' },
      });

      expect(sorted).toEqual([
        { createdAt: '2025-01-01T08:00:00Z' },
        { createdAt: '2025-01-10T08:00:00Z' },
        { createdAt: '2025-01-20T08:00:00Z' },
      ]);
    });

    it('should sort runs descending by metric date when requested', () => {
      const unordered = [
        { createdAt: '2025-01-01T08:00:00Z' },
        { createdAt: '2025-01-20T08:00:00Z' },
        { createdAt: '2025-01-10T08:00:00Z' },
      ];

      const sorted = pipelinesService.filterRunsByDateRange(unordered, undefined, undefined, {
        sort_by: { created_at: 'desc' },
      });

      expect(sorted).toEqual([
        { createdAt: '2025-01-20T08:00:00Z' },
        { createdAt: '2025-01-10T08:00:00Z' },
        { createdAt: '2025-01-01T08:00:00Z' },
      ]);
    });

    it('should treat an unparseable startDate as timestamp 0 (no lower bound applied)', () => {
      const filtered = pipelinesService.filterRunsByDateRange(runs, 'not-a-real-date');

      expect(filtered).toEqual(runs);
    });
  });

  describe('getDeploymentFrequency with configured targets', () => {
    beforeEach(() => {
      const deployRuns = [
        buildDeployRun({
          id: 'release-run-1',
          number: 1,
          createdAt: '2025-01-01T08:00:00Z',
          updatedAt: '2025-01-01T08:15:00Z',
          path: '.github/workflows/release.yml',
          jobId: 'release-job-1',
          jobName: 'deploy-production',
          jobStartedAt: '2025-01-01T08:05:00Z',
          jobCompletedAt: '2025-01-01T08:15:00Z',
        }),
        buildDeployRun({
          id: 'release-run-2',
          number: 2,
          createdAt: '2025-01-02T08:00:00Z',
          updatedAt: '2025-01-02T08:15:00Z',
          path: '.github/workflows/release.yml',
          jobId: 'release-job-2',
          jobName: 'deploy-production',
          jobStartedAt: '2025-01-02T08:05:00Z',
          jobCompletedAt: '2025-01-02T08:15:00Z',
        }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(deployRuns).build();

      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        {
          getDeploymentFrequencyTargets: () => [
            { pipeline: '.github/workflows/release.yml', job: 'deploy-production' },
          ],
        } as any,
        logger,
        new TimeZoneProvider('UTC')
      );
    });

    it('should group counts by day across the deployment date range', async () => {
      const frequency = await pipelinesService.getDeploymentFrequency('day');

      expect(frequency).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ period: '2025-01-01', count: 1 }),
          expect.objectContaining({ period: '2025-01-02', count: 1 }),
        ])
      );
    });

    it('should group counts by week across the deployment date range', async () => {
      const frequency = await pipelinesService.getDeploymentFrequency('week');

      expect(frequency.length).toBeGreaterThan(0);
      const total = frequency.reduce((sum, item) => sum + item.count, 0);
      expect(total).toBe(2);
      for (const item of frequency) {
        expect(item.period).toMatch(/^\d{4}-W\d{2}$/);
      }
    });

    it('should group counts by month across the deployment date range', async () => {
      const frequency = await pipelinesService.getDeploymentFrequency('month');

      expect(frequency).toEqual(
        expect.arrayContaining([expect.objectContaining({ period: '2025-01', count: 2 })])
      );
    });
  });

  describe('getDeploymentFrequencyWithAllIntervals edge cases', () => {
    it('should skip jobs with neither completedAt nor startedAt', async () => {
      const deployRuns = [
        buildDeployRun({
          id: 'release-run',
          number: 1,
          createdAt: '2025-01-01T08:00:00Z',
          updatedAt: '2025-01-01T08:15:00Z',
          path: '.github/workflows/release.yml',
          jobId: 'release-job-no-timestamps',
          jobName: 'deploy-production',
          jobStartedAt: undefined,
          jobCompletedAt: undefined,
        }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(deployRuns).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        {
          getDeploymentFrequencyTargets: () => [
            { pipeline: '.github/workflows/release.yml', job: 'deploy-production' },
          ],
        } as any,
        logger,
        new TimeZoneProvider('UTC')
      );

      const frequency = await pipelinesService.getDeploymentFrequencyWithAllIntervals();

      expect(frequency).toEqual([]);
    });

    it('should return an empty array when targets are configured but no deployments match', async () => {
      const deployRuns = [
        buildDeployRun({
          id: 'unrelated-run',
          number: 1,
          name: 'Other',
          createdAt: '2025-01-01T08:00:00Z',
          updatedAt: '2025-01-01T08:15:00Z',
          path: '.github/workflows/other.yml',
        }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(deployRuns).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        {
          getDeploymentFrequencyTargets: () => [
            { pipeline: '.github/workflows/release.yml', job: 'deploy-production' },
          ],
        } as any,
        logger,
        new TimeZoneProvider('UTC')
      );

      const frequency = await pipelinesService.getDeploymentFrequencyWithAllIntervals();

      expect(frequency).toEqual([]);
    });

    it('should report zero counts for days/weeks/months within the range that have no deployments', async () => {
      const deployRuns = [
        buildDeployRun({
          id: 'release-run-1',
          number: 1,
          createdAt: '2025-01-01T08:00:00Z',
          updatedAt: '2025-01-01T08:15:00Z',
          path: '.github/workflows/release.yml',
          jobId: 'release-job-1',
          jobName: 'deploy-production',
          jobStartedAt: '2025-01-01T08:05:00Z',
          jobCompletedAt: '2025-01-01T08:15:00Z',
        }),
        buildDeployRun({
          id: 'release-run-3',
          number: 2,
          createdAt: '2025-01-03T08:00:00Z',
          updatedAt: '2025-01-03T08:15:00Z',
          path: '.github/workflows/release.yml',
          jobId: 'release-job-3',
          jobName: 'deploy-production',
          jobStartedAt: '2025-01-03T08:05:00Z',
          jobCompletedAt: '2025-01-03T08:15:00Z',
        }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(deployRuns).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        {
          getDeploymentFrequencyTargets: () => [
            { pipeline: '.github/workflows/release.yml', job: 'deploy-production' },
          ],
        } as any,
        logger,
        new TimeZoneProvider('UTC')
      );

      const frequency = await pipelinesService.getDeploymentFrequencyWithAllIntervals();

      // jan 2 falls inside the range but has no deployment, so all its counts default to 0
      expect(frequency).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            days: '2025-01-02',
            daily_counts: 0,
            weekly_counts: 2,
            monthly_counts: 2,
          }),
        ])
      );
    });

    it('should default weekly and monthly counts to zero for a mid-range day in a week/month with no deployments', async () => {
      const deployRuns = [
        buildDeployRun({
          id: 'release-run-jan',
          number: 1,
          createdAt: '2025-01-01T08:00:00Z',
          updatedAt: '2025-01-01T08:15:00Z',
          path: '.github/workflows/release.yml',
          jobId: 'release-job-jan',
          jobName: 'deploy-production',
          jobStartedAt: '2025-01-01T08:05:00Z',
          jobCompletedAt: '2025-01-01T08:15:00Z',
        }),
        buildDeployRun({
          id: 'release-run-mar',
          number: 2,
          createdAt: '2025-03-01T08:00:00Z',
          updatedAt: '2025-03-01T08:15:00Z',
          path: '.github/workflows/release.yml',
          jobId: 'release-job-mar',
          jobName: 'deploy-production',
          jobStartedAt: '2025-03-01T08:05:00Z',
          jobCompletedAt: '2025-03-01T08:15:00Z',
        }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(deployRuns).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        {
          getDeploymentFrequencyTargets: () => [
            { pipeline: '.github/workflows/release.yml', job: 'deploy-production' },
          ],
        } as any,
        logger,
        new TimeZoneProvider('UTC')
      );

      const frequency = await pipelinesService.getDeploymentFrequencyWithAllIntervals();

      // Feb 15 falls in a week and month (February) with zero deployments of its own.
      expect(frequency).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            days: '2025-02-15',
            daily_counts: 0,
            weekly_counts: 0,
            monthly_counts: 0,
          }),
        ])
      );
    });
  });

  describe('getJobMetrics', () => {
    function jobRun(
      id: string,
      jobName: string,
      conclusion: string | undefined,
      options: { runAttempt?: number; startedAt?: string; completedAt?: string; path?: string } = {}
    ): import('../domain-types').PipelineRun {
      return new PipelineRunBuilder()
        .withId(id)
        .withNumber(1)
        .withName('Build')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2025-01-01T08:00:00Z')
        .withUpdatedAt('2025-01-01T08:15:00Z')
        .withBranch('main')
        .withPath(options.path ?? '.github/workflows/build.yml')
        .withRunAttempt(options.runAttempt)
        .withJobs([
          new PipelineJobBuilder()
            .withId(`${id}-job`)
            .withName(jobName)
            .withStatus('completed')
            .withConclusion(conclusion)
            .withStartedAt(options.startedAt ?? '2025-01-01T08:01:00Z')
            .withCompletedAt(options.completedAt)
            .build(),
        ])
        .build();
    }

    it('should treat a run with no jobs array as contributing no job metrics', async () => {
      const runWithoutJobs = new PipelineRunBuilder()
        .withId('run-no-jobs')
        .withNumber(1)
        .withName('Build')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2025-01-01T08:00:00Z')
        .withUpdatedAt('2025-01-01T08:15:00Z')
        .withBranch('main')
        .withPath('.github/workflows/build.yml')
        .withJobs(undefined)
        .build();
      const runWithJob = jobRun('run-with-job', 'test', 'success', {
        completedAt: '2025-01-01T08:05:00Z',
      });

      mockPipelineRepo = new PipelinesRepositoryBuilder()
        .withPipelineRuns([runWithoutJobs, runWithJob])
        .build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const jobMetrics = await pipelinesService.getJobMetrics();

      expect(jobMetrics).toHaveLength(1);
      expect(jobMetrics[0].jobName).toBe('test');
      expect(jobMetrics[0].totalRuns).toBe(1);
    });

    it('should count each job conclusion type, including an unrecognized value as unknown', async () => {
      const runs = [
        jobRun('run-success', 'test', 'success', { completedAt: '2025-01-01T08:05:00Z' }),
        jobRun('run-failure', 'test', 'failure', { completedAt: '2025-01-01T08:05:00Z' }),
        jobRun('run-cancelled', 'test', 'cancelled', { completedAt: '2025-01-01T08:05:00Z' }),
        jobRun('run-timed-out', 'test', 'timed_out', { completedAt: '2025-01-01T08:05:00Z' }),
        jobRun('run-action-required', 'test', 'action_required', {
          completedAt: '2025-01-01T08:05:00Z',
        }),
        jobRun('run-skipped', 'test', 'skipped', { completedAt: '2025-01-01T08:05:00Z' }),
        jobRun('run-unknown', 'test', 'neutral', { completedAt: '2025-01-01T08:05:00Z' }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(runs).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const jobMetrics = await pipelinesService.getJobMetrics();

      expect(jobMetrics).toHaveLength(1);
      const metrics = jobMetrics[0];
      expect(metrics.jobName).toBe('test');
      expect(metrics.totalRuns).toBe(7);
      expect(metrics.successCount).toBe(1);
      expect(metrics.failureCount).toBe(1);
      expect(metrics.cancelledCount).toBe(1);
      expect(metrics.timedOutCount).toBe(1);
      expect(metrics.actionRequiredCount).toBe(1);
      expect(metrics.skippedCount).toBe(1);
      expect(metrics.unknownCount).toBe(1);
    });

    it('should count reruns from runAttempt > 1 and not count when runAttempt is absent', async () => {
      const runs = [
        jobRun('run-no-attempt', 'test', 'success', { completedAt: '2025-01-01T08:05:00Z' }),
        jobRun('run-attempt-3', 'test', 'success', {
          runAttempt: 3,
          completedAt: '2025-01-01T08:05:00Z',
        }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(runs).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const jobMetrics = await pipelinesService.getJobMetrics();

      // run-no-attempt contributes 0 reruns, run-attempt-3 contributes 2
      expect(jobMetrics[0].rerunCount).toBe(2);
    });

    it('should merge multiple runs producing the same job name into one entry', async () => {
      const runs = [
        jobRun('run-1', 'shared-job', 'success', { completedAt: '2025-01-01T08:05:00Z' }),
        jobRun('run-2', 'shared-job', 'failure', { completedAt: '2025-01-01T08:05:00Z' }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(runs).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const jobMetrics = await pipelinesService.getJobMetrics();

      expect(jobMetrics).toHaveLength(1);
      expect(jobMetrics[0].totalRuns).toBe(2);
      expect(jobMetrics[0].successCount).toBe(1);
      expect(jobMetrics[0].failureCount).toBe(1);
    });

    it('should keep the same job name separate for different workflows', async () => {
      const runs = [
        jobRun('run-build', 'shared-job', 'success', {
          completedAt: '2025-01-01T08:05:00Z',
          path: '.github/workflows/build.yml',
        }),
        jobRun('run-release', 'shared-job', 'failure', {
          completedAt: '2025-01-01T08:05:00Z',
          path: '.github/workflows/release.yml',
        }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(runs).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const jobMetrics = await pipelinesService.getJobMetrics();

      expect(jobMetrics).toHaveLength(2);
      expect(jobMetrics.map((metric) => metric.workflowName).sort()).toEqual([
        '.github/workflows/build.yml',
        '.github/workflows/release.yml',
      ]);
    });

    it('should include only jobs with both startedAt and completedAt in the duration calculation', async () => {
      const runs = [
        jobRun('run-with-duration', 'test', 'success', {
          startedAt: '2025-01-01T08:00:00Z',
          completedAt: '2025-01-01T08:10:00Z', // 10 minutes
        }),
        jobRun('run-without-completed', 'test', 'success', {
          startedAt: '2025-01-01T08:00:00Z',
          completedAt: undefined,
        }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(runs).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const jobMetrics = await pipelinesService.getJobMetrics();

      // Average should be exactly 10 (only from run-with-duration)
      expect(jobMetrics[0].averageDurationMinutes).toBe(10);
      expect(jobMetrics[0].successRate).toBe(100);
      expect(jobMetrics[0].failureRate).toBe(0);
    });

    it('should sort multiple jobs by totalRuns descending', async () => {
      const runs = [
        jobRun('run-a-1', 'job-a', 'success', { completedAt: '2025-01-01T08:05:00Z' }),
        jobRun('run-b-1', 'job-b', 'success', { completedAt: '2025-01-01T08:05:00Z' }),
        jobRun('run-b-2', 'job-b', 'success', { completedAt: '2025-01-01T08:05:00Z' }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(runs).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const jobMetrics = await pipelinesService.getJobMetrics();

      expect(jobMetrics.map((m) => m.jobName)).toEqual(['job-b', 'job-a']);
    });
  });

  describe('getJobRerunsByDay', () => {
    function dayRun(
      id: string,
      createdAt: string,
      options: { completedAt?: string; runAttempt?: number } = {}
    ): import('../domain-types').PipelineRun {
      return new PipelineRunBuilder()
        .withId(id)
        .withNumber(1)
        .withName('Build')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt(createdAt)
        .withUpdatedAt(createdAt)
        .withCompletedAt(options.completedAt)
        .withRunAttempt(options.runAttempt)
        .withBranch('main')
        .withPath('.github/workflows/build.yml')
        .withJobs([])
        .build();
    }

    it('should skip runs with neither completedAt nor createdAt', async () => {
      const runWithNoDate = dayRun('run-no-date', '');

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([runWithNoDate]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobRerunsByDay();

      expect(result).toEqual([]);
    });

    it('should count zero reruns for a run with no runAttempt', async () => {
      const run = dayRun('run-1', '2025-01-01T08:00:00Z');

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([run]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobRerunsByDay();

      expect(result).toEqual([{ day: '2025-01-01', rerun_count: 0 }]);
    });

    it('should accumulate reruns for multiple runs on the same day and sort by day', async () => {
      const runs = [
        dayRun('run-jan-2-a', '2025-01-02T08:00:00Z', { runAttempt: 2 }),
        dayRun('run-jan-1-a', '2025-01-01T08:00:00Z', { runAttempt: 3 }),
        dayRun('run-jan-1-b', '2025-01-01T09:00:00Z', { runAttempt: 2 }),
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(runs).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobRerunsByDay();

      // jan 1: (3-1) + (2-1) = 3 reruns; jan 2: (2-1) = 1 rerun
      expect(result).toEqual([
        { day: '2025-01-01', rerun_count: 3 },
        { day: '2025-01-02', rerun_count: 1 },
      ]);
    });

    it('should use completedAt over createdAt to determine the day when both are present', async () => {
      const run = dayRun('run-1', '2025-01-01T08:00:00Z', {
        completedAt: '2025-01-02T08:00:00Z',
        runAttempt: 2,
      });

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([run]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobRerunsByDay();

      expect(result).toEqual([{ day: '2025-01-02', rerun_count: 1 }]);
    });
  });

  describe('getJobStepsAverageTime', () => {
    function runWithSteps(
      id: string,
      steps: Array<{ name?: string; startedAt?: string; completedAt?: string }>
    ): import('../domain-types').PipelineRun {
      return new PipelineRunBuilder()
        .withId(id)
        .withNumber(1)
        .withName('Build')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2025-01-01T08:00:00Z')
        .withUpdatedAt('2025-01-01T08:15:00Z')
        .withBranch('main')
        .withPath('.github/workflows/build.yml')
        .withJobs([
          new PipelineJobBuilder()
            .withId(`${id}-job`)
            .withName('build-job')
            .withStatus('completed')
            .withConclusion('success')
            .withStartedAt('2025-01-01T08:00:00Z')
            .withCompletedAt('2025-01-01T08:15:00Z')
            .withSteps(
              steps.map((step, index) =>
                new PipelineStepBuilder()
                  .withName(step.name)
                  .withNumber(index + 1)
                  .withStartedAt(step.startedAt)
                  .withCompletedAt(step.completedAt)
                  .build()
              )
            )
            .build(),
        ])
        .build();
    }

    it('should skip steps missing a name, startedAt, or completedAt', async () => {
      const run = runWithSteps('run-1', [
        { name: undefined, startedAt: '2025-01-01T08:00:00Z', completedAt: '2025-01-01T08:05:00Z' },
        { name: 'checkout', startedAt: undefined, completedAt: '2025-01-01T08:05:00Z' },
        { name: 'build', startedAt: '2025-01-01T08:00:00Z', completedAt: undefined },
      ]);

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([run]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobStepsAverageTime();

      expect(result).toEqual([]);
    });

    it('should treat a run with no jobs array as having no steps', async () => {
      const run = new PipelineRunBuilder()
        .withId('run-no-jobs')
        .withNumber(1)
        .withName('Build')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2025-01-01T08:00:00Z')
        .withUpdatedAt('2025-01-01T08:15:00Z')
        .withBranch('main')
        .withPath('.github/workflows/build.yml')
        .withJobs(undefined)
        .build();

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([run]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobStepsAverageTime();

      expect(result).toEqual([]);
    });

    it('should treat a job with no steps array as contributing no step durations', async () => {
      const run = new PipelineRunBuilder()
        .withId('run-job-no-steps')
        .withNumber(1)
        .withName('Build')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2025-01-01T08:00:00Z')
        .withUpdatedAt('2025-01-01T08:15:00Z')
        .withBranch('main')
        .withPath('.github/workflows/build.yml')
        .withJobs([
          new PipelineJobBuilder()
            .withId('job-no-steps')
            .withName('build-job')
            .withStatus('completed')
            .withConclusion('success')
            .withStartedAt('2025-01-01T08:00:00Z')
            .withCompletedAt('2025-01-01T08:15:00Z')
            .withSteps(undefined)
            .build(),
        ])
        .build();

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([run]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobStepsAverageTime();

      expect(result).toEqual([]);
    });

    it('should compute the average duration and count for a valid step', async () => {
      const run = runWithSteps('run-1', [
        {
          name: 'checkout',
          startedAt: '2025-01-01T08:00:00Z',
          completedAt: '2025-01-01T08:05:00Z',
        },
      ]);

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([run]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobStepsAverageTime();

      expect(result).toEqual([{ name: 'checkout', averageDurationMinutes: 5, count: 1 }]);
    });

    it('should average durations for the same step name across different jobs and runs', async () => {
      const runA = runWithSteps('run-a', [
        {
          name: 'checkout',
          startedAt: '2025-01-01T08:00:00Z',
          completedAt: '2025-01-01T08:04:00Z',
        },
      ]);
      const runB = runWithSteps('run-b', [
        {
          name: 'checkout',
          startedAt: '2025-01-01T09:00:00Z',
          completedAt: '2025-01-01T09:06:00Z',
        },
      ]);

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([runA, runB]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobStepsAverageTime();

      // (4 + 6) / 2 = 5 minutes average, across 2 contributing durations
      expect(result).toEqual([{ name: 'checkout', averageDurationMinutes: 5, count: 2 }]);
    });
  });

  describe('getJobStepsAverageTimeByDay', () => {
    function runWithStepsOnDay(
      id: string,
      createdAt: string,
      steps: Array<{ name?: string; startedAt?: string; completedAt?: string }>,
      completedAt?: string
    ): import('../domain-types').PipelineRun {
      return new PipelineRunBuilder()
        .withId(id)
        .withNumber(1)
        .withName('Build')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt(createdAt)
        .withUpdatedAt(createdAt)
        .withCompletedAt(completedAt)
        .withBranch('main')
        .withPath('.github/workflows/build.yml')
        .withJobs([
          new PipelineJobBuilder()
            .withId(`${id}-job`)
            .withName('build-job')
            .withStatus('completed')
            .withConclusion('success')
            .withStartedAt(createdAt)
            .withCompletedAt(completedAt ?? createdAt)
            .withSteps(
              steps.map((step, index) =>
                new PipelineStepBuilder()
                  .withName(step.name)
                  .withNumber(index + 1)
                  .withStartedAt(step.startedAt)
                  .withCompletedAt(step.completedAt)
                  .build()
              )
            )
            .build(),
        ])
        .build();
    }

    it('should treat a run with no jobs array as having no steps for that day', async () => {
      const run = new PipelineRunBuilder()
        .withId('run-no-jobs')
        .withNumber(1)
        .withName('Build')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2025-01-01T08:00:00Z')
        .withUpdatedAt('2025-01-01T08:15:00Z')
        .withBranch('main')
        .withPath('.github/workflows/build.yml')
        .withJobs(undefined)
        .build();

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([run]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobStepsAverageTimeByDay();

      expect(result).toEqual([]);
    });

    it('should treat a job with no steps array as contributing no step durations for that day', async () => {
      const run = new PipelineRunBuilder()
        .withId('run-job-no-steps')
        .withNumber(1)
        .withName('Build')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2025-01-01T08:00:00Z')
        .withUpdatedAt('2025-01-01T08:15:00Z')
        .withBranch('main')
        .withPath('.github/workflows/build.yml')
        .withJobs([
          new PipelineJobBuilder()
            .withId('job-no-steps')
            .withName('build-job')
            .withStatus('completed')
            .withConclusion('success')
            .withStartedAt('2025-01-01T08:00:00Z')
            .withCompletedAt('2025-01-01T08:15:00Z')
            .withSteps(undefined)
            .build(),
        ])
        .build();

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([run]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobStepsAverageTimeByDay();

      expect(result).toEqual([]);
    });

    it('should skip a run with neither completedAt nor createdAt entirely', async () => {
      const run = runWithStepsOnDay('run-no-date', '', [
        {
          name: 'checkout',
          startedAt: '2025-01-01T08:00:00Z',
          completedAt: '2025-01-01T08:05:00Z',
        },
      ]);

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([run]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobStepsAverageTimeByDay();

      expect(result).toEqual([]);
    });

    it('should group step averages by day and sort the result by day', async () => {
      const runDay2 = runWithStepsOnDay('run-day-2', '2025-01-02T08:00:00Z', [
        {
          name: 'checkout',
          startedAt: '2025-01-02T08:00:00Z',
          completedAt: '2025-01-02T08:06:00Z',
        },
      ]);
      const runDay1 = runWithStepsOnDay('run-day-1', '2025-01-01T08:00:00Z', [
        {
          name: 'checkout',
          startedAt: '2025-01-01T08:00:00Z',
          completedAt: '2025-01-01T08:04:00Z',
        },
      ]);

      mockPipelineRepo = new PipelinesRepositoryBuilder()
        .withPipelineRuns([runDay2, runDay1])
        .build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobStepsAverageTimeByDay();

      expect(result).toEqual([
        { day: '2025-01-01', steps: [{ name: 'checkout', averageDurationMinutes: 4 }] },
        { day: '2025-01-02', steps: [{ name: 'checkout', averageDurationMinutes: 6 }] },
      ]);
    });

    it('should average multiple steps sharing a name on the same day', async () => {
      const run = runWithStepsOnDay('run-day-1', '2025-01-01T08:00:00Z', [
        {
          name: 'checkout',
          startedAt: '2025-01-01T08:00:00Z',
          completedAt: '2025-01-01T08:04:00Z',
        },
        {
          name: 'checkout',
          startedAt: '2025-01-01T09:00:00Z',
          completedAt: '2025-01-01T09:06:00Z',
        },
      ]);

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([run]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobStepsAverageTimeByDay();

      // (4 + 6) / 2 = 5 minutes average for 'checkout' on 2025-01-01
      expect(result).toEqual([
        { day: '2025-01-01', steps: [{ name: 'checkout', averageDurationMinutes: 5 }] },
      ]);
    });

    it('should skip steps missing a name, startedAt, or completedAt', async () => {
      const run = runWithStepsOnDay('run-1', '2025-01-01T08:00:00Z', [
        { name: undefined, startedAt: '2025-01-01T08:00:00Z', completedAt: '2025-01-01T08:05:00Z' },
        { name: 'checkout', startedAt: undefined, completedAt: '2025-01-01T08:05:00Z' },
        { name: 'build', startedAt: '2025-01-01T08:00:00Z', completedAt: undefined },
      ]);

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns([run]).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const result = await pipelinesService.getJobStepsAverageTimeByDay();

      // All steps were skipped, so the day never enters the result map.
      expect(result).toEqual([]);
    });
  });

  describe('loadUniqueWorkflows', () => {
    function runWithPath(id: string, path: string): import('../domain-types').PipelineRun {
      return new PipelineRunBuilder()
        .withId(id)
        .withNumber(1)
        .withName('Build')
        .withStatus('completed')
        .withConclusion('success')
        .withCreatedAt('2025-01-01T08:00:00Z')
        .withUpdatedAt('2025-01-01T08:15:00Z')
        .withBranch('main')
        .withPath(path)
        .withJobs([])
        .build();
    }

    it('should return distinct, sorted workflow paths and filter out empty-string paths', async () => {
      const runs = [
        runWithPath('run-1', '.github/workflows/release.yml'),
        runWithPath('run-2', '.github/workflows/build.yml'),
        runWithPath('run-3', '.github/workflows/release.yml'), // duplicate
        runWithPath('run-4', ''), // empty, filtered out
      ];

      mockPipelineRepo = new PipelinesRepositoryBuilder().withPipelineRuns(runs).build();
      pipelinesService = new PipelinesService(
        mockPipelineRepo,
        undefined,
        logger,
        new TimeZoneProvider('UTC')
      );

      const workflows = await pipelinesService.loadUniqueWorkflows();

      expect(workflows).toEqual([
        { name: '.github/workflows/build.yml', path: '.github/workflows/build.yml' },
        { name: '.github/workflows/release.yml', path: '.github/workflows/release.yml' },
      ]);
    });
  });
});
