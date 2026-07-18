import { describe, expect, it } from 'vitest';
import type { Metric } from '../metric';
import { EngineeringHealthOrchestrator } from '../orchestrator';
import { EngineeringHealthRegistry } from '../registry';

function buildMetric(): Metric {
  return {
    id: 'coverage',
    category: 'quality',
    async calculate(input) {
      if (input?.startDate === '2025-01-01') {
        return {
          value: 75,
          unit: '%',
          direction: 'higher_is_better',
        };
      }

      return {
        value: 80,
        unit: '%',
        direction: 'higher_is_better',
      };
    },
    compare(current, previous) {
      return {
        trend: 'improving',
        delta: (current.value || 0) - (previous?.value || 0),
        deltaPercentage: 6.66,
        current: current.value,
        previous: previous?.value || null,
        summary: 'coverage improved',
      };
    },
    summarize(value) {
      return {
        title: 'coverage',
        valueLabel: `${value.value}%`,
        notes: ['summary'],
      };
    },
    target() {
      return {
        operator: 'gte',
        value: 80,
        description: 'keep coverage high',
      };
    },
    recommendation() {
      return {
        level: 'good',
        summary: 'keep going',
        actions: ['keep tests healthy'],
      };
    },
  };
}

describe('engineering health orchestrator', () => {
  it('evaluates selected metrics with current and previous windows', async () => {
    const registry = new EngineeringHealthRegistry();
    registry.register(buildMetric());

    const orchestrator = new EngineeringHealthOrchestrator(registry);

    const result = await orchestrator.evaluate({
      metrics: ['coverage'],
      current: {
        startDate: '2026-01-01',
      },
      previous: {
        startDate: '2025-01-01',
      },
    });

    expect(result.generatedAt).toBeTypeOf('string');
    expect(result.evaluations).toHaveLength(1);
    expect(result.evaluations[0].id).toBe('coverage');
    expect(result.evaluations[0].category).toBe('quality');
    expect(result.evaluations[0].value.value).toBe(80);
    expect(result.evaluations[0].comparison.previous).toBe(75);
    expect(result.evaluations[0].comparison.delta).toBe(5);
    expect(result.evaluations[0].summary.valueLabel).toBe('80%');
    expect(result.evaluations[0].target.value).toBe(80);
    expect(result.evaluations[0].recommendation.level).toBe('good');
  });

  it('evaluates a single metric by id', async () => {
    const registry = new EngineeringHealthRegistry();
    registry.register(buildMetric());

    const orchestrator = new EngineeringHealthOrchestrator(registry);

    const result = await orchestrator.evaluateMetric('coverage', {
      current: {
        startDate: '2026-01-01',
      },
      previous: {
        startDate: '2025-01-01',
      },
    });

    expect(result.id).toBe('coverage');
    expect(result.value.value).toBe(80);
    expect(result.comparison.previous).toBe(75);
    expect(result.comparison.delta).toBe(5);
  });
});
