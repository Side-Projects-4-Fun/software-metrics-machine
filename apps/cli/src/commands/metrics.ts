import {
  METRIC_NAMESPACES,
  METRIC_VISIBILITIES,
  isMetricNamespace,
  isMetricVisibility,
  listMetricCatalogEntries,
  type MetricNamespace,
  type MetricVisibility,
} from '@smmachine/core';
import type { SmmCommand } from './smm-command';

function resolveNamespace(value?: string): MetricNamespace | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  if (!isMetricNamespace(value)) {
    throw new Error(`Invalid namespace "${value}". Supported: ${METRIC_NAMESPACES.join(', ')}`);
  }

  return value;
}

function resolveVisibility(value?: string): MetricVisibility | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  if (!isMetricVisibility(value)) {
    throw new Error(`Invalid visibility "${value}". Supported: ${METRIC_VISIBILITIES.join(', ')}`);
  }

  return value;
}

export function createMetricsCommands(program: SmmCommand): void {
  const group = program.subcommand('metrics').description('Inspect the metric catalog');
  const screen = program.getScreen();

  group
    .subcommand('list')
    .description('List available metrics and their stable identifiers')
    .option('--namespace <name>', `Filter by namespace: ${METRIC_NAMESPACES.join('|')}`)
    .option('--visibility <value>', 'Filter by visibility: public|internal (default: all)')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('MetricsCommand');

      try {
        const entries = listMetricCatalogEntries({
          namespace: resolveNamespace(options.namespace),
          visibility: resolveVisibility(options.visibility),
        });

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(entries, null, 2));
          return;
        }

        screen.heading('Metrics');
        for (const entry of entries) {
          screen.printLine(
            `${entry.id} (${entry.definition.namespace}) - ${entry.definition.label}`
          );
        }
        screen.printLine(`\nTotal: ${entries.length}`);
      } catch (error) {
        logger.error('Failed to list metrics', error);
        process.exit(1);
      }
    });
}
