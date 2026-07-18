import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { commands } from '../../src';

vi.mock('@smmachine/core', async () => {
  const actual = await vi.importActual<typeof import('@smmachine/core')>('@smmachine/core');
  return {
    ...actual,
    createEngineeringHealthOrchestrator: vi.fn(),
  };
});

import { createEngineeringHealthOrchestrator } from '@smmachine/core';

describe('cli: Engineering Health Commands', () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let evaluateMock: ReturnType<typeof vi.fn>;

  const getOutput = () =>
    consoleSpy.mock.calls
      .flat()
      .filter((value: unknown): value is string => typeof value === 'string')
      .join('\n');

  beforeEach(() => {
    vi.stubEnv('SMM_STORE_DATA_AT', '/tmp');
    vi.stubEnv('OWNER_REPO_GIT_PROVIDER', 'github');
    vi.stubEnv('OWNER_REPO_GITHUB_TOKEN', 'fake-token');
    vi.stubEnv('OWNER_REPO_GIT_REPOSITORY_PATH', '/tmp/repo');

    evaluateMock = vi.fn().mockResolvedValue({
      generatedAt: '2026-07-18T10:00:00.000Z',
      evaluations: [
        {
          id: 'coverage',
          category: 'quality',
          value: {
            value: 82,
            unit: '%',
            direction: 'higher_is_better',
          },
          comparison: {
            trend: 'improving',
            delta: 3,
            deltaPercentage: 3.8,
            current: 82,
            previous: 79,
            summary: 'Metric improved by 3.00 %.',
          },
          summary: {
            title: 'coverage',
            valueLabel: '82.00 %',
            notes: ['Metric improved by 3.00 %.'],
          },
          target: {
            operator: 'gte',
            value: 80,
            description: 'Coverage at or above eighty percent.',
          },
          recommendation: {
            level: 'good',
            summary: 'Metric is within target range.',
            actions: ['Keep current practices and continue monitoring trend stability.'],
          },
        },
      ],
    });

    vi.mocked(createEngineeringHealthOrchestrator).mockReturnValue({
      evaluate: evaluateMock,
      evaluateMetric: vi.fn(),
    } as never);

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    program = commands();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('forwards options to engineering health orchestrator evaluate', async () => {
    await program.parseAsync(
      [
        'engineering-health',
        'evaluate',
        '--metric',
        'coverage,failure-rate',
        '--category',
        'quality',
        '--start-date',
        '2026-07-01',
        '--end-date',
        '2026-07-31',
        '--compare-start-date',
        '2026-06-01',
        '--compare-end-date',
        '2026-06-30',
        '--period',
        'month',
        '--weekends',
        'exclude',
        '--outlier-mode',
        'flag',
        '--raw-filters',
        'status=success',
      ],
      { from: 'user' }
    );

    expect(evaluateMock).toHaveBeenCalledWith({
      metrics: ['coverage', 'failure-rate'],
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

  it('prints engineering health summary in text output', async () => {
    await program.parseAsync(['engineering-health', 'evaluate'], { from: 'user' });

    const output = getOutput();

    expect(output).toContain('=== Engineering Health ===');
    expect(output).toContain('Generated at: 2026-07-18T10:00:00.000Z');
    expect(output).toContain('Metric: coverage (quality)');
    expect(output).toContain('Value: 82.00 %');
    expect(output).toContain('Recommendation: Metric is within target range.');
  });

  it('prints json output when requested', async () => {
    await program.parseAsync(['engineering-health', 'evaluate', '--output', 'json'], {
      from: 'user',
    });

    const output = getOutput();

    expect(output).toContain('"generatedAt": "2026-07-18T10:00:00.000Z"');
    expect(output).toContain('"id": "coverage"');
  });

  it('prints deployment target information for target-scoped delivery evaluations', async () => {
    evaluateMock.mockResolvedValueOnce({
      generatedAt: '2026-07-18T10:00:00.000Z',
      evaluations: [
        {
          id: 'pipeline-duration',
          category: 'delivery',
          scope: {
            type: 'deployment-target',
            key: '.github/workflows/release.yml||deploy-production',
            label: 'deploy-production (.github/workflows/release.yml)',
            deploymentTarget: {
              pipeline: '.github/workflows/release.yml',
              job: 'deploy-production',
            },
          },
          value: {
            value: 14,
            unit: 'minutes',
            direction: 'lower_is_better',
          },
          comparison: {
            trend: 'unknown',
            delta: null,
            deltaPercentage: null,
            current: 14,
            previous: null,
            summary: 'Insufficient data to compare periods.',
          },
          summary: {
            title: 'pipeline-duration',
            valueLabel: '14.00 minutes',
            notes: ['Insufficient data to compare periods.'],
          },
          target: {
            operator: 'lt',
            value: 10,
            description: 'Average pipeline duration below ten minutes.',
          },
          recommendation: {
            level: 'critical',
            summary: 'Metric is outside target and needs attention.',
            actions: ['Investigate root causes and define a short-term corrective action plan.'],
          },
        },
      ],
    });

    await program.parseAsync(['engineering-health', 'evaluate'], { from: 'user' });

    const output = getOutput();

    expect(output).toContain('Metric: pipeline-duration (delivery)');
    expect(output).toContain(
      'Deployment target: deploy-production (.github/workflows/release.yml)'
    );
  });
});
