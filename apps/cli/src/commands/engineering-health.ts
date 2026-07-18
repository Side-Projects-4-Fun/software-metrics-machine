import {
  createEngineeringHealthOrchestrator,
  type EngineeringHealthEvaluationInput,
  type MetricId,
  type MetricCategory,
} from '@smmachine/core';
import { TimeZoneProvider } from '@smmachine/core/infrastructure/timezone-provider';
import type { SmmCommand } from './smm-command';

const validCategories: MetricCategory[] = ['delivery', 'quality', 'collaboration', 'architecture'];

function parseMetricIds(value?: string): MetricId[] | undefined {
  if (!value) {
    return undefined;
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0) as MetricId[];
}

function parseCategory(value?: string): MetricCategory | undefined {
  if (!value) {
    return undefined;
  }

  if (!validCategories.includes(value as MetricCategory)) {
    throw new Error(
      `Invalid category \"${value}\". Supported categories: ${validCategories.join(', ')}`
    );
  }

  return value as MetricCategory;
}

function buildEvaluationInput(options: {
  metric?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  rawFilters?: string;
  period?: 'day' | 'week' | 'month';
  weekends?: 'include' | 'exclude' | 'weekends_only';
  outlierMode?: 'include' | 'flag' | 'exclude';
  compareStartDate?: string;
  compareEndDate?: string;
}): EngineeringHealthEvaluationInput {
  const hasPrevious = Boolean(options.compareStartDate || options.compareEndDate);

  return {
    metrics: parseMetricIds(options.metric),
    category: parseCategory(options.category),
    current: {
      startDate: options.startDate,
      endDate: options.endDate,
      rawFilters: options.rawFilters,
      period: options.period,
      weekends: options.weekends,
      outlierMode: options.outlierMode,
    },
    previous: hasPrevious
      ? {
          startDate: options.compareStartDate,
          endDate: options.compareEndDate,
          rawFilters: options.rawFilters,
          period: options.period,
          weekends: options.weekends,
          outlierMode: options.outlierMode,
        }
      : undefined,
  };
}

export function createEngineeringHealthCommands(program: SmmCommand): void {
  const group = program
    .subcommand('engineering-health')
    .description('Engineering health metrics (delivery, quality, collaboration, architecture)');
  const screen = program.getScreen();

  group
    .subcommand('evaluate')
    .description('Evaluate engineering health metrics using existing core services')
    .option('--metric <ids>', 'Comma-separated metric ids to evaluate')
    .option('--category <name>', 'Category filter: delivery|quality|collaboration|architecture')
    .option('--start-date <date>', 'Current window start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'Current window end date (YYYY-MM-DD)')
    .option('--compare-start-date <date>', 'Previous window start date (YYYY-MM-DD)')
    .option('--compare-end-date <date>', 'Previous window end date (YYYY-MM-DD)')
    .option('--raw-filters <filters>', 'Raw provider filters string')
    .option('--period <period>', 'Time period (day|week|month)', 'week')
    .option('--weekends <mode>', 'Weekend handling: include|exclude|weekends_only', 'include')
    .option('--outlier-mode <mode>', 'Outlier handling: include|flag|exclude', 'include')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('EngineeringHealthCommand');
      try {
        const config = command.getConfiguration();
        const orchestrator = createEngineeringHealthOrchestrator(
          config,
          logger,
          new TimeZoneProvider(config.timezone)
        );

        const evaluationInput = buildEvaluationInput(options);
        const result = await orchestrator.evaluate(evaluationInput);

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(result, null, 2));
          return;
        }

        screen.printLine('\n=== Engineering Health ===\n');
        screen.printLine(`Generated at: ${result.generatedAt}`);
        screen.printLine(`Evaluations: ${result.evaluations.length}`);

        result.evaluations.forEach((evaluation) => {
          screen.printLine('');
          screen.printLine(`Metric: ${evaluation.id} (${evaluation.category})`);
          if (evaluation.scope?.type === 'deployment-target') {
            screen.printLine(`Deployment target: ${evaluation.scope.label}`);
          }
          screen.printLine(`Value: ${evaluation.summary.valueLabel}`);
          screen.printLine(`Trend: ${evaluation.comparison.summary}`);
          screen.printLine(`Target: ${evaluation.target.description}`);
          screen.printLine(`Recommendation: ${evaluation.recommendation.summary}`);
        });
      } catch (error) {
        logger.error('Failed to evaluate engineering health', error);
        process.exit(1);
      }
    });
}
