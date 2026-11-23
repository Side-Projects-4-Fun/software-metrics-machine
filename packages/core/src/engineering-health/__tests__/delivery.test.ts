import { describe, expect, it, vi } from 'vitest';
import {
  DeploymentFrequencyMetric,
  LeadTimeMetric,
  PipelineDurationMetric,
} from '../adapters/delivery';
import type { EngineeringHealthDependencies } from '../dependencies';

function buildDependencies(): EngineeringHealthDependencies {
  return {
    deploymentTargets: [
      {
        pipeline: '.github/workflows/release.yml',
        job: 'deploy-production',
      },
      {
        pipeline: '.github/workflows/mobile.yml',
        job: 'deploy-mobile',
      },
    ],
    pipelinesService: {
      getMetrics: vi.fn(async (filters) => {
        if (filters?.jobName === 'deploy-production') {
          return {
            totalRuns: 3,
            successfulRuns: 3,
            failedRuns: 0,
            successRate: 100,
            value: 14,
            outliers: [],
          };
        }

        return {
          totalRuns: 2,
          successfulRuns: 1,
          failedRuns: 1,
          successRate: 50,
          value: 9,
          outliers: [],
        };
      }),
    } as never,
    deploymentFrequencyService: {
      getDeploymentFrequencyWithAllIntervals: vi.fn(async (filters) => {
        if (filters?.jobName === 'deploy-production') {
          return [
            {
              pipeline: '.github/workflows/release.yml',
              job: 'deploy-production',
              days: '2026-07-01',
              weeks: '2026-W27',
              months: '2026-07',
              daily_counts: 2,
              weekly_counts: 3,
              monthly_counts: 3,
              commits: '',
              links: '',
            },
          ];
        }

        return [
          {
            pipeline: '.github/workflows/mobile.yml',
            job: 'deploy-mobile',
            days: '2026-07-01',
            weeks: '2026-W27',
            months: '2026-07',
            daily_counts: 1,
            weekly_counts: 1,
            monthly_counts: 1,
            commits: '',
            links: '',
          },
        ];
      }),
    } as never,
    pipelineImplementation: {
      dashboard: vi.fn(),
      getLeadTime: vi.fn(async (filters) => {
        if (filters?.jobName === 'deploy-production') {
          return [
            {
              pipeline: '.github/workflows/release.yml',
              job: 'deploy-production',
              value: 45,
              method: 'average',
              count: 2,
            },
          ];
        }

        return [
          {
            pipeline: '.github/workflows/mobile.yml',
            job: 'deploy-mobile',
            value: 90,
            method: 'average',
            count: 1,
          },
        ];
      }),
    } as never,
    changeRequestsService: {} as never,
    pairingService: {} as never,
    codemaatService: {} as never,
    sonarQubeService: {} as never,
    architectureService: {} as never,
  };
}

describe('delivery engineering health metrics', () => {
  it('expands pipeline duration into one evaluation per deployment target', async () => {
    const dependencies = buildDependencies();
    const metric = new PipelineDurationMetric(dependencies);

    const evaluations = await metric.evaluate({
      current: {
        startDate: '2026-07-01',
        endDate: '2026-07-31',
      },
    });

    expect(evaluations).toHaveLength(2);
    expect(evaluations[0].scope?.deploymentTarget).toEqual({
      pipeline: '.github/workflows/release.yml',
      job: 'deploy-production',
    });
    expect(evaluations[0].value.value).toBe(14);
    expect(evaluations[1].scope?.deploymentTarget).toEqual({
      pipeline: '.github/workflows/mobile.yml',
      job: 'deploy-mobile',
    });
    expect(evaluations[1].value.value).toBe(9);
    expect(dependencies.pipelinesService.getMetrics).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        workflowPath: '.github/workflows/release.yml',
        jobName: 'deploy-production',
      })
    );
    expect(dependencies.pipelinesService.getMetrics).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        workflowPath: '.github/workflows/mobile.yml',
        jobName: 'deploy-mobile',
      })
    );
  });

  it('keeps deployment frequency results separated by deployment target', async () => {
    const dependencies = buildDependencies();
    const metric = new DeploymentFrequencyMetric(dependencies);

    const evaluations = await metric.evaluate({
      current: {
        period: 'week',
      },
    });

    expect(evaluations).toHaveLength(2);
    expect(evaluations[0].value.value).toBe(3);
    expect(evaluations[0].scope?.label).toContain('deploy-production');
    expect(evaluations[1].value.value).toBe(1);
    expect(evaluations[1].scope?.label).toContain('deploy-mobile');
    expect(
      dependencies.deploymentFrequencyService.getDeploymentFrequencyWithAllIntervals
    ).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        workflowPath: '.github/workflows/release.yml',
        jobName: 'deploy-production',
      })
    );
    expect(
      dependencies.deploymentFrequencyService.getDeploymentFrequencyWithAllIntervals
    ).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        workflowPath: '.github/workflows/mobile.yml',
        jobName: 'deploy-mobile',
      })
    );
  });

  it('computes lead time per deployment target from commit to deploy', async () => {
    const dependencies = buildDependencies();
    const metric = new LeadTimeMetric(dependencies);

    const evaluations = await metric.evaluate({
      current: {
        startDate: '2026-07-01',
        endDate: '2026-07-31',
      },
    });

    expect(evaluations).toHaveLength(2);
    expect(evaluations[0].scope?.deploymentTarget).toEqual({
      pipeline: '.github/workflows/release.yml',
      job: 'deploy-production',
    });
    expect(evaluations[0].value.value).toBe(45);
    expect(evaluations[0].value.sampleSize).toBe(2);
    expect(evaluations[1].scope?.deploymentTarget).toEqual({
      pipeline: '.github/workflows/mobile.yml',
      job: 'deploy-mobile',
    });
    expect(evaluations[1].value.value).toBe(90);
    expect(dependencies.pipelineImplementation.getLeadTime).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        workflowPath: '.github/workflows/release.yml',
        jobName: 'deploy-production',
      })
    );
    expect(dependencies.pipelineImplementation.getLeadTime).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        workflowPath: '.github/workflows/mobile.yml',
        jobName: 'deploy-mobile',
      })
    );
  });

  it('returns null lead time value when no successful deployments exist', async () => {
    const dependencies = buildDependencies();
    dependencies.pipelineImplementation.getLeadTime = vi.fn(async () => []);
    const metric = new LeadTimeMetric(dependencies);

    const result = await metric.calculate({});

    expect(result.value).toBeNull();
    expect(result.unit).toBe('minutes');
  });
});
