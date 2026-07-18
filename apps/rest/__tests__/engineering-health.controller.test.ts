import { describe, expect, it, vi } from 'vitest';
import { EngineeringHealthController } from '../src/controllers/engineering-health.controller';

describe('EngineeringHealthController', () => {
  it('maps query parameters to orchestrator evaluate input', async () => {
    const evaluate = vi.fn().mockResolvedValue({ generatedAt: '2026-07-18T00:00:00.000Z' });
    const controller = new EngineeringHealthController({ evaluate } as never);

    await controller.evaluate({
      metric: 'coverage,pipeline-duration',
      category: 'quality',
      start_date: '2026-07-01',
      end_date: '2026-07-31',
      compare_start_date: '2026-06-01',
      compare_end_date: '2026-06-30',
      raw_filters: 'status=success',
      period: 'month',
      weekends: 'exclude',
      outlier_mode: 'flag',
    });

    expect(evaluate).toHaveBeenCalledWith({
      metrics: ['coverage', 'pipeline-duration'],
      category: 'quality',
      current: {
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        rawFilters: 'status=success',
        period: 'month',
        weekends: 'exclude',
        outlierMode: 'flag',
      },
      previous: {
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        rawFilters: 'status=success',
        period: 'month',
        weekends: 'exclude',
        outlierMode: 'flag',
      },
    });
  });

  it('omits previous block when comparison dates are absent', async () => {
    const evaluate = vi.fn().mockResolvedValue({ generatedAt: '2026-07-18T00:00:00.000Z' });
    const controller = new EngineeringHealthController({ evaluate } as never);

    await controller.evaluate({
      metric: 'pipeline-duration',
      start_date: '2026-07-01',
      end_date: '2026-07-31',
      period: 'week',
    });

    expect(evaluate).toHaveBeenCalledWith({
      metrics: ['pipeline-duration'],
      category: undefined,
      current: {
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        rawFilters: undefined,
        period: 'week',
        weekends: undefined,
        outlierMode: undefined,
      },
      previous: undefined,
    });
  });
});
