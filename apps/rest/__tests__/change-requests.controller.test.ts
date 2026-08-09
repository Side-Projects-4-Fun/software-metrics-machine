import { describe, expect, it, vi } from 'vitest';
import { ChangeRequestsController } from '../src/controllers/change-requests.controller';
import type { ChangeRequestsService } from '@smmachine/core';

const createMockChangeRequestsService = (
  methods: Partial<ChangeRequestsService> = {}
): ChangeRequestsService =>
  ({
    getSummary: vi.fn(),
    getThroughTime: vi.fn(),
    getByAuthor: vi.fn(),
    getReviewTime: vi.fn(),
    getOpenTimeBy: vi.fn(),
    getMetrics: vi.fn(),
    getCommentsByAuthor: vi.fn(),
    getFirstCommentTime: vi.fn(),
    ...methods,
  }) as ChangeRequestsService;

const createMockChangeRequestFiltersRepository = () => ({
  loadOptions: vi.fn().mockResolvedValue({ authors: [], labels: [] }),
});

const createController = (changeRequestsService?: Partial<ChangeRequestsService>) => {
  const mockChangeRequestsService = createMockChangeRequestsService(changeRequestsService);
  const changeRequestFiltersRepository = createMockChangeRequestFiltersRepository();

  return {
    controller: new ChangeRequestsController(
      mockChangeRequestsService,
      changeRequestFiltersRepository as any
    ),
    mockChangeRequestsService,
    changeRequestFiltersRepository,
  };
};

