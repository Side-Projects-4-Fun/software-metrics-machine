import { describe, it, expect } from 'vitest';
import { ChangeRequestEvaluationService } from '../change-request-evaluation-service';
import type { ChangeRequestDashboardData } from '../../change-request-evaluation-types';
import type { ChangeRequestSummary } from '../../change-request-types';

function makeSummary(overrides: Partial<ChangeRequestSummary> = {}): ChangeRequestSummary {
  return {
    total_change_requests: 50,
    merged_change_requests: 40,
    closed_change_requests: 5,
    change_requests_without_conclusion: 3,
    open_change_requests: 2,
    avg_comments_per_change_request: 3.2,
    unique_authors: 8,
    unique_labels: 5,
    labels: [],
    first_change_request: null,
    last_change_request: null,
    top_themes: [],
    most_commented_change_request: null,
    most_commented_change_requests: [],
    top_commenter: null,
    time_to_first_comment_hours: {
      average: 4.5,
      median: 3,
      min: 0.5,
      max: 24,
      change_requests_with_comment: 45,
      change_requests_without_comment: 5,
    },
    ...overrides,
  };
}

function makeData(overrides: Partial<ChangeRequestDashboardData> = {}): ChangeRequestDashboardData {
  return {
    summary: makeSummary(),
    reviewTime: [
      { author: 'alice', value: 0.5 },
      { author: 'bob', value: 1.2 },
      { author: 'charlie', value: 3.5 },
      { author: 'dave', value: 0.8 },
    ],
    openTime: [
      { period: '2025-01', value: 2.1, method: 'average' },
      { period: '2025-02', value: 2.3, method: 'average' },
      { period: '2025-03', value: 2.8, method: 'average' },
      { period: '2025-04', value: 4.5, method: 'average' },
    ],
    byAuthor: [
      { author: 'alice', count: 12 },
      { author: 'bob', count: 15 },
      { author: 'charlie', count: 8 },
    ],
    commentsByAuthor: [
      { author: 'reviewer-a', count: 45 },
      { author: 'reviewer-b', count: 20 },
      { author: 'reviewer-c', count: 15 },
    ],
    firstCommentTime: [
      { author: 'alice', value: 3, method: 'average', change_requests_with_comments: 10 },
      { author: 'charlie', value: 28, method: 'average', change_requests_with_comments: 7 },
    ],
    throughput: [
      { period: '2025-01', opened: 12, closed: 10 },
      { period: '2025-02', opened: 14, closed: 12 },
    ],
    ...overrides,
  };
}

