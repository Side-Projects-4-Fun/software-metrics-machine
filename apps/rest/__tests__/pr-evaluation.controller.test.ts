import { describe, it, expect, vi } from 'vitest';
import { PREvaluationController } from '../src/controllers/pr-evaluation.controller';
import type { PRsService } from '@smmachine/core';

function createMockPRsService() {
  return {
    getSummary: vi.fn().mockResolvedValue({
      total_prs: 50,
      merged_prs: 40,
      closed_prs: 5,
      prs_without_conclusion: 3,
      open_prs: 2,
      avg_comments_per_pr: 3.2,
      unique_authors: 8,
      unique_labels: 5,
      labels: [],
      first_pr: null,
      last_pr: null,
      top_themes: [],
      most_commented_pr: null,
      most_commented_prs: [],
      top_commenter: null,
      time_to_first_comment_hours: {
        average: 4,
        median: 3,
        min: 0.5,
        max: 24,
        prs_with_comment: 45,
        prs_without_comment: 5,
      },
    }),
    getReviewTime: vi.fn().mockResolvedValue({
      result: [
        { author: 'alice', avg_days: 0.5 },
        { author: 'bob', avg_days: 1.2 },
      ],
    }),
    getOpenTimeBy: vi
      .fn()
      .mockResolvedValue([{ period: '2025-01', avg_days: 2, method: 'average' }]),
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
      result: [{ author: 'alice', avg_hours: 3, prs_with_comments: 10 }],
    }),
    getThroughTime: vi.fn().mockResolvedValue([
      { period: '2025-01', count: 12, kind: 'Opened' },
      { period: '2025-01', count: 10, kind: 'Closed' },
    ]),
  } as unknown as PRsService;
}

function createController() {
  const mockPRsService = createMockPRsService();
  const controller = new PREvaluationController(mockPRsService);
  return { controller, mockPRsService };
}

describe('PREvaluationController', () => {
  describe('evaluate', () => {
    it('calls all PRsService methods with correct filters', async () => {
      const { controller, mockPRsService } = createController();

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

      expect(mockPRsService.getSummary).toHaveBeenCalled();
      expect(mockPRsService.getReviewTime).toHaveBeenCalled();
      expect(mockPRsService.getOpenTimeBy).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: '2025-01-01' }),
        'week',
        'median'
      );
      expect(mockPRsService.getByAuthor).toHaveBeenCalledWith(expect.anything(), 20);
      expect(mockPRsService.getCommentsByAuthor).toHaveBeenCalledWith(expect.anything(), 20);
      expect(mockPRsService.getFirstCommentTime).toHaveBeenCalledWith(
        expect.anything(),
        20,
        'median'
      );
      expect(mockPRsService.getThroughTime).toHaveBeenCalledWith(
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
      expect(result.summary.totalPRs).toBe(50);
    });

    it('passes default filter values when not provided', async () => {
      const { controller, mockPRsService } = createController();

      await controller.evaluate();

      expect(mockPRsService.getSummary).toHaveBeenCalledWith(
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