describe('ChangeRequestsController', () => {
  it('should return labels with number of change requests associated', async () => {
    const { controller } = createController({
      getSummary: vi.fn().mockResolvedValue({
        result: {
          labels: [
            { label: 'dependencies', change_requests: 2 },
            { label: 'javascript', change_requests: 2 },
          ],
        },
      }),
    });

    const response = await controller.summary();

    expect(response.result.labels).toEqual([
      { label: 'dependencies', change_requests: 2 },
      { label: 'javascript', change_requests: 2 },
    ]);
  });

  it('aggregates change requests through time by day', async () => {
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

  it('aggregates change requests through time by month', async () => {
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
    const { controller, mockChangeRequestsService } = createController({
      getOpenTimeBy: vi
        .fn()
        .mockResolvedValue([{ period: '2026-01-05', value: 1.5, method: 'average' }]),
    });

    const response = await controller.averageOpenBy(undefined, undefined, 'day');

    expect(response).toEqual([
      { period: '2026-01-05', value: 1.5, value_formatted: '1d 12h', method: 'average' },
    ]);
    expect(mockChangeRequestsService.getOpenTimeBy).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: undefined, endDate: undefined }),
      'day',
      'average'
    );
  });

  describe('byAuthor', () => {
    it('uses the explicit top value when provided', async () => {
      const { controller, mockChangeRequestsService } = createController({
        getByAuthor: vi.fn().mockResolvedValue([{ author: 'alice', count: 5 }]),
      });

      const response = await controller.byAuthor(undefined, undefined, undefined, '3');

      expect(response.result).toEqual([{ author: 'alice', count: 5 }]);
      expect(mockChangeRequestsService.getByAuthor).toHaveBeenCalledWith(expect.anything(), 3);
    });

    it('defaults top to 10 when omitted', async () => {
      const { controller, mockChangeRequestsService } = createController({
        getByAuthor: vi.fn().mockResolvedValue([]),
      });

      await controller.byAuthor(undefined, undefined, undefined, undefined);

      expect(mockChangeRequestsService.getByAuthor).toHaveBeenCalledWith(expect.anything(), 10);
    });

    it('falls back to 10 when top is non-numeric', async () => {
      const { controller, mockChangeRequestsService } = createController({
        getByAuthor: vi.fn().mockResolvedValue([]),
      });

      await controller.byAuthor(undefined, undefined, undefined, 'not-a-number');

      expect(mockChangeRequestsService.getByAuthor).toHaveBeenCalledWith(expect.anything(), 10);
    });
  });

  describe('averageReviewTime', () => {
    it('uses the explicit top value when provided', async () => {
      const { controller, mockChangeRequestsService } = createController({
        getReviewTime: vi
          .fn()
          .mockResolvedValue([{ author: 'bob', value: 1.2, method: 'average' }]),
      });

      const response = await controller.averageReviewTime(undefined, undefined, undefined, '4');

      expect(response.result).toEqual([
        {
          author: 'bob',
          value: 1.2,
          value_formatted: '1d 4h',
          method: 'average',
        },
      ]);
      expect(mockChangeRequestsService.getReviewTime).toHaveBeenCalledWith(
        expect.anything(),
        4,
        'average'
      );
    });

    it('defaults top to 10 when omitted', async () => {
      const { controller, mockChangeRequestsService } = createController({
        getReviewTime: vi.fn().mockResolvedValue([]),
      });

      await controller.averageReviewTime(undefined, undefined, undefined, undefined);

      expect(mockChangeRequestsService.getReviewTime).toHaveBeenCalledWith(
        expect.anything(),
        10,
        'average'
      );
    });

    it('falls back to 10 when top is non-numeric', async () => {
      const { controller, mockChangeRequestsService } = createController({
        getReviewTime: vi.fn().mockResolvedValue([]),
      });

      await controller.averageReviewTime(undefined, undefined, undefined, 'nope');

      expect(mockChangeRequestsService.getReviewTime).toHaveBeenCalledWith(
        expect.anything(),
        10,
        'average'
      );
    });
  });

  describe('averageComments', () => {
    it('returns avg_comments from service metrics', async () => {
      const { controller, mockChangeRequestsService } = createController({
        getMetrics: vi.fn().mockResolvedValue({ comments: 3.5 }),
      });

      const response = await controller.averageComments();

      expect(response).toEqual({ avg_comments: 3.5 });
      expect(mockChangeRequestsService.getMetrics).toHaveBeenCalledWith(
        expect.anything(),
        'average'
      );
    });
  });

  describe('commentsByAuthor', () => {
    it('uses the explicit top value when provided', async () => {
      const { controller, mockChangeRequestsService } = createController({
        getCommentsByAuthor: vi.fn().mockResolvedValue([{ author: 'carol', count: 7 }]),
      });

      const response = await controller.commentsByAuthor(undefined, undefined, undefined, '5');

      expect(response.result).toEqual([{ author: 'carol', count: 7 }]);
      expect(mockChangeRequestsService.getCommentsByAuthor).toHaveBeenCalledWith(
        expect.anything(),
        5
      );
    });

    it('defaults top to 10 when omitted', async () => {
      const { controller, mockChangeRequestsService } = createController({
        getCommentsByAuthor: vi.fn().mockResolvedValue([]),
      });

      await controller.commentsByAuthor(undefined, undefined, undefined, undefined);

      expect(mockChangeRequestsService.getCommentsByAuthor).toHaveBeenCalledWith(
        expect.anything(),
        10
      );
    });

    it('falls back to 10 when top is non-numeric', async () => {
      const { controller, mockChangeRequestsService } = createController({
        getCommentsByAuthor: vi.fn().mockResolvedValue([]),
      });

      await controller.commentsByAuthor(undefined, undefined, undefined, 'bogus');

      expect(mockChangeRequestsService.getCommentsByAuthor).toHaveBeenCalledWith(
        expect.anything(),
        10
      );
    });
  });

  describe('firstCommentTime', () => {
    it('uses the explicit top value when provided', async () => {
      const { controller, mockChangeRequestsService } = createController({
        getFirstCommentTime: vi
          .fn()
          .mockResolvedValue([
            { author: 'dave', value: 2.5, method: 'average', change_requests_with_comments: 4 },
          ]),
      });

      const response = await controller.firstCommentTime(undefined, undefined, undefined, '6');

      expect(response.result).toEqual([
        {
          author: 'dave',
          value: 2.5,
          value_formatted: '2h 30m',
          method: 'average',
          change_requests_with_comments: 4,
        },
      ]);
      expect(mockChangeRequestsService.getFirstCommentTime).toHaveBeenCalledWith(
        expect.anything(),
        6,
        'average'
      );
    });

    it('defaults top to 10 when omitted', async () => {
      const { controller, mockChangeRequestsService } = createController({
        getFirstCommentTime: vi.fn().mockResolvedValue([]),
      });

      await controller.firstCommentTime(undefined, undefined, undefined, undefined);

      expect(mockChangeRequestsService.getFirstCommentTime).toHaveBeenCalledWith(
        expect.anything(),
        10,
        'average'
      );
    });

    it('falls back to 10 when top is non-numeric', async () => {
      const { controller, mockChangeRequestsService } = createController({
        getFirstCommentTime: vi.fn().mockResolvedValue([]),
      });

      await controller.firstCommentTime(undefined, undefined, undefined, 'NaN-ish');

      expect(mockChangeRequestsService.getFirstCommentTime).toHaveBeenCalledWith(
        expect.anything(),
        10,
        'average'
      );
    });
  });

  describe('filterOptions', () => {
    it('delegates to changeRequestFiltersRepository.loadOptions without wrapping', async () => {
      const { controller, changeRequestFiltersRepository } = createController();

      const response = await controller.filterOptions();

      expect(changeRequestFiltersRepository.loadOptions).toHaveBeenCalled();

      expect(response).toEqual({ authors: [], labels: [] });
    });
  });

  describe('toFilters mapping', () => {
    it('maps query params to ChangeRequestFilters, renaming status to state', async () => {
      const { controller, mockChangeRequestsService } = createController({
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

      expect(mockChangeRequestsService.getByAuthor).toHaveBeenCalledWith(
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
