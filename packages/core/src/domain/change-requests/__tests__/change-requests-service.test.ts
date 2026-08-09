import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IReadChangeRequestsRepository } from '..';
import { ChangeRequestsService } from '..';
import { ChangeRequestBuilder } from '../../../test/domain/domain-builders';
import { ReadChangeRequestsRepositoryBuilder } from '../../../test/repositories/repository-builders';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';
import { TimeZoneProvider } from '../../../infrastructure/timezone-provider';

const logger = new MockLoggerBuilder().build();

describe('ChangeRequestsService', () => {
  let changeRequestsService: ChangeRequestsService;
  let mockChangeRequestRepo: IReadChangeRequestsRepository;

  beforeEach(() => {
    const changeRequests = [
      new ChangeRequestBuilder()
        .withId(1)
        .withAuthor('Alice')
        .withTitle('Feature A')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withMergedAt('2025-01-03T00:00:00Z')
        .withComments(5)
        .withLabels([{ name: 'enhancement' }])
        .build(),
      new ChangeRequestBuilder()
        .withId(2)
        .withAuthor('Bob')
        .withTitle('Fix bug B')
        .withCreatedAt('2025-01-15T00:00:00Z')
        .withComments(2)
        .withLabels([{ name: 'bugfix' }])
        .build(),
    ];

    mockChangeRequestRepo = new ReadChangeRequestsRepositoryBuilder()
      .withChangeRequests(changeRequests)
      .build();

    changeRequestsService = new ChangeRequestsService(
      mockChangeRequestRepo,
      new TimeZoneProvider('UTC'),
      logger
    );
  });

  it('should calculate overall metrics', async () => {
    const metrics = await changeRequestsService.getMetrics();

    expect(metrics.totalChangeRequests).toBe(2);
    expect(metrics.mergedChangeRequests).toBe(1);
    expect(metrics.closedChangeRequests).toBe(0);
    expect(metrics.openChangeRequests).toBe(1);
    expect(metrics.openDays).toBe(2);
    expect(metrics.leadTime).toBe(2);
    expect(metrics.comments).toBe(3.5);
    expect(metrics.most_commented_change_requests).toEqual([
      {
        change_request_id: 1,
        change_request_title: 'Feature A',
        change_request_url: 'https://github.com/example/pr/1',
        comments_count: 5,
      },
      {
        change_request_id: 2,
        change_request_title: 'Fix bug B',
        change_request_url: 'https://github.com/example/pr/1',
        comments_count: 2,
      },
    ]);
  });

  it('should calculate change request summary for CLI and REST consumers', async () => {
    const changeRequests = [
      new ChangeRequestBuilder()
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
            change_request_review_id: 1,
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
      new ChangeRequestBuilder()
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
            change_request_review_id: 2,
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
            change_request_review_id: 3,
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
    changeRequestsService = new ChangeRequestsService(
      new ReadChangeRequestsRepositoryBuilder().withChangeRequests(changeRequests).build(),
      new TimeZoneProvider('UTC'),
      logger
    );

    const summary = (await changeRequestsService.getSummary()).result;

    expect(summary.total_change_requests).toBe(2);
    expect(summary.merged_change_requests).toBe(1);
    expect(summary.closed_change_requests).toBe(2);
    expect(summary.change_requests_without_conclusion).toBe(1);
    expect(summary.avg_comments_per_change_request).toBe(1.5);
    expect(summary.labels).toEqual([{ label: 'bug', change_requests: 2 }]);
    expect(summary.first_change_request?.number).toBe(1);
    expect(summary.last_change_request?.number).toBe(2);
    expect(summary.most_commented_change_request).toMatchObject({ number: 2, comments: 2 });
    expect(summary.top_commenter).toEqual({ login: 'reviewer', comments: 2 });
    expect(summary.time_to_first_comment_hours).toMatchObject({
      average: 3,
      median: 3,
      min: 2,
      max: 4,
      change_requests_with_comment: 2,
      change_requests_without_comment: 0,
    });
  });

  it('should get metrics by month', async () => {
    const januaryChangeRequest = new ChangeRequestBuilder()
      .withId(1)
      .withTitle('January change request')
      .withCreatedAt('2025-01-01T00:00:00Z')
      .withMergedAt('2025-01-03T00:00:00Z')
      .build();
    const februaryChangeRequest = new ChangeRequestBuilder()
      .withId(2)
      .withTitle('February change request')
      .withCreatedAt('2025-02-01T00:00:00Z')
      .withMergedAt('2025-02-04T00:00:00Z')
      .build();

    changeRequestsService = new ChangeRequestsService(
      new ReadChangeRequestsRepositoryBuilder()
        .withChangeRequests([januaryChangeRequest, februaryChangeRequest])
        .build(),
      new TimeZoneProvider('UTC'),
      logger
    );

    const metrics = await changeRequestsService.getMetricsByMonth();

    expect(metrics).toEqual([
      expect.objectContaining({ period: '2025-01', count: 1, openDays: 2 }),
      expect.objectContaining({ period: '2025-02', count: 1, openDays: 3 }),
    ]);
  });

  it('should get metrics by week', async () => {
    const firstChangeRequest = new ChangeRequestBuilder()
      .withId(1)
      .withTitle('First merged change request')
      .withCreatedAt('2025-01-01T00:00:00Z')
      .withMergedAt('2025-01-03T00:00:00Z')
      .build();
    const secondChangeRequest = new ChangeRequestBuilder()
      .withId(2)
      .withTitle('Second merged change request')
      .withCreatedAt('2025-01-06T00:00:00Z')
      .withMergedAt('2025-01-08T00:00:00Z')
      .build();

    changeRequestsService = new ChangeRequestsService(
      new ReadChangeRequestsRepositoryBuilder()
        .withChangeRequests([firstChangeRequest, secondChangeRequest])
        .build(),
      new TimeZoneProvider('UTC'),
      logger
    );

    const metrics = await changeRequestsService.getMetricsByWeek();

    expect(metrics).toEqual([
      // 2025-01-03 (Fri) is in ISO week 2025-W01 (the week containing Jan 4th);
      // 2025-01-08 (Wed) is in ISO week 2025-W02.
      expect.objectContaining({ period: '2025-W01', count: 1, openDays: 2 }),
      expect.objectContaining({ period: '2025-W02', count: 1, openDays: 2 }),
    ]);
  });

  it('should get label summaries', async () => {
    const enhancementChangeRequest = new ChangeRequestBuilder()
      .withId(1)
      .withTitle('Enhancement change request')
      .withCreatedAt('2025-01-01T00:00:00Z')
      .withMergedAt('2025-01-03T00:00:00Z')
      .withLabels([{ name: 'enhancement' }])
      .build();
    const bugfixChangeRequest = new ChangeRequestBuilder()
      .withId(2)
      .withTitle('Bugfix change request')
      .withCreatedAt('2025-01-02T00:00:00Z')
      .withClosedAt('2025-01-06T00:00:00Z')
      .withLabels([{ name: 'bugfix' }])
      .build();

    changeRequestsService = new ChangeRequestsService(
      new ReadChangeRequestsRepositoryBuilder()
        .withChangeRequests([enhancementChangeRequest, bugfixChangeRequest])
        .build(),
      new TimeZoneProvider('UTC'),
      logger
    );

    const labels = await changeRequestsService.getLabelSummaries();

    expect(labels).toEqual([
      { label: 'enhancement', count: 1, openDays: 2, outliers: undefined },
      { label: 'bugfix', count: 1, openDays: 4, outliers: undefined },
    ]);
  });

  it('should filter change requests by author', async () => {
    const aliceChangeRequest = new ChangeRequestBuilder()
      .withId(1)
      .withAuthor('Alice')
      .withCreatedAt('2025-01-01T00:00:00Z')
      .withMergedAt('2025-01-03T00:00:00Z')
      .withComments(5)
      .build();
    const loadChangeRequestsWithFilters = vi.fn().mockResolvedValue([aliceChangeRequest]);

    changeRequestsService = new ChangeRequestsService(
      { loadChangeRequestsWithFilters } as IReadChangeRequestsRepository,
      new TimeZoneProvider('UTC'),
      logger
    );

    const metrics = await changeRequestsService.getMetrics({
      authors: ['Alice'],
    });

    expect(loadChangeRequestsWithFilters).toHaveBeenCalledWith({ authors: ['Alice'] });
    expect(metrics.totalChangeRequests).toBe(1);
    expect(metrics.mergedChangeRequests).toBe(1);
    expect(metrics.openChangeRequests).toBe(0);
    expect(metrics.comments).toBe(5);
  });

  it('should filter change requests by state merged', async () => {
    const mergedChangeRequest = new ChangeRequestBuilder()
      .withId(1)
      .withCreatedAt('2025-01-01T00:00:00Z')
      .withMergedAt('2025-01-03T00:00:00Z')
      .build();
    const loadChangeRequestsWithFilters = vi.fn().mockResolvedValue([mergedChangeRequest]);

    changeRequestsService = new ChangeRequestsService(
      { loadChangeRequestsWithFilters } as IReadChangeRequestsRepository,
      new TimeZoneProvider('UTC'),
      logger
    );

    const metrics = await changeRequestsService.getMetrics({
      state: 'merged',
    });

    expect(loadChangeRequestsWithFilters).toHaveBeenCalledWith({ state: 'merged' });
    expect(metrics.totalChangeRequests).toBe(1);
    expect(metrics.mergedChangeRequests).toBe(1);
    expect(metrics.closedChangeRequests).toBe(0);
    expect(metrics.openChangeRequests).toBe(0);
    expect(metrics.openDays).toBe(2);
  });

  describe('getMetrics', () => {
    it('should exclude weekend change requests before calculating metrics when weekends filter is set to exclude', async () => {
      const saturdayChangeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Saturday change request')
        .withCreatedAt('2026-06-06T10:00:00Z')
        .build();
      const mondayChangeRequest = new ChangeRequestBuilder()
        .withId(2)
        .withTitle('Monday change request')
        .withCreatedAt('2026-06-08T10:00:00Z')
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder()
          .withChangeRequests([saturdayChangeRequest, mondayChangeRequest])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const includeMetrics = await changeRequestsService.getMetrics({
        cleaning: { weekends: 'include' },
      });
      const excludeMetrics = await changeRequestsService.getMetrics({
        cleaning: { weekends: 'exclude' },
      });
      const weekendsOnlyMetrics = await changeRequestsService.getMetrics({
        cleaning: { weekends: 'weekends_only' },
      });

      expect(includeMetrics.totalChangeRequests).toBe(2);
      expect(excludeMetrics.totalChangeRequests).toBe(1);
      expect(excludeMetrics.openChangeRequests).toBe(1);
      expect(weekendsOnlyMetrics.totalChangeRequests).toBe(1);
      expect(weekendsOnlyMetrics.openChangeRequests).toBe(1);
    });

    it('should classify open, closed-not-merged, and merged change requests and apply the totalComments fallback', async () => {
      const openChangeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Open change request')
        .build();
      const closedNotMergedChangeRequest = new ChangeRequestBuilder()
        .withId(2)
        .withTitle('Closed not merged')
        .withClosedAt('2025-01-05T00:00:00Z')
        .build();
      const mergedChangeRequest = new ChangeRequestBuilder()
        .withId(3)
        .withTitle('Merged change request')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withMergedAt('2025-01-02T00:00:00Z')
        .build();
      const changeRequestWithUndefinedTotalComments = new ChangeRequestBuilder()
        .withId(4)
        .withTitle('No comments field')
        .withComments([])
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder()
          .withChangeRequests([
            openChangeRequest,
            closedNotMergedChangeRequest,
            mergedChangeRequest,
            changeRequestWithUndefinedTotalComments,
          ])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const metrics = await changeRequestsService.getMetrics();

      expect(metrics.openChangeRequests).toBe(2);
      expect(metrics.closedChangeRequests).toBe(1);
      expect(metrics.mergedChangeRequests).toBe(1);
      expect(metrics.totalChangeRequests).toBe(4);
      expect(metrics.comments).toBe(0);
    });

    it('should exclude change requests with zero or negative totalComments from most_commented_change_requests', async () => {
      const zeroComments = new ChangeRequestBuilder().withId(1).withTitle('Zero comments').build();
      const negativeComments = new ChangeRequestBuilder()
        .withId(2)
        .withTitle('Negative comments')
        .withComments(-1)
        .build();
      const withComments = new ChangeRequestBuilder()
        .withId(3)
        .withTitle('Has comments')
        .withComments(3)
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder()
          .withChangeRequests([zeroComments, negativeComments, withComments])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const metrics = await changeRequestsService.getMetrics();

      expect(metrics.most_commented_change_requests).toHaveLength(1);
      expect(metrics.most_commented_change_requests[0].change_request_id).toBe(3);
    });

    it('should default averageOpenDays and averageComments to 0 for an empty change request list', async () => {
      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder().withChangeRequests([]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const metrics = await changeRequestsService.getMetrics();

      expect(metrics.totalChangeRequests).toBe(0);
      expect(metrics.openDays).toBe(0);
      expect(metrics.comments).toBe(0);
      expect(metrics.most_commented_change_requests).toEqual([]);
    });
  });

  describe('getMetricsByWeek', () => {
    it('should skip change requests with no mergedAt when grouping by week', async () => {
      const mergedChangeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Merged change request')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withMergedAt('2025-01-02T00:00:00Z')
        .build();
      const unmergedChangeRequest = new ChangeRequestBuilder()
        .withId(2)
        .withTitle('Unmerged change request')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder()
          .withChangeRequests([mergedChangeRequest, unmergedChangeRequest])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const weeks = await changeRequestsService.getMetricsByWeek();

      const totalCounted = weeks.reduce((sum, week) => sum + week.count, 0);
      expect(totalCounted).toBe(1);
    });

    it('should group two merged change requests into the same week bucket', async () => {
      const firstMergedChangeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('First merged change request')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withMergedAt('2025-01-02T00:00:00Z')
        .build();
      const secondMergedChangeRequest = new ChangeRequestBuilder()
        .withId(2)
        .withTitle('Second merged change request')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withMergedAt('2025-01-03T00:00:00Z')
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder()
          .withChangeRequests([firstMergedChangeRequest, secondMergedChangeRequest])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const weeks = await changeRequestsService.getMetricsByWeek();

      expect(weeks).toHaveLength(1);
      expect(weeks[0].count).toBe(2);
    });
  });

  describe('getLabelSummaries', () => {
    it('should fall back to an empty label list when a change request has no labels', async () => {
      const noLabelsChangeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('No labels')
        .withLabels(undefined)
        .build();
      const labeledChangeRequest = new ChangeRequestBuilder()
        .withId(2)
        .withTitle('Labeled')
        .withLabels([{ name: 'bug' }])
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder()
          .withChangeRequests([noLabelsChangeRequest, labeledChangeRequest])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const labels = await changeRequestsService.getLabelSummaries();

      expect(labels).toEqual([{ label: 'bug', count: 1, openDays: expect.any(Number) }]);
    });

    it('should use closedAt to compute open days for a closed-not-merged labeled change request', async () => {
      const closedNotMergedChangeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Closed not merged')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withClosedAt('2025-01-03T00:00:00Z')
        .withLabels([{ name: 'bug' }])
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder()
          .withChangeRequests([closedNotMergedChangeRequest])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const labels = await changeRequestsService.getLabelSummaries();

      expect(labels).toEqual([{ label: 'bug', count: 1, openDays: 2 }]);
    });

    it('should accumulate two change requests sharing the same label under one entry', async () => {
      const firstBugChangeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('First bug change request')
        .withLabels([{ name: 'bug' }])
        .build();
      const secondBugChangeRequest = new ChangeRequestBuilder()
        .withId(2)
        .withTitle('Second bug change request')
        .withLabels([{ name: 'bug' }])
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder()
          .withChangeRequests([firstBugChangeRequest, secondBugChangeRequest])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const labels = await changeRequestsService.getLabelSummaries();

      expect(labels).toEqual([{ label: 'bug', count: 2, openDays: expect.any(Number) }]);
    });
  });

  describe('getSummary', () => {
    it('should exclude change requests missing id, title, or url from most_commented_change_requests', async () => {
      const missingId = new ChangeRequestBuilder()
        .withId(undefined)
        .withTitle('Missing id')
        .withComments(5)
        .build();
      const missingTitle = new ChangeRequestBuilder()
        .withId(2)
        .withTitle(undefined)
        .withComments(4)
        .build();
      const missingUrl = new ChangeRequestBuilder()
        .withId(3)
        .withTitle('Missing url')
        .withComments(3)
        .withUrl(undefined)
        .build();
      const valid = new ChangeRequestBuilder()
        .withId(4)
        .withTitle('Valid change request')
        .withComments(1)
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder()
          .withChangeRequests([missingId, missingTitle, missingUrl, valid])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await changeRequestsService.getSummary()).result;

      expect(summary.most_commented_change_requests).toHaveLength(1);
      expect(summary.most_commented_change_requests[0].change_request_id).toBe(4);
    });

    it('should return null most_commented_change_request when the top change request by sort has zero comments', async () => {
      const noComments = new ChangeRequestBuilder().withId(1).withTitle('No comments').build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder().withChangeRequests([noComments]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await changeRequestsService.getSummary()).result;

      expect(summary.most_commented_change_request).toBeNull();
    });

    it('should return null first/last change request and top_commenter for an empty list', async () => {
      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder().withChangeRequests([]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await changeRequestsService.getSummary()).result;

      expect(summary.first_change_request).toBeNull();
      expect(summary.last_change_request).toBeNull();
      expect(summary.top_commenter).toBeNull();
      expect(summary.most_commented_change_request).toBeNull();
    });

    it('should break label-count ties alphabetically by label name', async () => {
      const changeRequestWithZebra = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Zebra labeled')
        .withLabels([{ name: 'zebra' }])
        .build();
      const changeRequestWithAlpha = new ChangeRequestBuilder()
        .withId(2)
        .withTitle('Alpha labeled')
        .withLabels([{ name: 'alpha' }])
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder()
          .withChangeRequests([changeRequestWithZebra, changeRequestWithAlpha])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await changeRequestsService.getSummary()).result;

      expect(summary.labels).toEqual([
        { label: 'alpha', change_requests: 1 },
        { label: 'zebra', change_requests: 1 },
      ]);
    });

    it('should fall back to an empty label list in the summary when a change request has no labels', async () => {
      const noLabelsChangeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('No labels')
        .withLabels(undefined)
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder()
          .withChangeRequests([noLabelsChangeRequest])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await changeRequestsService.getSummary()).result;

      expect(summary.labels).toEqual([]);
      expect(summary.unique_labels).toBe(0);
    });

    it('should fall back to an empty string for a label with no name', async () => {
      const changeRequestWithUnnamedLabel = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Unnamed label')
        .withLabels([{}])
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder()
          .withChangeRequests([changeRequestWithUnnamedLabel])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await changeRequestsService.getSummary()).result;

      expect(summary.labels).toEqual([]);
    });

    it('should break comment-count ties alphabetically by commenter login', async () => {
      const changeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Tied commenters')
        .withCommentDetails([
          { body: 'hi', author: { login: 'zoe', id: 1 } },
          { body: 'hi', author: { login: 'amy', id: 2 } },
        ])
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder().withChangeRequests([changeRequest]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await changeRequestsService.getSummary()).result;

      expect(summary.top_commenter).toEqual({ login: 'amy', comments: 1 });
    });
  });

  describe('getThroughTime', () => {
    it('should not record a Closed count for change requests with neither mergedAt nor closedAt', async () => {
      const openChangeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Still open')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder().withChangeRequests([openChangeRequest]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const rows = await changeRequestsService.getThroughTime();

      const closedRow = rows.find((row) => row.kind === 'Closed');
      expect(closedRow?.count).toBe(0);
      const openedRow = rows.find((row) => row.kind === 'Opened');
      expect(openedRow?.count).toBe(1);
    });

    it('should record a Closed count on the mergedAt period for a merged change request', async () => {
      const mergedChangeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Merged change request')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withMergedAt('2025-01-08T00:00:00Z')
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder().withChangeRequests([mergedChangeRequest]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const rows = await changeRequestsService.getThroughTime();

      const totalClosed = rows
        .filter((row) => row.kind === 'Closed')
        .reduce((sum, row) => sum + row.count, 0);
      expect(totalClosed).toBe(1);
    });

    it('should default to week aggregation when aggregateBy is omitted', async () => {
      const changeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Change request')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder().withChangeRequests([changeRequest]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const rows = await changeRequestsService.getThroughTime();

      expect(rows[0].date).toMatch(/^\d{4}-W\d{2}$/);
    });

    it('should aggregate by day when aggregateBy is "day"', async () => {
      const changeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Change request')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder().withChangeRequests([changeRequest]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const rows = await changeRequestsService.getThroughTime(undefined, 'day');

      expect(rows[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should aggregate by month when aggregateBy is "month"', async () => {
      const changeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Change request')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder().withChangeRequests([changeRequest]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const rows = await changeRequestsService.getThroughTime(undefined, 'month');

      expect(rows[0].date).toMatch(/^\d{4}-\d{2}$/);
    });

    it('should fall back to week aggregation for an invalid aggregateBy value', async () => {
      const changeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Change request')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder().withChangeRequests([changeRequest]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const rows = await changeRequestsService.getThroughTime(undefined, 'fortnight');

      expect(rows[0].date).toMatch(/^\d{4}-W\d{2}$/);
    });
  });

  describe('getByAuthor', () => {
    it('should default to top 10 when top is omitted, and respect an explicit top value', async () => {
      const changeRequests = Array.from({ length: 12 }, (_, i) =>
        new ChangeRequestBuilder()
          .withId(i + 1)
          .withTitle(`Change request ${i}`)
          .withAuthor(`author${i}`)
          .build()
      );

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder().withChangeRequests(changeRequests).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const defaultTop = await changeRequestsService.getByAuthor();
      const explicitTop = await changeRequestsService.getByAuthor(undefined, 3);

      expect(defaultTop).toHaveLength(10);
      expect(explicitTop).toHaveLength(3);
    });
  });

  describe('toTimestamp (via getAverageReviewTime)', () => {
    it('excludes change requests with unparseable createdAt dates from review time', async () => {
      const validChangeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Valid date')
        .withAuthor('alice')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withClosedAt('2025-01-03T00:00:00Z')
        .build();

      const invalidDateChangeRequest = new ChangeRequestBuilder()
        .withId(2)
        .withTitle('Invalid date')
        .withAuthor('alice')
        .withCreatedAt('not-a-real-date')
        .withClosedAt('2025-01-03T00:00:00Z')
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder()
          .withChangeRequests([validChangeRequest, invalidDateChangeRequest])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await changeRequestsService.getAverageReviewTime();

      expect(result).toHaveLength(1);
      expect(result[0].author).toBe('alice');
      expect(result[0].value).toBe(2);
    });
  });

  describe('getAverageReviewTime', () => {
    it('should use closedAt when mergedAt is absent, and mergedAt when both are present', async () => {
      const closedOnly = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Closed only')
        .withAuthor('alice')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withClosedAt('2025-01-03T00:00:00Z')
        .build();
      const mergedAndClosed = new ChangeRequestBuilder()
        .withId(2)
        .withTitle('Merged and closed')
        .withAuthor('bob')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withMergedAt('2025-01-02T00:00:00Z')
        .withClosedAt('2025-01-05T00:00:00Z')
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder()
          .withChangeRequests([closedOnly, mergedAndClosed])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await changeRequestsService.getAverageReviewTime();

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ author: 'alice', value: 2, method: 'average' }),
          expect.objectContaining({ author: 'bob', value: 1, method: 'average' }),
        ])
      );
    });

    it('should default to top 10 when top is omitted, and respect an explicit top value', async () => {
      const changeRequests = Array.from({ length: 12 }, (_, i) =>
        new ChangeRequestBuilder()
          .withId(i + 1)
          .withTitle(`Change request ${i}`)
          .withAuthor(`author${i}`)
          .withCreatedAt('2025-01-01T00:00:00Z')
          .withMergedAt('2025-01-02T00:00:00Z')
          .build()
      );

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder().withChangeRequests(changeRequests).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const defaultTop = await changeRequestsService.getAverageReviewTime();
      const explicitTop = await changeRequestsService.getAverageReviewTime(undefined, 3);

      expect(defaultTop).toHaveLength(10);
      expect(explicitTop).toHaveLength(3);
    });
  });

  describe('getAverageOpenBy', () => {
    it('should fall back to createdAt for the end timestamp when a change request has neither mergedAt nor closedAt', async () => {
      const stillOpenChangeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Still open')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder()
          .withChangeRequests([stillOpenChangeRequest])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await changeRequestsService.getAverageOpenBy();

      expect(result).toEqual([
        { period: expect.any(String), value: 0, method: 'average', outliers: undefined },
      ]);
    });

    it('should use closedAt when mergedAt is absent', async () => {
      const closedOnly = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Closed only')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withClosedAt('2025-01-03T00:00:00Z')
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder().withChangeRequests([closedOnly]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await changeRequestsService.getAverageOpenBy();

      expect(result).toEqual([
        { period: expect.any(String), value: 2, method: 'average', outliers: undefined },
      ]);
    });

    it('should aggregate by day when aggregateBy is "day"', async () => {
      const changeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Change request')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withMergedAt('2025-01-02T00:00:00Z')
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder().withChangeRequests([changeRequest]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await changeRequestsService.getAverageOpenBy(undefined, 'day');

      expect(result[0].period).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should sort multiple periods chronologically', async () => {
      const laterChangeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Later change request')
        .withCreatedAt('2025-02-01T00:00:00Z')
        .withMergedAt('2025-02-02T00:00:00Z')
        .build();
      const earlierChangeRequest = new ChangeRequestBuilder()
        .withId(2)
        .withTitle('Earlier change request')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withMergedAt('2025-01-02T00:00:00Z')
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder()
          .withChangeRequests([laterChangeRequest, earlierChangeRequest])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await changeRequestsService.getAverageOpenBy(undefined, 'month');

      expect(result.map((r) => r.period)).toEqual(['2025-01', '2025-02']);
    });
  });

  describe('extractTopThemes (via getSummary)', () => {
    it('should skip change requests with no comments and those whose comment bodies are empty/whitespace-only', async () => {
      const noCommentsChangeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('No comments')
        .build();
      const whitespaceOnlyChangeRequest = new ChangeRequestBuilder()
        .withId(2)
        .withTitle('Whitespace only')
        .withCommentDetails([{ body: '   ' }, { body: '' }])
        .build();
      const meaningfulChangeRequest = new ChangeRequestBuilder()
        .withId(3)
        .withTitle('Meaningful')
        .withCommentDetails([{ body: 'database migration database migration' }])
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder()
          .withChangeRequests([
            noCommentsChangeRequest,
            whitespaceOnlyChangeRequest,
            meaningfulChangeRequest,
          ])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await changeRequestsService.getSummary()).result;

      expect(summary.top_themes).toEqual(
        expect.arrayContaining([{ text: 'database migration', value: 2 }])
      );
    });

    it('should exclude short words (<3 chars) and numeric-only tokens from themes', async () => {
      const changeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Short and numeric tokens')
        .withCommentDetails([{ body: 'ok 42 cache cache cache' }])
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder().withChangeRequests([changeRequest]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await changeRequestsService.getSummary()).result;

      expect(summary.top_themes).toEqual(expect.arrayContaining([{ text: 'cache', value: 3 }]));
      expect(summary.top_themes.some((theme) => theme.text.includes('ok'))).toBe(false);
      expect(summary.top_themes.some((theme) => theme.text.includes('42'))).toBe(false);
    });
  });

  describe('calculateFirstCommentTimeSummary (via getSummary)', () => {
    it('should skip a change request whose first comment is timestamped before the change request was opened', async () => {
      const backdatedCommentChangeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Backdated comment')
        .withCreatedAt('2025-01-05T00:00:00Z')
        .withCommentDetails([{ body: 'too early', createdAt: '2025-01-01T00:00:00Z' }])
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder()
          .withChangeRequests([backdatedCommentChangeRequest])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await changeRequestsService.getSummary()).result;

      expect(summary.time_to_first_comment_hours.change_requests_with_comment).toBe(0);
      expect(summary.time_to_first_comment_hours.change_requests_without_comment).toBe(1);
    });

    it('should skip a change request with an empty createdAt (unparseable change-request-opened timestamp)', async () => {
      const noCreatedAtChangeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('No createdAt')
        .withCreatedAt('')
        .withCommentDetails([{ body: 'first', createdAt: '2025-01-01T01:00:00Z' }])
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder()
          .withChangeRequests([noCreatedAtChangeRequest])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await changeRequestsService.getSummary()).result;

      expect(summary.time_to_first_comment_hours.change_requests_with_comment).toBe(0);
      expect(summary.time_to_first_comment_hours.change_requests_without_comment).toBe(1);
    });

    it('should compute the odd-length median from a single change request with a comment', async () => {
      const changeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Single comment')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withCommentDetails([{ body: 'first', createdAt: '2025-01-01T05:00:00Z' }])
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder().withChangeRequests([changeRequest]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await changeRequestsService.getSummary()).result;

      expect(summary.time_to_first_comment_hours).toMatchObject({
        average: 5,
        median: 5,
        min: 5,
        max: 5,
        change_requests_with_comment: 1,
        change_requests_without_comment: 0,
      });
    });

    it('should compute the even-length median from two change requests with comments', async () => {
      const changeRequestA = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Change request A')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withCommentDetails([{ body: 'first', createdAt: '2025-01-01T02:00:00Z' }])
        .build();
      const changeRequestB = new ChangeRequestBuilder()
        .withId(2)
        .withTitle('Change request B')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withCommentDetails([{ body: 'first', createdAt: '2025-01-01T08:00:00Z' }])
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder()
          .withChangeRequests([changeRequestA, changeRequestB])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await changeRequestsService.getSummary()).result;

      expect(summary.time_to_first_comment_hours).toMatchObject({
        average: 5,
        median: 5,
        min: 2,
        max: 8,
        change_requests_with_comment: 2,
        change_requests_without_comment: 0,
      });
    });

    it('should default average and median to 0 when zero change requests have comments', async () => {
      const changeRequest = new ChangeRequestBuilder().withId(1).withTitle('No comments').build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder().withChangeRequests([changeRequest]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const summary = (await changeRequestsService.getSummary()).result;

      expect(summary.time_to_first_comment_hours.average).toBe(0);
      expect(summary.time_to_first_comment_hours.median).toBe(0);
    });
  });

  describe('getFirstCommentTime', () => {
    it('should skip a change request whose first comment is timestamped before the change request was opened', async () => {
      const backdatedCommentChangeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Backdated comment')
        .withAuthor('alice')
        .withCreatedAt('2025-01-05T00:00:00Z')
        .withCommentDetails([{ body: 'too early', createdAt: '2025-01-01T00:00:00Z' }])
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder()
          .withChangeRequests([backdatedCommentChangeRequest])
          .build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await changeRequestsService.getFirstCommentTime();

      expect(result).toEqual([]);
    });

    it('should group by author and respect the default and explicit top values', async () => {
      const changeRequests = Array.from({ length: 12 }, (_, i) =>
        new ChangeRequestBuilder()
          .withId(i + 1)
          .withTitle(`Change request ${i}`)
          .withAuthor(`author${i}`)
          .withCreatedAt('2025-01-01T00:00:00Z')
          .withCommentDetails([{ body: 'first', createdAt: '2025-01-01T01:00:00Z' }])
          .build()
      );

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder().withChangeRequests(changeRequests).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const defaultTop = await changeRequestsService.getFirstCommentTime();
      const explicitTop = await changeRequestsService.getFirstCommentTime(undefined, 3);

      expect(defaultTop).toHaveLength(10);
      expect(explicitTop).toHaveLength(3);
      expect(defaultTop[0]).toMatchObject({
        value: 1,
        change_requests_with_comments: 1,
        method: 'average',
      });
    });

    it('should pick the earliest comment as first when a change request has multiple comments', async () => {
      const changeRequest = new ChangeRequestBuilder()
        .withId(1)
        .withTitle('Multiple comments')
        .withAuthor('alice')
        .withCreatedAt('2025-01-01T00:00:00Z')
        .withCommentDetails([
          { body: 'later', createdAt: '2025-01-01T05:00:00Z' },
          { body: 'earlier', createdAt: '2025-01-01T01:00:00Z' },
        ])
        .build();

      changeRequestsService = new ChangeRequestsService(
        new ReadChangeRequestsRepositoryBuilder().withChangeRequests([changeRequest]).build(),
        new TimeZoneProvider('UTC'),
        logger
      );

      const result = await changeRequestsService.getFirstCommentTime();

      expect(result).toEqual([
        {
          author: 'alice',
          value: 1,
          change_requests_with_comments: 1,
          method: 'average',
          outliers: undefined,
        },
      ]);
    });
  });
});
