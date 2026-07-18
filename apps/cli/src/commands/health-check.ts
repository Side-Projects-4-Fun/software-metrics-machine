import type { SmmCommand } from './smm-command';
import type { Screen } from '../screen';
import { HealthCheckReportBuilder, type HealthReport } from '../services/health-check-report';

const reportBuilder = new HealthCheckReportBuilder();

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

        const report = await reportBuilder.build(config, options.provider, maxGapDays);

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
  screen.printLine('🩺 Data Health Check');
  screen.printLine(`Generated at: ${report.generatedAt}`);
  screen.printLine(`Base directory: ${report.baseDirectory}`);
  screen.printLine('');

  screen.printLine('Summary');
  screen.printLine(`  Total datasets: ${report.summary.totalDatasets}`);
  screen.printLine(`  Healthy: ${report.summary.healthyDatasets}`);
  screen.printLine(`  Warnings: ${report.summary.warningDatasets}`);
  screen.printLine(`  Errors: ${report.summary.errorDatasets}`);
  screen.printLine('');

  for (const dataset of report.datasets) {
    const level = HealthCheckReportBuilder.getDatasetLevel(dataset);
    const icon = level === 'healthy' ? '✅' : level === 'warning' ? '⚠️' : '❌';

    screen.printLine(`${icon} ${dataset.id}`);
    screen.printLine(`  Source: ${dataset.source}`);
    screen.printLine(`  Exists: ${dataset.exists ? 'yes' : 'no'}`);
    screen.printLine(`  Items: ${dataset.itemCount}`);

    if (dataset.lastFetchedAt) {
      screen.printLine(
        `  Last fetched: ${dataset.lastFetchedAt} (${dataset.staleDays} day(s) ago)`
      );
    }

    if (dataset.coverageStart && dataset.coverageEnd) {
      screen.printLine(`  Coverage: ${dataset.coverageStart} .. ${dataset.coverageEnd}`);
    }

    if (dataset.invalidDateCount > 0) {
      screen.printLine(`  Invalid date records: ${dataset.invalidDateCount}`);
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
