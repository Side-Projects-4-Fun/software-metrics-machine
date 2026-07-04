import type { SmmCommand } from './smm-command';
import {
  parseMetricCleaningOptions,
  PipelinesService,
  type PipelineFilters,
} from '@smmachine/core';
import PipelineFactory from '@smmachine/core/factories/pipeline-factory';
import { TimeZoneProvider } from '@smmachine/core/infrastructure/timezone-provider';

function createPipelineDependencies(command: SmmCommand) {
  const config = command.getConfiguration();
  const logger = command.getLogger('PipelinesCommand');
  const timeZoneProvider = new TimeZoneProvider(config.timezone);
  const { pipelineRepository, workflowRepository, workflowJobRepository } = PipelineFactory.create(
    config,
    logger,
    timeZoneProvider
  );
  const pipelineService = new PipelinesService(
    pipelineRepository,
    config,
    logger,
    timeZoneProvider
  );
  return { config, pipelineRepository, workflowRepository, workflowJobRepository, pipelineService };
}

type DeploymentFrequencyInterval = Awaited<
  ReturnType<PipelinesService['getDeploymentFrequencyWithAllIntervals']>
>[number];
type JobStepAverageTime = Awaited<ReturnType<PipelinesService['getJobStepsAverageTime']>>[number];

function buildPipelineFilters(options: {
  startDate?: string;
  endDate?: string;
  workflow?: string;
  job?: string;
  rawFilters?: string;
  weekends?: string;
  outlierMode?: string;
}): PipelineFilters {
  return {
    startDate: options.startDate,
    endDate: options.endDate,
    workflowPath: options.workflow,
    jobName: options.job,
    rawFilters: options.rawFilters,
    cleaning: parseMetricCleaningOptions({
      weekends: options.weekends,
      outlierMode: options.outlierMode,
    }),
  };
}

type CliOutlier = {
  value: number;
  timestamp: string;
  lowerBound: number;
  upperBound: number;
  item?: {
    runId?: string;
    workflowName?: string;
    jobName?: string;
    stepName?: string;
  };
};

function formatOutlierLine(outlier: CliOutlier): string {
  const item = outlier.item;
  const identity = item
    ? [item.workflowName, item.jobName, item.stepName, item.runId ? `run ${item.runId}` : undefined]
        .filter(Boolean)
        .join(' | ')
    : 'unknown item';
  return `    - ${identity}: ${outlier.value.toFixed(2)} (${outlier.timestamp}, bounds ${outlier.lowerBound.toFixed(2)} - ${outlier.upperBound.toFixed(2)})`;
}

function printOutliers(screen: ReturnType<SmmCommand['getScreen']>, outliers?: CliOutlier[]): void {
  if (!outliers || outliers.length === 0) {
    return;
  }

  screen.printLine(`Outliers: ${outliers.length}`);
  for (const outlier of outliers.slice(0, 10)) {
    screen.printLine(formatOutlierLine(outlier));
  }
  if (outliers.length > 10) {
    screen.printLine(`    ...and ${outliers.length - 10} more`);
  }
}

