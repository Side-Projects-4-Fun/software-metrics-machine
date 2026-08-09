import { describe, it, expect, vi } from 'vitest';
import { ChangeRequestEvaluationController } from '../src/controllers/change-request-evaluation.controller';
import type { ChangeRequestsService } from '@smmachine/core';

function createMockChangeRequestsService() {
  return {
    getSummary: vi.fn().mockResolvedValue({
      total_change_requests: 50,
      merged_change_requests: 40,
      closed_change_requests: 5,
      change_requests_without_conclusion: 3,
      open_change_requests: 2,
      comments_per_change_request: 3.2,
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
        average: 4,
        median: 3,
        min: 0.5,
        max: 24,
        change_requests_with_comment: 45,
        change_requests_without_comment: 5,
      },
    }),
    getReviewTime: vi.fn().mockResolvedValue({
      result: [
        { author: 'alice', value: 0.5, method: 'average' },
        { author: 'bob', value: 1.2, method: 'average' },
      ],
    }),
    getOpenTimeBy: vi.fn().mockResolvedValue([{ period: '2025-01', value: 2, method: 'average' }]),
    getByAuthor: vi.fn().mockResolvedValue({
      result: [
        { author: 'alice', count: 12 },
        { author: 'bob', count: 15 },
      ],
    }),
    getCommentsByAuthor: vi.fn().mockResolvedValue({
      result: [
        { author: 'reviewer-a', count: 45 },
        { author: 'reviewer-b', count: 20 },
      ],
    }),
    getFirstCommentTime: vi.fn().mockResolvedValue({
      result: [{ author: 'alice', value: 3, method: 'average', change_requests_with_comments: 10 }],
    }),
    getThroughTime: vi.fn().mockResolvedValue([
      { period: '2025-01', count: 12, kind: 'Opened' },
      { period: '2025-01', count: 10, kind: 'Closed' },
    ]),
  } as unknown as ChangeRequestsService;
}

function createController() {
  const mockChangeRequestsService = createMockChangeRequestsService();
  const controller = new ChangeRequestEvaluationController(mockChangeRequestsService);
  return { controller, mockChangeRequestsService };
}

describe('ChangeRequestEvaluationController', () => {
  describe('evaluate', () => {
    it('calls all ChangeRequestsService methods with correct filters', async () => {
      const { controller, mockChangeRequestsService } = createController();

      await controller.evaluate(
        '2025-01-01',
        '2025-01-31',
        'alice,bob',
        undefined,
        undefined,
        'bug',
        'open',
        'exclude',
        undefined,
        'median',
        'week'
      );

      expect(mockChangeRequestsService.getSummary).toHaveBeenCalled();
      expect(mockChangeRequestsService.getReviewTime).toHaveBeenCalled();
      expect(mockChangeRequestsService.getOpenTimeBy).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: '2025-01-01' }),
        'week',
        'median'
      );
      expect(mockChangeRequestsService.getByAuthor).toHaveBeenCalledWith(expect.anything(), 20);
      expect(mockChangeRequestsService.getCommentsByAuthor).toHaveBeenCalledWith(
        expect.anything(),
        20
      );
      expect(mockChangeRequestsService.getFirstCommentTime).toHaveBeenCalledWith(
        expect.anything(),
        20,
        'median'
      );
      expect(mockChangeRequestsService.getThroughTime).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: '2025-01-01' }),
        'week'
      );
    });

    it('returns evaluation with signals and summary', async () => {
      const { controller } = createController();
      const result = await controller.evaluate();

      expect(result).toBeDefined();
      expect(result.generatedAt).toBeDefined();
      expect(Array.isArray(result.signals)).toBe(true);
      expect(result.signals.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.summary.totalChangeRequests).toBe(50);
    });

    it('passes default filter values when not provided', async () => {
      const { controller, mockChangeRequestsService } = createController();

      await controller.evaluate();

      expect(mockChangeRequestsService.getSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          cleaning: expect.objectContaining({
            weekends: 'include',
            outlierMode: 'include',
          }),
        })
      );
    });
  });
});
