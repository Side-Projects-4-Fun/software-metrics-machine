import { describe, expect, it, vi } from 'vitest';
import { PullRequestsController } from '../src/controllers/pull-requests.controller';
import type { PRsService } from '@smmachine/core';

const createMockPRsService = (methods: Partial<PRsService> = {}): PRsService =>
  ({
    getSummary: vi.fn(),
    getThroughTime: vi.fn(),
    getByAuthor: vi.fn(),
    getAverageReviewTime: vi.fn(),
    getAverageOpenBy: vi.fn(),
    getMetrics: vi.fn(),
    getCommentsByAuthor: vi.fn(),
    getFirstCommentTime: vi.fn(),
    ...methods,
  }) as PRsService;

const createMockPullRequestFiltersRepository = () => ({
  loadOptions: vi.fn().mockResolvedValue({ authors: [], labels: [] }),
});

const createController = (prsService?: Partial<PRsService>) => {
  const mockPrsService = createMockPRsService(prsService);
  const pullRequestFiltersRepository = createMockPullRequestFiltersRepository();

  return {
    controller: new PullRequestsController(mockPrsService, pullRequestFiltersRepository as any),
    mockPrsService,
    pullRequestFiltersRepository,
  };
};

describe('PullRequestsController', () => {
  it('should return labels with number of PRs associated', async () => {
    const { controller } = createController({
      getSummary: vi.fn().mockResolvedValue({
        result: {
          labels: [
            { label: 'dependencies', prs: 2 },
            { label: 'javascript', prs: 2 },
          ],
        },
      }),
    });

    const response = await controller.summary();

    expect(response.result.labels).toEqual([
      { label: 'dependencies', prs: 2 },
      { label: 'javascript', prs: 2 },
    ]);
  });

  it('aggregates PRs through time by day', async () => {
    const { controller } = createController({
      getThroughTime: vi.fn().mockResolvedValue([
        { date: '2026-01-05', kind: 'Opened', count: 2 },
        { date: '2026-01-05', kind: 'Closed', count: 0 },
        { date: '2026-01-06', kind: 'Opened', count: 0 },
        { date: '2026-01-06', kind: 'Closed', count: 1 },
        { date: '2026-01-12', kind: 'Opened', count: 0 },
        { date: '2026-01-12', kind: 'Closed', count: 1 },
      ]),
    });

    const response = await controller.throughTime(undefined, undefined, 'day');

    expect(response.result).toEqual([
      { date: '2026-01-05', kind: 'Opened', count: 2 },
      { date: '2026-01-05', kind: 'Closed', count: 0 },
      { date: '2026-01-06', kind: 'Opened', count: 0 },
      { date: '2026-01-06', kind: 'Closed', count: 1 },
      { date: '2026-01-12', kind: 'Opened', count: 0 },
      { date: '2026-01-12', kind: 'Closed', count: 1 },
    ]);
  });

  it('aggregates PRs through time by month', async () => {
    const { controller } = createController({
      getThroughTime: vi.fn().mockResolvedValue([
        { date: '2026-01', kind: 'Opened', count: 2 },
        { date: '2026-01', kind: 'Closed', count: 1 },
        { date: '2026-02', kind: 'Opened', count: 0 },
        { date: '2026-02', kind: 'Closed', count: 1 },
      ]),
    });

    const response = await controller.throughTime(undefined, undefined, 'month');

    expect(response.result).toEqual([
      { date: '2026-01', kind: 'Opened', count: 2 },
      { date: '2026-01', kind: 'Closed', count: 1 },
      { date: '2026-02', kind: 'Opened', count: 0 },
      { date: '2026-02', kind: 'Closed', count: 1 },
    ]);
  });

  it('aggregates average open days by day', async () => {
    const { controller, mockPrsService } = createController({
      getAverageOpenBy: vi.fn().mockResolvedValue([{ period: '2026-01-05', avg_days: 1.5 }]),
    });

    const response = await controller.averageOpenBy(undefined, undefined, 'day');

    expect(response).toEqual([{ period: '2026-01-05', avg_days: 1.5 }]);
    expect(mockPrsService.getAverageOpenBy).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: undefined, endDate: undefined }),
      'day'
    );
  });

  describe('byAuthor', () => {
    it('uses the explicit top value when provided', async () => {
      const { controller, mockPrsService } = createController({
        getByAuthor: vi.fn().mockResolvedValue([{ author: 'alice', count: 5 }]),
      });

      const response = await controller.byAuthor(undefined, undefined, undefined, '3');

      expect(response.result).toEqual([{ author: 'alice', count: 5 }]);
      expect(mockPrsService.getByAuthor).toHaveBeenCalledWith(expect.anything(), 3);
    });

    it('defaults top to 10 when omitted', async () => {
      const { controller, mockPrsService } = createController({
        getByAuthor: vi.fn().mockResolvedValue([]),
      });

      await controller.byAuthor(undefined, undefined, undefined, undefined);

      expect(mockPrsService.getByAuthor).toHaveBeenCalledWith(expect.anything(), 10);
    });

    it('falls back to 10 when top is non-numeric', async () => {
      const { controller, mockPrsService } = createController({
        getByAuthor: vi.fn().mockResolvedValue([]),
      });

      await controller.byAuthor(undefined, undefined, undefined, 'not-a-number');

      expect(mockPrsService.getByAuthor).toHaveBeenCalledWith(expect.anything(), 10);
    });
  });

  describe('averageReviewTime', () => {
    it('uses the explicit top value when provided', async () => {
      const { controller, mockPrsService } = createController({
        getAverageReviewTime: vi.fn().mockResolvedValue([{ author: 'bob', avg_days: 1.2 }]),
      });

      const response = await controller.averageReviewTime(undefined, undefined, undefined, '4');

      expect(response.result).toEqual([{ author: 'bob', avg_days: 1.2 }]);
      expect(mockPrsService.getAverageReviewTime).toHaveBeenCalledWith(expect.anything(), 4);
    });

    it('defaults top to 10 when omitted', async () => {
      const { controller, mockPrsService } = createController({
        getAverageReviewTime: vi.fn().mockResolvedValue([]),
      });

      await controller.averageReviewTime(undefined, undefined, undefined, undefined);

      expect(mockPrsService.getAverageReviewTime).toHaveBeenCalledWith(expect.anything(), 10);
    });

    it('falls back to 10 when top is non-numeric', async () => {
      const { controller, mockPrsService } = createController({
        getAverageReviewTime: vi.fn().mockResolvedValue([]),
      });

      await controller.averageReviewTime(undefined, undefined, undefined, 'nope');

      expect(mockPrsService.getAverageReviewTime).toHaveBeenCalledWith(expect.anything(), 10);
    });
  });

  describe('averageComments', () => {
    it('returns avg_comments from service metrics', async () => {
      const { controller, mockPrsService } = createController({
        getMetrics: vi.fn().mockResolvedValue({ averageComments: 3.5 }),
      });

      const response = await controller.averageComments();

      expect(response).toEqual({ avg_comments: 3.5 });
      expect(mockPrsService.getMetrics).toHaveBeenCalledWith(expect.anything());
    });
  });

  describe('commentsByAuthor', () => {
    it('uses the explicit top value when provided', async () => {
      const { controller, mockPrsService } = createController({
        getCommentsByAuthor: vi.fn().mockResolvedValue([{ author: 'carol', count: 7 }]),
      });

      const response = await controller.commentsByAuthor(undefined, undefined, undefined, '5');

      expect(response.result).toEqual([{ author: 'carol', count: 7 }]);
      expect(mockPrsService.getCommentsByAuthor).toHaveBeenCalledWith(expect.anything(), 5);
    });

    it('defaults top to 10 when omitted', async () => {
      const { controller, mockPrsService } = createController({
        getCommentsByAuthor: vi.fn().mockResolvedValue([]),
      });

      await controller.commentsByAuthor(undefined, undefined, undefined, undefined);

      expect(mockPrsService.getCommentsByAuthor).toHaveBeenCalledWith(expect.anything(), 10);
    });

    it('falls back to 10 when top is non-numeric', async () => {
      const { controller, mockPrsService } = createController({
        getCommentsByAuthor: vi.fn().mockResolvedValue([]),
      });

      await controller.commentsByAuthor(undefined, undefined, undefined, 'bogus');

      expect(mockPrsService.getCommentsByAuthor).toHaveBeenCalledWith(expect.anything(), 10);
    });
  });

  describe('firstCommentTime', () => {
    it('uses the explicit top value when provided', async () => {
      const { controller, mockPrsService } = createController({
        getFirstCommentTime: vi
          .fn()
          .mockResolvedValue([{ author: 'dave', avg_hours: 2.5, prs_with_comments: 4 }]),
      });

      const response = await controller.firstCommentTime(undefined, undefined, undefined, '6');

      expect(response.result).toEqual([{ author: 'dave', avg_hours: 2.5, prs_with_comments: 4 }]);
      expect(mockPrsService.getFirstCommentTime).toHaveBeenCalledWith(expect.anything(), 6);
    });

    it('defaults top to 10 when omitted', async () => {
      const { controller, mockPrsService } = createController({
        getFirstCommentTime: vi.fn().mockResolvedValue([]),
      });

      await controller.firstCommentTime(undefined, undefined, undefined, undefined);

      expect(mockPrsService.getFirstCommentTime).toHaveBeenCalledWith(expect.anything(), 10);
    });

    it('falls back to 10 when top is non-numeric', async () => {
      const { controller, mockPrsService } = createController({
        getFirstCommentTime: vi.fn().mockResolvedValue([]),
      });

      await controller.firstCommentTime(undefined, undefined, undefined, 'NaN-ish');

      expect(mockPrsService.getFirstCommentTime).toHaveBeenCalledWith(expect.anything(), 10);
    });
  });

  describe('filterOptions', () => {
    it('delegates to pullRequestFiltersRepository.loadOptions without wrapping', async () => {
      const { controller, pullRequestFiltersRepository } = createController();

      const response = await controller.filterOptions();

      expect(pullRequestFiltersRepository.loadOptions).toHaveBeenCalled();

      expect(response).toEqual({ authors: [], labels: [] });
    });
  });

  describe('toFilters mapping', () => {
    it('maps query params to PRFilters, renaming status to state', async () => {
      const { controller, mockPrsService } = createController({
        getByAuthor: vi.fn().mockResolvedValue([]),
      });

      await controller.byAuthor(
        undefined,
        undefined,
        'feature',
        '10',
        'alice,bob',
        'carol',
        'dave',
        'open'
      );

      expect(mockPrsService.getByAuthor).toHaveBeenCalledWith(
        expect.objectContaining({
          authors: 'alice,bob',
          excludeAuthors: 'carol',
          excludeCommenters: 'dave',
          labels: 'feature',
          state: 'open',
        }),
        10
      );
    });
  });
});
