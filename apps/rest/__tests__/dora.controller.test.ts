import { describe, expect, it, vi } from 'vitest';
import { DeploymentFrequencyService } from '@smmachine/core';
import { TimeZoneProvider } from '@smmachine/core/infrastructure/timezone-provider';
import { Logger } from '@smmachine/utils';
import { DoraController } from '../src/controllers/dora.controller';

describe('DoraController', () => {
  function createController(runs: unknown[]) {
    const pipelinesRepo = {
      loadPipelines: vi.fn().mockResolvedValue(runs),
    };
    const deploymentService = new DeploymentFrequencyService(
      pipelinesRepo as never,
      [],
      new Logger('test'),
      new TimeZoneProvider('UTC')
    );
    const controller = new DoraController(deploymentService);

    return { controller, pipelinesRepo, deploymentService };
  }

  describe('deploymentFrequency', () => {
    it('delegates to the service and passes through its result', async () => {
      const { controller, deploymentService } = createController([]);
      const expected = [
        {
          pipeline: 'ci.yml',
          job: 'deploy',
          days: '2026-01-01',
          weeks: '2026-W01',
          months: '2026-01',
          daily_counts: 1,
          weekly_counts: 1,
          monthly_counts: 1,
          commits: '',
          links: '',
        },
      ];
      vi.spyOn(deploymentService, 'getDeploymentFrequencyWithAllIntervals').mockResolvedValue(
        expected
      );

      const result = await controller.deploymentFrequency({ workflow_path: 'ci.yml' });

      expect(deploymentService.getDeploymentFrequencyWithAllIntervals).toHaveBeenCalledWith(
        expect.objectContaining({ workflowPath: 'ci.yml' })
      );
      expect(result).toEqual(expected);
    });
  });
});
