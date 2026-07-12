import { Logger } from '@smmachine/utils';
import { PipelineFilters, PipelineRun } from '../pipeline-types';
import { TimeZoneProvider } from '../../../infrastructure';
import { PipelinesRepository } from '../repositories';
import { DeploymentFrequencyRow, DeploymentFrequencyTarget } from '../service';

export class DeploymentFrequencyService {
  private tz: TimeZoneProvider;

  constructor(
    private pipelineRepository: PipelinesRepository,
    private targets: DeploymentFrequencyTarget[],
    private logger: Logger,
    timeZoneProvider: TimeZoneProvider
  ) {
    this.tz = timeZoneProvider;
  }

  async getDeploymentFrequencyWithAllIntervals(
    filters?: PipelineFilters
  ): Promise<DeploymentFrequencyRow[]> {
    const targets = this.getDeploymentFrequencyTargets();

    if (targets.length === 0) {
      this.logger.warn(
        'Deployment frequency requested without deployment_frequency_targets configured'
      );
      return [];
    }

    const targetCounts = new Map<
      string,
      {
        target: DeploymentFrequencyTarget;
        dailyCounts: Map<string, number>;
        weeklyCounts: Map<string, number>;
        monthlyCounts: Map<string, number>;
      }
    >();
    const allDays = new Set<string>();
    let deploymentJobCount = 0;

    for (const target of targets) {
      const targetKey = `${target.pipeline}||${target.job}`;
      const counts = {
        target,
        dailyCounts: new Map<string, number>(),
        weeklyCounts: new Map<string, number>(),
        monthlyCounts: new Map<string, number>(),
      };

      const deployments = await this.filterRuns({
        ...filters,
        workflowPath: target.pipeline,
        jobName: target.job,
        jobConclusion: 'success',
        conclusion: 'success',
        status: 'completed',
      });

      const jobsOnly = deployments.flatMap((run) => run.jobs || []);
      deploymentJobCount += jobsOnly.length;

      for (const job of jobsOnly) {
        const timestamp = job.completedAt || job.startedAt;
        if (!timestamp) {
          continue;
        }

        const date = new Date(timestamp);
        const day = this.getIntervalKey(date, 'day');
        const week = this.getIntervalKey(date, 'week');
        const month = this.getIntervalKey(date, 'month');

        counts.dailyCounts.set(day, (counts.dailyCounts.get(day) || 0) + 1);
        counts.weeklyCounts.set(week, (counts.weeklyCounts.get(week) || 0) + 1);
        counts.monthlyCounts.set(month, (counts.monthlyCounts.get(month) || 0) + 1);
        allDays.add(day);
      }

      targetCounts.set(targetKey, counts);
    }

    this.logger.info(`Jobs only for deployment frequency calculation: ${deploymentJobCount}`);

    if (allDays.size === 0) {
      return [];
    }

    // Determine the start and end dates from the deployments
    const sortedDays = Array.from(allDays.keys()).sort();
    const firstDayStr = sortedDays[0];
    const lastDayStr = sortedDays[sortedDays.length - 1];

    const result: DeploymentFrequencyRow[] = [];
    const [startYear, startMonth, startDay] = firstDayStr.split('-').map(Number);
    const [endYear, endMonth, endDay] = lastDayStr.split('-').map(Number);

    // Use midday to avoid daylight saving time boundary issues when incrementing.
    const firstDate = new Date(Date.UTC(startYear, startMonth - 1, startDay, 12, 0, 0));
    const endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay, 12, 0, 0));

    for (const counts of targetCounts.values()) {
      const currentDate = new Date(firstDate);

      while (currentDate <= endDate) {
        const currentDayStr = this.getIntervalKey(currentDate, 'day');
        const currentWeekStr = this.getIntervalKey(currentDate, 'week');
        const currentMonthStr = this.getIntervalKey(currentDate, 'month');

        result.push({
          pipeline: counts.target.pipeline,
          job: counts.target.job,
          days: currentDayStr,
          weeks: currentWeekStr,
          months: currentMonthStr,
          daily_counts: counts.dailyCounts.get(currentDayStr) || 0,
          weekly_counts: counts.weeklyCounts.get(currentWeekStr) || 0,
          monthly_counts: counts.monthlyCounts.get(currentMonthStr) || 0,
          commits: '',
          links: '',
        });

        // Move to the next day
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }
    }

    return result;
  }

  private getIntervalKey(date: Date, interval: 'day' | 'week' | 'month'): string {
    if (interval === 'day') {
      return this.tz.getDateKey(date);
    } else if (interval === 'week') {
      return this.tz.getWeekKey(date);
    } else {
      return this.tz.getMonthKey(date);
    }
  }

  private async filterRuns(filters?: PipelineFilters): Promise<PipelineRun[]> {
    return await this.pipelineRepository.loadPipelines({
      includeJobs: true,
      startDate: filters?.startDate,
      endDate: filters?.endDate,
      weekends: filters?.cleaning?.weekends,
      targetBranch: filters?.targetBranch,
      event: filters?.event,
      workflowPath: filters?.workflowPath,
      status: filters?.status,
      conclusion: filters?.conclusion,
      jobName: filters?.jobName,
      jobConclusion: filters?.jobConclusion,
      rawFilters: filters?.rawFilters,
    });
  }

  private getDeploymentFrequencyTargets(): DeploymentFrequencyTarget[] {
    return this.targets;
  }
}
