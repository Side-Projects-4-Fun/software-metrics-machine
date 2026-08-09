import { describe, expect, it, vi } from 'vitest';
import { ReviewParticipationMetric, ReviewTimeMetric } from '../adapters/collaboration';
import type { EngineeringHealthDependencies } from '../dependencies';

describe('collaboration engineering health metrics', () => {
  it('forwards changeRequestLabels to review time change request filters', async () => {
    const getReviewTime = vi.fn().mockResolvedValue([
      { author: 'alice', value: 1.5, method: 'average' as const },
      { author: 'bob', value: 0.5, method: 'average' as const },
    ]);

    const metric = new ReviewTimeMetric({
      changeRequestsService: { getReviewTime } as never,
      pipelinesService: {} as never,
      deploymentFrequencyService: {} as never,
      pipelineImplementation: {} as never,
      deploymentTargets: [],
      pairingService: {} as never,
      codemaatService: {} as never,
      sonarQubeService: {} as never,
      architectureService: {} as never,
    } as EngineeringHealthDependencies);

    await metric.calculate({
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      changeRequestLabels: ['bug', 'frontend'],
      top: 10,
    });

    expect(getReviewTime).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        labels: ['bug', 'frontend'],
      }),
      10,
      'average'
    );
  });

  it('forwards changeRequestLabels to review participation change request filters', async () => {
    const getCommentsByAuthor = vi.fn().mockResolvedValue([
      { author: 'alice', count: 3 },
      { author: 'bob', count: 2 },
    ]);

    const metric = new ReviewParticipationMetric({
      changeRequestsService: { getCommentsByAuthor } as never,
      pipelinesService: {} as never,
      deploymentFrequencyService: {} as never,
      pipelineImplementation: {} as never,
      deploymentTargets: [],
      pairingService: {} as never,
      codemaatService: {} as never,
      sonarQubeService: {} as never,
      architectureService: {} as never,
    } as EngineeringHealthDependencies);

    await metric.calculate({
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      changeRequestLabels: ['bug'],
      top: 5,
    });

    expect(getCommentsByAuthor).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        labels: ['bug'],
      }),
      5
    );
  });
});