describe('ChangeRequestEvaluationService', () => {
  const service = new ChangeRequestEvaluationService();

  describe('evaluate', () => {
    it('returns evaluation with generatedAt and signals', () => {
      const data = makeData();
      const result = service.evaluate(data);

      expect(result.generatedAt).toBeDefined();
      expect(new Date(result.generatedAt).getTime()).toBeGreaterThan(0);
      expect(Array.isArray(result.signals)).toBe(true);
      expect(result.signals.length).toBeGreaterThan(0);
    });

    it('builds summary with key metrics', () => {
      const data = makeData();
      const result = service.evaluate(data);

      expect(result.summary.totalChangeRequests).toBe(50);
      expect(result.summary.mergedChangeRequests).toBe(40);
      expect(result.summary.openChangeRequests).toBe(2);
      expect(result.summary.avgCommentsPerChangeRequest).toBe(3.2);
      expect(result.summary.uniqueAuthors).toBe(8);
      expect(result.summary.topReviewer).toBe('reviewer-a');
      expect(result.summary.bottleneckAuthor).toBe('bob');
    });
  });

  describe('review time', () => {
    it('flags slowest-reviewed author as critical when > 3 days', () => {
      const data = makeData();
      const result = service.evaluate(data);

      const signals = result.signals.filter((s) => s.id === 'review_time');
      expect(signals.length).toBeGreaterThan(0);
      expect(signals[0].severity).toBe('critical');
      expect(signals[0].title).toContain('charlie');
    });

    it('reports good when all authors have fast reviews', () => {
      const data = makeData({
        reviewTime: [
          { author: 'alice', value: 0.2 },
          { author: 'bob', value: 0.4 },
        ],
      });
      const result = service.evaluate(data);

      const signal = result.signals.find((s) => s.id === 'review_time');
      expect(signal!.severity).toBe('good');
      expect(signal!.title).toContain('healthy');
    });

    it('includes second author when multiple slow reviews exist', () => {
      const data = makeData({
        reviewTime: [
          { author: 'alice', value: 3.5 },
          { author: 'bob', value: 2.5 },
        ],
      });
      const result = service.evaluate(data);

      const second = result.signals.find((s) => s.id === 'review_time_second');
      expect(second).toBeDefined();
      expect(second!.title).toContain('bob');
    });
  });

  describe('reviewer workload', () => {
    it('flags reviewer dominating comments as critical', () => {
      const data = makeData({
        commentsByAuthor: [
          { author: 'reviewer-a', count: 80 },
          { author: 'reviewer-b', count: 5 },
        ],
      });
      const result = service.evaluate(data);

      const signal = result.signals.find((s) => s.id === 'reviewer_workload');
      expect(signal).toBeDefined();
      expect(signal!.severity).toBe('critical');
      expect(signal!.metrics.find((m) => m.label === 'Share')?.value).toContain('94');
    });

    it('reports good when workload is balanced', () => {
      const data = makeData({
        commentsByAuthor: [
          { author: 'a', count: 10 },
          { author: 'b', count: 9 },
          { author: 'c', count: 8 },
          { author: 'd', count: 7 },
        ],
      });
      const result = service.evaluate(data);

      const signal = result.signals.find((s) => s.id === 'reviewer_workload');
      expect(signal!.severity).toBe('good');
    });
  });

  describe('open time', () => {
    it('flags rising open time as warning', () => {
      const data = makeData({
        openTime: [
          { period: '2025-01', value: 2, method: 'average' },
          { period: '2025-02', value: 2.2, method: 'average' },
          { period: '2025-03', value: 5, method: 'average' },
          { period: '2025-04', value: 6, method: 'average' },
        ],
      });
      const result = service.evaluate(data);

      const signal = result.signals.find((s) => s.id === 'open_time');
      expect(signal).toBeDefined();
      expect(signal!.severity).toBe('warning');
    });

    it('reports good when open time is low and stable', () => {
      const data = makeData({
        openTime: [
          { period: '2025-03', value: 1.5, method: 'average' },
          { period: '2025-04', value: 1.3, method: 'average' },
        ],
      });
      const result = service.evaluate(data);

      const signal = result.signals.find((s) => s.id === 'open_time');
      expect(signal!.severity).toBe('good');
    });
  });

  describe('throughput', () => {
    it('flags growing backlog as critical', () => {
      const data = makeData({
        throughput: [
          { period: '2025-01', opened: 20, closed: 8 },
          { period: '2025-02', opened: 18, closed: 7 },
        ],
      });
      const result = service.evaluate(data);

      const signal = result.signals.find((s) => s.id === 'throughput');
      expect(signal).toBeDefined();
      expect(signal!.severity).toBe('critical');
    });

    it('reports good when balanced', () => {
      const data = makeData({
        throughput: [
          { period: '2025-01', opened: 10, closed: 10 },
          { period: '2025-02', opened: 12, closed: 11 },
        ],
      });
      const result = service.evaluate(data);

      const signal = result.signals.find((s) => s.id === 'throughput');
      expect(signal!.severity).toBe('good');
    });
  });

  describe('first comment time', () => {
    it('flags slow first response as critical', () => {
      const data = makeData({
        firstCommentTime: [
          { author: 'alice', value: 2, method: 'average', change_requests_with_comments: 10 },
          { author: 'bob', value: 48, method: 'average', change_requests_with_comments: 5 },
        ],
      });
      const result = service.evaluate(data);

      const signal = result.signals.find((s) => s.id === 'first_comment');
      expect(signal).toBeDefined();
      expect(signal!.severity).toBe('critical');
    });

    it('reports good when response is fast', () => {
      const data = makeData({
        firstCommentTime: [
          { author: 'alice', value: 2, method: 'average', change_requests_with_comments: 10 },
          { author: 'bob', value: 3, method: 'average', change_requests_with_comments: 8 },
        ],
      });
      const result = service.evaluate(data);

      const signal = result.signals.find((s) => s.id === 'first_comment');
      expect(signal!.severity).toBe('good');
    });
  });

  describe('comment health', () => {
    it('flags zero comments as critical', () => {
      const data = makeData({
        summary: makeSummary({ avg_comments_per_change_request: 0, total_change_requests: 10 }),
      });
      const result = service.evaluate(data);

      const signal = result.signals.find((s) => s.id === 'comment_health');
      expect(signal).toBeDefined();
      expect(signal!.severity).toBe('critical');
    });

    it('reports good with healthy comment count', () => {
      const data = makeData();
      const result = service.evaluate(data);

      const signal = result.signals.find((s) => s.id === 'comment_health');
      expect(signal!.severity).toBe('good');
    });
  });

  describe('empty data', () => {
    it('handles completely empty dashboard', () => {
      const data: ChangeRequestDashboardData = {
        summary: null,
        reviewTime: [],
        openTime: [],
        byAuthor: [],
        commentsByAuthor: [],
        firstCommentTime: [],
        throughput: [],
      };
      const result = service.evaluate(data);

      expect(result.signals.length).toBeGreaterThan(0);
      expect(result.summary.totalChangeRequests).toBe(0);
    });
  });
});
