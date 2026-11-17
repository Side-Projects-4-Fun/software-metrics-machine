import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { ComplexityMetric, CoverageMetric, DuplicationMetric } from '../adapters/quality';
import type { EngineeringHealthDependencies } from '../dependencies';
import type { EngineeringHealthMetricValue } from '../types';

/**
 * Property-based tests for the SonarQube quality adapters.
 *
 * Each adapter reduces a SonarQube measure payload to the numeric value of one
 * metric (complexity, coverage, or duplicated_lines_density). These properties
 * verify that each adapter looks up its correct metric key, parses numeric
 * string values, and reports null when the measure is absent.
 */

type QualityAdapter = ComplexityMetric | CoverageMetric | DuplicationMetric;

const ADAPTER_KEYS = {
  complexity: 'complexity',
  coverage: 'coverage',
  duplication: 'duplicated_lines_density',
} as const;

const NOISE_METRICS = fc.constantFrom(
  'bugs',
  'ncloc',
  'code_smells',
  'reliability_rating',
  'sqale_rating',
  'security_rating'
);

const kindArbitrary = fc.constantFrom('complexity', 'coverage', 'duplication');

function buildDependencies(payload: unknown): EngineeringHealthDependencies {
  return {
    deploymentTargets: [],
    pipelinesService: {} as never,
    deploymentFrequencyService: {} as never,
    pipelineImplementation: {} as never,
    changeRequestsService: {} as never,
    pairingService: {} as never,
    codemaatService: {} as never,
    sonarQubeService: { getQualityMetrics: vi.fn(async () => payload) } as never,
    architectureService: {} as never,
  } as EngineeringHealthDependencies;
}

function buildAdapter(kind: keyof typeof ADAPTER_KEYS, payload: unknown): QualityAdapter {
  const dependencies = buildDependencies(payload);
  if (kind === 'complexity') {
    return new ComplexityMetric(dependencies);
  }
  if (kind === 'coverage') {
    return new CoverageMetric(dependencies);
  }
  return new DuplicationMetric(dependencies);
}

function requireNumber(value: number | null): number {
  if (value === null) {
    throw new Error('expected a numeric metric value');
  }
  return value;
}

async function calculate(
  kind: keyof typeof ADAPTER_KEYS,
  payload: unknown
): Promise<EngineeringHealthMetricValue> {
  return buildAdapter(kind, payload).calculate({});
}

describe('SonarQube quality adapters — semantic oracles', () => {
  it('extracts the numeric value of its own metric from a payload with noise', async () => {
    await fc.assert(
      fc.asyncProperty(
        kindArbitrary,
        fc.integer({ min: 0, max: 1000 }),
        fc.array(fc.record({ metric: NOISE_METRICS, value: fc.integer({ min: 0, max: 1000 }) })),
        async (kind, targetValue, noise) => {
          const payload = {
            measures: [...noise, { metric: ADAPTER_KEYS[kind], value: targetValue }],
          };

          const result = await calculate(kind, payload);

          expect(requireNumber(result.value)).toBe(targetValue);
        }
      )
    );
  });

  it('parses a numeric string measure value', async () => {
    await fc.assert(
      fc.asyncProperty(
        kindArbitrary,
        fc.integer({ min: 0, max: 1000 }),
        async (kind, targetValue) => {
          const payload = {
            measures: [{ metric: ADAPTER_KEYS[kind], value: String(targetValue) }],
          };

          const result = await calculate(kind, payload);

          expect(requireNumber(result.value)).toBe(targetValue);
        }
      )
    );
  });

  it('reports null when its metric is absent', async () => {
    await fc.assert(
      fc.asyncProperty(
        kindArbitrary,
        fc.array(fc.record({ metric: NOISE_METRICS, value: fc.integer({ min: 0, max: 1000 }) })),
        async (kind, noise) => {
          const result = await calculate(kind, { measures: noise });

          expect(result.value).toBeNull();
        }
      )
    );
  });
});