export function createPipelinesCommands(program: SmmCommand): void {
  const pipelinesGroup = program
    .subcommand('pipelines')
    .description('Pipeline/workflow operations');
  const screen = program.getScreen();

  pipelinesGroup
    .subcommand('fetch')
    .description('Fetch pipeline runs from the configured Git provider')
    .option('--force', 'Force re-fetching pipelines even if already fetched', false)
    .option(
      '--update',
      'Incrementally update pipelines — fetch only newer items and merge with existing cache'
    )
    .option('--start-date <date>', 'Filter runs created on or after this date (ISO 8601)')
    .option('--end-date <date>', 'Filter runs created on or before this date (ISO 8601)')
    .option('--raw-filters <filters>', 'Raw filters (e.g., status=success,branch=main)')
    .option('--by-day', 'Fetch workflows day by day instead of all at once', false)
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('PipelinesCommand');
      try {
        screen.printLine('🔄 Fetching pipeline runs from the configured Git provider...');
        const { workflowRepository } = createPipelineDependencies(command);

        await workflowRepository.fetchPipelines({
          forceRefresh: options.force,
          startDate: options.startDate,
          endDate: options.endDate,
          rawFilters: options.rawFilters,
          byDay: options.byDay,
          incrementalUpdate: options.update,
        });

        screen.printLine('✅ Fetch pipeline data has been completed and stored on disk');
      } catch (error) {
        logger.error('Failed to fetch pipeline runs', error);
        process.exit(1);
      }
    });

  pipelinesGroup
    .subcommand('fetch-jobs')
    .description('Fetch pipeline jobs from the configured Git provider')
    .option('--force', 'Force re-fetching jobs even if already fetched')
    .option(
      '--update',
      'Incrementally update jobs — fetch only newer items and merge with existing cache'
    )
    .option('--run-start-date <date>', 'Filter pipelines created on or after this date')
    .option('--run-end-date <date>', 'Filter pipelines created on or before this date')
    .option('--raw-filters <filters>', 'Raw filters (e.g., status=success,branch=main)')
    .option('--by-day', 'Fetch jobs day by day instead of all at once', false)
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('PipelinesCommand');
      try {
        screen.printLine('🔄 Fetching pipeline jobs from the configured Git provider...');
        const { workflowJobRepository } = createPipelineDependencies(command);

        await workflowJobRepository.fetchJobs({
          forceRefresh: options.force,
          startDate: options.runStartDate,
          endDate: options.runEndDate,
          rawFilters: options.rawFilters,
          byDay: options.byDay,
          incrementalUpdate: options.update,
        });

        screen.printLine('✅ Fetch pipeline jobs has been completed and stored on disk');
      } catch (error) {
        logger.error('Failed to fetch pipeline jobs', error);
        process.exit(1);
      }
    });

  pipelinesGroup
    .subcommand('summary')
    .description('Display a summary of pipeline runs')
    .option('--max-workflows <number>', 'Maximum number of workflows to list', '10')
    .option('--start-date <date>', 'Start date (inclusive) in YYYY-MM-DD')
    .option('--end-date <date>', 'End date (inclusive) in YYYY-MM-DD')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .option('--raw-filters <filters>', 'Raw Provider filters string')
    .option(
      '--weekends <mode>',
      'Weekend handling for averages: include, exclude, or weekends_only',
      'include'
    )
    .option(
      '--outlier-mode <mode>',
      'Outlier handling for averages: include, flag, or exclude',
      'include'
    )
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('PipelinesCommand');
      try {
        screen.printLine('📊 Generating pipeline summary...');
        const { pipelineService } = createPipelineDependencies(command);

        const metrics = await pipelineService.getMetrics(buildPipelineFilters(options));

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(metrics, null, 2));
        } else {
          screen.printLine('\n=== Pipeline Summary ===\n');
          screen.printLine(`Total Runs: ${metrics.totalRuns}`);
          screen.printLine(`Successful Runs: ${metrics.successfulRuns}`);
          screen.printLine(`Failed Runs: ${metrics.failedRuns}`);
          screen.printLine(`Success Rate: ${(metrics.successRate * 100).toFixed(1)}%`);
          screen.printLine(
            `Average Duration: ${metrics.averageDurationMinutes.toFixed(2)} minutes`
          );
          printOutliers(screen, metrics.outliers);
        }
      } catch (error) {
        logger.error('Failed to generate pipeline summary', error);
        process.exit(1);
      }
    });

  pipelinesGroup
    .subcommand('by-status')
    .description('View pipeline runs grouped by status')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--raw-filters <filters>', 'Raw Provider filters string')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('PipelinesCommand');
      try {
        screen.printLine('📊 Analyzing pipelines by status...');
        const { pipelineService } = createPipelineDependencies(command);

        const metrics = await pipelineService.getMetrics(buildPipelineFilters(options));

        if (options.output === 'json') {
          screen.printLine(
            JSON.stringify(
              {
                successful: metrics.successfulRuns,
                failed: metrics.failedRuns,
                total: metrics.totalRuns,
              },
              null,
              2
            )
          );
        } else {
          screen.printLine('\n=== Pipelines by Status ===\n');
          screen.printLine(`✅ Successful: ${metrics.successfulRuns}`);
          screen.printLine(`❌ Failed: ${metrics.failedRuns}`);
          screen.printLine(`📊 Total: ${metrics.totalRuns}`);
        }
      } catch (error) {
        logger.error('Failed to analyze pipelines by status', error);
        process.exit(1);
      }
    });

  pipelinesGroup
    .subcommand('runs-duration')
    .description('View pipeline run durations')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--workflow <name>', 'Filter by workflow name')
    .option('--raw-filters <filters>', 'Raw Provider filters string')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .option(
      '--weekends <mode>',
      'Weekend handling for averages: include, exclude, or weekends_only',
      'include'
    )
    .option(
      '--outlier-mode <mode>',
      'Outlier handling for averages: include, flag, or exclude',
      'include'
    )
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('PipelinesCommand');
      try {
        screen.printLine('⏱️  Analyzing pipeline run durations...');
        const { pipelineService } = createPipelineDependencies(command);

        const metrics = await pipelineService.getMetrics(buildPipelineFilters(options));

        if (options.output === 'json') {
          screen.printLine(
            JSON.stringify({ averageDuration: metrics.averageDurationMinutes }, null, 2)
          );
        } else {
          screen.printLine('\n=== Pipeline Run Durations ===\n');
          if (options.workflow) {
            screen.printLine(`Workflow: ${options.workflow}`);
          }
          screen.printLine(
            `Average Duration: ${metrics.averageDurationMinutes.toFixed(2)} minutes`
          );
          screen.printLine(`Total Runs: ${metrics.totalRuns}`);
          printOutliers(screen, metrics.outliers);
        }
      } catch (error) {
        logger.error('Failed to analyze pipeline run durations', error);
        process.exit(1);
      }
    });

  pipelinesGroup
    .subcommand('runs-by')
    .description('View pipeline runs by time period')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--period <period>', 'Time period (day|week|month)', 'week')
    .option('--raw-filters <filters>', 'Raw Provider filters string')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('PipelinesCommand');
      try {
        screen.printLine('📈 Analyzing pipeline runs by time period...');
        const { pipelineService } = createPipelineDependencies(command);

        const metrics = await pipelineService.getDeploymentFrequencyWithAllIntervals(
          buildPipelineFilters(options)
        );

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(metrics, null, 2));
        } else {
          screen.printLine('\n=== Pipeline Runs by Period ===\n');
          screen.printLine(`Period: ${options.period}`);
          metrics.forEach((item: DeploymentFrequencyInterval) => {
            if (options.period === 'day') {
              screen.printLine(`Period: ${item.days} | Total Runs: ${item.daily_counts}`);
            } else if (options.period === 'week') {
              screen.printLine(`Period: ${item.weeks} | Total Runs: ${item.weekly_counts}`);
            } else {
              screen.printLine(`Period: ${item.months} | Total Runs: ${item.monthly_counts}`);
            }
          });
        }
      } catch (error) {
        logger.error('Failed to analyze pipeline runs by period', error);
        process.exit(1);
      }
    });

  pipelinesGroup
    .subcommand('jobs-summary')
    .description('Display a summary of pipeline jobs')
    .option('--max-jobs <number>', 'Maximum number of jobs to list', '20')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--raw-filters <filters>', 'Raw Provider filters string')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .option(
      '--weekends <mode>',
      'Weekend handling for averages: include, exclude, or weekends_only',
      'include'
    )
    .option(
      '--outlier-mode <mode>',
      'Outlier handling for averages: include, flag, or exclude',
      'include'
    )
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('PipelinesCommand');
      try {
        screen.printLine('📊 Generating pipeline jobs summary...');
        const { pipelineService } = createPipelineDependencies(command);

        const metrics = await pipelineService.getJobMetrics(buildPipelineFilters(options));

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(metrics, null, 2));
        } else {
          screen.printLine('\n=== Pipeline Jobs Summary ===\n\n');

          metrics.forEach((item) => {
            screen.printLine(`Job name: ${item.jobName}`);
            screen.printLine(`Total Jobs: ${item.totalRuns}`);
            screen.printLine(`Reruns: ${item.rerunCount}`);
            screen.printLine(`Success rate: ${item.successRate}%`);
            screen.printLine(`Failure rate: ${item.failureRate}%`);
            screen.printLine(`Average Duration Minutes: ${item.averageDurationMinutes}`);
            printOutliers(screen, item.outliers);
            screen.printLine(`Failure count: ${item.failureCount}`);
            screen.printLine('\n\n');
          });
        }
      } catch (error) {
        logger.error('Failed to generate jobs summary', error);
        process.exit(1);
      }
    });

  pipelinesGroup
    .subcommand('jobs-time-execution')
    .description('View pipeline job execution times')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--job <name>', 'Filter by job name')
    .option('--raw-filters <filters>', 'Raw Provider filters string')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .option(
      '--weekends <mode>',
      'Weekend handling for averages: include, exclude, or weekends_only',
      'include'
    )
    .option(
      '--outlier-mode <mode>',
      'Outlier handling for averages: include, flag, or exclude',
      'include'
    )
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('PipelinesCommand');
      try {
        screen.printLine('⏱️  Analyzing job execution times...');
        const { pipelineService } = createPipelineDependencies(command);

        const metrics = await pipelineService.getJobMetrics(buildPipelineFilters(options));

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(metrics, null, 2));
        } else {
          screen.printLine('\n=== Job Execution Times ===\n');
          metrics.forEach((item) => {
            screen.printLine(`Job: ${item.jobName}\n`);
            screen.printLine(`Total runs: ${item.totalRuns}`);
            screen.printLine(`Failure count: ${item.failureCount}`);
            screen.printLine(`Success rate: ${item.successRate}`);
            screen.printLine(
              `Average Execution Time: ${item.averageDurationMinutes.toFixed(2)} minutes`
            );
            printOutliers(screen, item.outliers);
          });
        }
      } catch (error) {
        logger.error('Failed to analyze job execution times', error);
        process.exit(1);
      }
    });

  pipelinesGroup
    .subcommand('jobs-steps-average-time')
    .description('View pipeline job steps average execution times')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--job <name>', 'Filter by job name')
    .option('--raw-filters <filters>', 'Raw Provider filters string')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .option(
      '--weekends <mode>',
      'Weekend handling for averages: include, exclude, or weekends_only',
      'include'
    )
    .option(
      '--outlier-mode <mode>',
      'Outlier handling for averages: include, flag, or exclude',
      'include'
    )
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('PipelinesCommand');
      try {
        screen.printLine('⏱️  Analyzing job steps execution times...');
        const { pipelineService } = createPipelineDependencies(command);

        const metrics = await pipelineService.getJobStepsAverageTime(buildPipelineFilters(options));

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(metrics, null, 2));
        } else {
          screen.printLine('\n=== Job Steps Execution Times ===\n');
          metrics.forEach((item: JobStepAverageTime) => {
            screen.printLine(`Step: ${item.name}`);
            screen.printLine(
              `Average Execution Time: ${item.averageDurationMinutes.toFixed(2)} minutes`
            );
            screen.printLine(`Analyzed across ${item.count} step executions\n`);
            printOutliers(screen, item.outliers);
          });
        }
      } catch (error) {
        logger.error('Failed to analyze job steps execution times', error);
        process.exit(1);
      }
    });

  /**
   * smm pipelines jobs-by-status [options]
   * View jobs grouped by status
   */
  pipelinesGroup
    .subcommand('jobs-by-status')
    .description('View pipeline jobs grouped by status')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--raw-filters <filters>', 'Raw Provider filters string')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .option(
      '--weekends <mode>',
      'Weekend handling for averages: include, exclude, or weekends_only',
      'include'
    )
    .option(
      '--outlier-mode <mode>',
      'Outlier handling for averages: include, flag, or exclude',
      'include'
    )
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('PipelinesCommand');
      try {
        screen.printLine('📊 Analyzing jobs by status...');
        const { pipelineService } = createPipelineDependencies(command);

        const metrics = await pipelineService.getJobMetrics(buildPipelineFilters(options));

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(metrics, null, 2));
        } else {
          metrics.forEach((item) => {
            screen.printLine('\n=== Jobs by Status ===\n');
            screen.printLine(`Name: ${item.jobName}`);
            screen.printLine(
              `✅ Successful: ${item.successCount}, success rate: ${item.successRate}%`
            );
            screen.printLine(`❌ Failed: ${item.failureCount}, failure rate: ${item.failureRate}%`);
            screen.printLine(`Average duration in minutes: ${item.averageDurationMinutes}`);
            printOutliers(screen, item.outliers);
          });
        }
      } catch (error) {
        logger.error('Failed to analyze jobs by status', error);
        process.exit(1);
      }
    });

  pipelinesGroup
    .subcommand('deployment-frequency')
    .description('Calculate deployment frequency (DORA metric)')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--period <period>', 'Time period (day|week|month)', 'week')
    .option('--raw-filters <filters>', 'Raw Provider filters string')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('PipelinesCommand');
      try {
        screen.printLine('🚀 Calculating deployment frequency...');
        const { config, pipelineService } = createPipelineDependencies(command);

        const deploymentTargets = config.getDeploymentFrequencyTargets();
        const metrics = await pipelineService.getDeploymentFrequencyWithAllIntervals(
          buildPipelineFilters(options)
        );

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(metrics, null, 2));
        } else {
          screen.printLine('\n=== Deployment Frequency (DORA) ===\n');
          if (deploymentTargets.length > 0) {
            screen.printLine('Configured deployment targets:');
            deploymentTargets.forEach((target, index) => {
              screen.printLine(`${index + 1}. ${target.pipeline} / ${target.job}`);
            });
            screen.printLine('');
          }

          metrics.forEach((item) => {
            screen.printLine(
              `Period: ${item.days} (daily), ${item.weeks} (weekly), ${item.months} (monthly)`
            );
            screen.printLine(
              `Total Deployments: ${item.daily_counts} (daily), ${item.weekly_counts} (weekly), ${item.monthly_counts} (monthly)`
            );

            // DORA rating
            let rating = 'Low';
            if (options.period === 'day' && item.daily_counts >= 1) {
              rating = 'Elite';
            } else if (options.period === 'week' && item.weekly_counts >= 1) {
              rating = 'High';
            } else if (options.period === 'month' && item.monthly_counts >= 1) {
              rating = 'Medium';
            }
            screen.printLine(`\n📈 DORA Rating: ${rating}`);
          });
        }
      } catch (error) {
        logger.error('Failed to calculate deployment frequency', error);
        process.exit(1);
      }
    });

  /**
   * smm pipelines lead-time [options]
   * Calculate lead time for changes (DORA metric)
   */
  pipelinesGroup
    .subcommand('lead-time')
    .description('Calculate lead time for changes (DORA metric)')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--raw-filters <filters>', 'Raw Provider filters string')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .option(
      '--weekends <mode>',
      'Weekend handling for averages: include, exclude, or weekends_only',
      'include'
    )
    .option(
      '--outlier-mode <mode>',
      'Outlier handling for averages: include, flag, or exclude',
      'include'
    )
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('PipelinesCommand');
      try {
        screen.printLine('⏱️  Calculating lead time for changes...');
        const { pipelineService } = createPipelineDependencies(command);

        const metrics = await pipelineService.getMetrics(buildPipelineFilters(options));

        const leadTime = metrics.averageDurationMinutes;

        if (options.output === 'json') {
          screen.printLine(JSON.stringify({ leadTime }, null, 2));
        } else {
          screen.printLine('\n=== Lead Time for Changes (DORA) ===\n');
          screen.printLine(`Lead Time: ${leadTime.toFixed(2)} hours`);

          // DORA rating
          let rating = 'Low';
          if (leadTime < 24) {
            rating = 'Elite';
          } else if (leadTime < 168) {
            // 1 week
            rating = 'High';
          } else if (leadTime < 720) {
            // 1 month
            rating = 'Medium';
          }
          screen.printLine(`\n📈 DORA Rating: ${rating}`);
        }
      } catch (error) {
        logger.error('Failed to calculate lead time', error);
        process.exit(1);
      }
    });
}
