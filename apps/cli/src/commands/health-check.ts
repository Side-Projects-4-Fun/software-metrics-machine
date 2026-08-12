import type { SmmCommand } from './smm-command';
import type { Screen } from '../screen';
import {
  HealthCheckService,
  type HealthReport,
} from '@smmachine/core/domain/health-check/health-check-service';

const healthCheckService = new HealthCheckService();

export function createHealthCheckCommand(program: SmmCommand): void {
  const screen = program.getScreen();

  program
    .subcommand('health-check')
    .description('Analyze local cache data quality (missing, stale, invalid, and coverage gaps)')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .option('--provider <name>', 'Filter provider (all|github|jira|sonarqube)', 'all')
    .option(
      '--max-gap-days <days>',
      'Only report potential gaps larger than this number of days',
      '1'
    )
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('HealthCheckCommand');
      try {
        const config = command.getConfiguration();
        const maxGapDays = Number.parseInt(options.maxGapDays, 10);

        if (Number.isNaN(maxGapDays) || maxGapDays < 1) {
          throw new Error('--max-gap-days must be a positive integer');
        }

        const report = await healthCheckService.generateReport(
          config,
          options.provider,
          maxGapDays
        );

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(report, null, 2));
          return;
        }

        printTextReport(report, maxGapDays, screen);
      } catch (error) {
        logger.error('Failed to run health check', error);
        process.exit(1);
      }
    });
}

function printTextReport(report: HealthReport, maxGapDays: number, screen: Screen): void {
  screen.heading('Data Health Check');
  screen.keyValue('Generated at', report.generatedAt);
  screen.keyValue('Base directory', report.baseDirectory);
  screen.printLine('');

  screen.section('Summary');
  screen.keyValue('  Total datasets', report.summary.totalDatasets);
  screen.keyValue('  Healthy', report.summary.healthyDatasets);
  screen.keyValue('  Warnings', report.summary.warningDatasets);
  screen.keyValue('  Errors', report.summary.errorDatasets);
  screen.printLine('');

  for (const dataset of report.datasets) {
    const level = HealthCheckService.getDatasetLevel(dataset);
    const icon = level === 'healthy' ? '✅' : level === 'warning' ? '⚠️' : '❌';

    screen.section(`${icon} ${dataset.id}`);
    screen.keyValue('  Source', dataset.source);
    screen.keyValue('  Exists', dataset.exists ? 'yes' : 'no');
    screen.keyValue('  Items', dataset.itemCount);

    if (dataset.lastFetchedAt) {
      screen.keyValue(
        '  Last fetched',
        `${dataset.lastFetchedAt} (${dataset.staleDays} day(s) ago)`
      );
    }

    if (dataset.coverageStart && dataset.coverageEnd) {
      screen.keyValue('  Coverage', `${dataset.coverageStart} .. ${dataset.coverageEnd}`);
    }

    if (dataset.invalidDateCount > 0) {
      screen.keyValue('  Invalid date records', dataset.invalidDateCount);
    }

    const missingEntries = (
      Object.entries(dataset.missingRequiredFields) as Array<[string, number]>
    ).filter(([, count]) => count > 0);
    if (missingEntries.length > 0) {
      screen.printLine('  Missing required fields:');
      for (const [field, count] of missingEntries) {
        screen.printLine(`    - ${field}: ${count}`);
      }
    }

    if (dataset.potentialGapRanges.length > 0) {
      screen.printLine(`  Potential gaps (> ${maxGapDays - 1} day(s) between records):`);
      for (const gap of dataset.potentialGapRanges.slice(0, 5)) {
        screen.printLine(`    - ${gap.start} .. ${gap.end} (${gap.days} day(s))`);
      }
      if (dataset.potentialGapRanges.length > 5) {
        screen.printLine(`    - ... ${dataset.potentialGapRanges.length - 5} more`);
      }
    }

    if (dataset.notes.length > 0) {
      screen.printLine('  Notes:');
      for (const note of dataset.notes) {
        screen.printLine(`    - ${note}`);
      }
    }

    screen.printLine('');
  }
}
