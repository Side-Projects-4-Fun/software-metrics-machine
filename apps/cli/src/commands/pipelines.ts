import type { SmmCommand } from './smm-command';
import {
  parseMetricCleaningOptions,
  PipelineImplementation,
  PipelinesService,
  type PipelineFilters,
  PipelineFactory,
  PipelineDashboardRunsByItem,
} from '@smmachine/core';
import { TimeZoneProvider } from '@smmachine/core/infrastructure/timezone-provider';
import { DeploymentFrequencyService } from '@smmachine/core/domain/pipelines/services/deployment-frequency-service';

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
  const pipelineImplementation = new PipelineImplementation(
    pipelineRepository,
    config.getDeploymentFrequencyTargets(),
    logger,
    timeZoneProvider
  );
  const deploymentFrequency = new DeploymentFrequencyService(
    pipelineRepository,
    config.getDeploymentFrequencyTargets(),
    logger,
    timeZoneProvider
  );
  return {
    config,
    pipelineRepository,
    workflowRepository,
    workflowJobRepository,
    pipelineService,
    pipelineImplementation,
    deploymentFrequency,
  };
}

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

type RunsByPeriod = 'day' | 'week' | 'month';

function toPeriodKey(inputPeriod: string, period: RunsByPeriod): string {
  if (period === 'day') {
    return inputPeriod;
  }

  const date = new Date(inputPeriod);
  if (Number.isNaN(date.getTime())) {
    return inputPeriod;
  }

  if (period === 'month') {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  // ISO week, grouped by UTC date.
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayOfWeek = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayOfWeek);
  const isoYear = utcDate.getUTCFullYear();
  const firstDay = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((utcDate.getTime() - firstDay.getTime()) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

function aggregateRunsByPeriod(
  metrics: PipelineDashboardRunsByItem[],
  requestedPeriod?: string
): PipelineDashboardRunsByItem[] {
  const period = (requestedPeriod || 'week') as RunsByPeriod;
  if (period === 'day') {
    return metrics;
  }

  const grouped = new Map<string, number>();

  for (const item of metrics) {
    const normalizedPeriod = toPeriodKey(item.period, period);
    const key = `${normalizedPeriod}||${item.workflow}`;
    grouped.set(key, (grouped.get(key) || 0) + item.runs);
  }

  return Array.from(grouped.entries())
    .map(([key, runs]) => {
      const [normalizedPeriod, workflow] = key.split('||');
      return {
        period: normalizedPeriod,
        workflow,
        runs,
      };
    })
    .sort((a, b) => {
      const periodComparison = a.period.localeCompare(b.period);
      if (periodComparison !== 0) {
        return periodComparison;
      }
      return a.workflow.localeCompare(b.workflow);
    });
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
        const { pipelineImplementation } = createPipelineDependencies(command);

        const { summary } = await pipelineImplementation.dashboard(buildPipelineFilters(options));

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(summary, null, 2));
        } else {
          screen.printLine('\n=== Pipeline Summary ===\n');
          screen.printLine(`Total Runs: ${summary.total_runs}`);
          screen.printLine(`Successful Runs: ${summary.successful_runs}`);
          screen.printLine(`Failed Runs: ${summary.failed_runs}`);
          screen.printLine(`Success Rate: ${(summary.success_rate * 100).toFixed(1)}%`);
          screen.printLine(
            `Average Duration: ${summary.average_duration_minutes.toFixed(2)} minutes`
          );
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
        const { pipelineImplementation } = createPipelineDependencies(command);

        const { summary } = await pipelineImplementation.dashboard(buildPipelineFilters(options));

        if (options.output === 'json') {
          screen.printLine(
            JSON.stringify(
              {
                successful: summary.successful_runs,
                failed: summary.failed_runs,
                total: summary.total_runs,
              },
              null,
              2
            )
          );
        } else {
          screen.printLine('\n=== Pipelines by Status ===\n');
          screen.printLine(`✅ Successful: ${summary.successful_runs}`);
          screen.printLine(`❌ Failed: ${summary.failed_runs}`);
          screen.printLine(`📊 Total: ${summary.total_runs}`);
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
        const { pipelineImplementation } = createPipelineDependencies(command);

        const { summary } = await pipelineImplementation.dashboard(buildPipelineFilters(options));

        if (options.output === 'json') {
          screen.printLine(
            JSON.stringify({ averageDuration: summary.average_duration_minutes }, null, 2)
          );
        } else {
          screen.printLine('\n=== Pipeline Run Durations ===\n');
          if (options.workflow) {
            screen.printLine(`Workflow: ${options.workflow}`);
          }
          screen.printLine(
            `Average Duration: ${summary.average_duration_minutes.toFixed(2)} minutes`
          );
          screen.printLine(`Total Runs: ${summary.total_runs}`);
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
        const { pipelineImplementation } = createPipelineDependencies(command);

        const filters = buildPipelineFilters(options);
        const dashboard = await pipelineImplementation.dashboard(filters);

        const metrics = aggregateRunsByPeriod(dashboard.runs_by, options.period);
        if (options.output === 'json') {
          screen.printLine(JSON.stringify(metrics, null, 2));
        } else {
          screen.printLine('\n=== Pipeline Runs by Period ===\n');
          screen.printLine(`Period: ${options.period}`);
          metrics.forEach((item: PipelineDashboardRunsByItem) => {
            screen.printLine(
              `Period: ${item.period} | Total Runs: ${item.runs} | Pipeline: ${item.workflow}`
            );
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
        const { pipelineImplementation } = createPipelineDependencies(command);

        const { jobs_summary } = await pipelineImplementation.dashboard(
          buildPipelineFilters(options)
        );

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(jobs_summary, null, 2));
        } else {
          screen.printLine('\n=== Pipeline Jobs Summary ===\n\n');

          jobs_summary.forEach((item) => {
            screen.printLine(`Job name: ${item.job_name}`);
            screen.printLine(`Total Jobs: ${item.total_runs}`);
            screen.printLine(`Reruns: ${item.rerun_count}`);
            screen.printLine(`Success rate: ${item.success_rate}%`);
            screen.printLine(`Failure rate: ${item.failure_rate}%`);
            screen.printLine(`Average Duration Minutes: ${item.avg_duration_minutes}`);
            printOutliers(screen, item.outliers);
            screen.printLine(`Failure count: ${item.failure_count}`);
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
        const { pipelineImplementation } = createPipelineDependencies(command);

        const { jobs_summary } = await pipelineImplementation.dashboard(
          buildPipelineFilters(options)
        );

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(jobs_summary, null, 2));
        } else {
          screen.printLine('\n=== Job Execution Times ===\n');
          jobs_summary.forEach((item) => {
            screen.printLine(`Job: ${item.job_name}\n`);
            screen.printLine(`Total runs: ${item.total_runs}`);
            screen.printLine(`Failure count: ${item.failure_count}`);
            screen.printLine(`Success rate: ${item.success_rate}`);
            screen.printLine(
              `Average Execution Time: ${item.avg_duration_minutes.toFixed(2)} minutes`
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
        const { pipelineImplementation } = createPipelineDependencies(command);

        const { job_steps_average_time } = await pipelineImplementation.dashboard(
          buildPipelineFilters(options)
        );

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(job_steps_average_time, null, 2));
        } else {
          screen.printLine('\n=== Job Steps Execution Times ===\n');
          job_steps_average_time.forEach((item) => {
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
        const { pipelineImplementation } = createPipelineDependencies(command);

        const { jobs_summary } = await pipelineImplementation.dashboard(
          buildPipelineFilters(options)
        );

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(jobs_summary, null, 2));
        } else {
          jobs_summary.forEach((item) => {
            screen.printLine('\n=== Jobs by Status ===\n');
            screen.printLine(`Name: ${item.job_name}`);
            screen.printLine(
              `✅ Successful: ${item.success_count}, success rate: ${item.success_rate}%`
            );
            screen.printLine(
              `❌ Failed: ${item.failure_count}, failure rate: ${item.failure_rate}%`
            );
            screen.printLine(`Average duration in minutes: ${item.avg_duration_minutes}`);
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
        const { config, deploymentFrequency } = createPipelineDependencies(command);
        const deploymentTargets = config.getDeploymentFrequencyTargets();

        const filters = buildPipelineFilters(options);
        const metrics = await deploymentFrequency.getDeploymentFrequencyWithAllIntervals(filters);

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
        const { pipelineImplementation } = createPipelineDependencies(command);

        const { summary } = await pipelineImplementation.dashboard(buildPipelineFilters(options));

        const leadTime = summary.average_duration_minutes;

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
