import { describe, expect, it } from 'vitest';
import { createDefaultEngineeringHealthRegistry, EngineeringHealthRegistry } from '../registry';
import type { EngineeringHealthDependencies } from '../dependencies';
import type { Metric } from '../metric';

describe('engineering health registry', () => {
  it('registers and retrieves a metric', () => {
    const registry = new EngineeringHealthRegistry();
    const metric: Metric = {
      id: 'coverage',
      category: 'quality',
      calculate: async () => ({ value: 80, unit: '%', direction: 'higher_is_better' as const }),
      compare: () => ({
        trend: 'stable' as const,
        delta: 0,
        deltaPercentage: 0,
        current: 80,
        previous: 80,
        summary: 'stable',
      }),
      summarize: () => ({ title: 'coverage', valueLabel: '80%', notes: [] }),
      target: () => ({ operator: 'gte' as const, value: 80, description: 'Coverage target' }),
      recommendation: () => ({
        level: 'good' as const,
        summary: 'good',
        actions: ['keep it'],
      }),
    };

    registry.register(metric);

    expect(registry.get('coverage')).toBe(metric);
    expect(registry.list()).toHaveLength(1);
    expect(registry.listByCategory('quality')).toEqual([metric]);
  });

  it('throws when metric is missing', () => {
    const registry = new EngineeringHealthRegistry();

    expect(() => registry.get('coverage')).toThrow('Engineering health metric not found: coverage');
  });

  it('creates default registry with 14 existing metrics', () => {
    const dependencies = {} as EngineeringHealthDependencies;

    const registry = createDefaultEngineeringHealthRegistry(dependencies);

    expect(registry.list()).toHaveLength(14);
    expect(registry.listByCategory('delivery')).toHaveLength(4);
    expect(registry.listByCategory('quality')).toHaveLength(3);
    expect(registry.listByCategory('collaboration')).toHaveLength(4);
    expect(registry.listByCategory('architecture')).toHaveLength(3);

    expect(registry.get('deployment-frequency').id).toBe('deployment-frequency');
    expect(registry.get('lead-time').id).toBe('lead-time');
    expect(registry.get('pipeline-duration').id).toBe('pipeline-duration');
    expect(registry.get('failure-rate').id).toBe('failure-rate');
    expect(registry.get('complexity').id).toBe('complexity');
    expect(registry.get('duplication').id).toBe('duplication');
    expect(registry.get('coverage').id).toBe('coverage');
    expect(registry.get('review-time').id).toBe('review-time');
    expect(registry.get('review-participation').id).toBe('review-participation');
    expect(registry.get('pair-programming').id).toBe('pair-programming');
    expect(registry.get('knowledge-distribution').id).toBe('knowledge-distribution');
    expect(registry.get('coupling').id).toBe('coupling');
    expect(registry.get('ownership').id).toBe('ownership');
    expect(registry.get('components').id).toBe('components');
  });
});
