import type { ArchitectureView } from '@smmachine/core';
import { ArchitectureService } from '@smmachine/core';
import type { SmmCommand } from './smm-command';

function toMermaid(view: ArchitectureView): string {
  const lines: string[] = ['flowchart LR'];

  for (const node of view.nodes) {
    const label = `${node.name}${node.technology ? `\\n${node.technology}` : ''}`;
    lines.push(`  ${node.id.replace(/[^a-zA-Z0-9_]/g, '_')}["${label}"]`);
  }

  for (const edge of view.edges) {
    lines.push(
      `  ${edge.source.replace(/[^a-zA-Z0-9_]/g, '_')} -->|${edge.description || edge.kind}| ${edge.target.replace(/[^a-zA-Z0-9_]/g, '_')}`
    );
  }

  return lines.join('\n');
}

export function createArchitectureCommands(program: SmmCommand): void {
  const architectureGroup = program
    .subcommand('architecture')
    .description('Architecture analysis and visualization data generation');
  const screen = program.getScreen();

  architectureGroup
    .subcommand('generate')
    .description('Generate and persist an architecture snapshot (CLI write path)')
    .option('--start-date <date>', 'Start date for git-history input (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date for git-history input (YYYY-MM-DD)')
    .option('--refresh-git', 'Force refreshing commits from git repository')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('ArchitectureCommand');
      try {
        const service = new ArchitectureService(command.getConfiguration(), logger);
        const snapshot = await service.generateSnapshot({
          startDate: options.startDate,
          endDate: options.endDate,
          refreshGit: Boolean(options.refreshGit),
        });

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(snapshot, null, 2));
          return;
        }

        screen.printLine('\n=== Architecture Snapshot Generated ===\n');
        screen.printLine(`Snapshot ID: ${snapshot.snapshotId}`);
        screen.printLine(`Project: ${snapshot.project}`);
        screen.printLine(`Generated at: ${snapshot.generatedAt}`);
        screen.printLine(`Commits considered: ${snapshot.commitCount}`);
        screen.printLine(
          `Views: ${snapshot.views
            .map(
              (view) => `${view.level} (${view.nodes.length} nodes / ${view.edges.length} edges)`
            )
            .join(', ')}`
        );
      } catch (error) {
        logger.error('Failed to generate architecture snapshot', error);
        process.exit(1);
      }
    });

  architectureGroup
    .subcommand('list-snapshots')
    .description('List persisted architecture snapshots')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('ArchitectureCommand');
      try {
        const service = new ArchitectureService(command.getConfiguration(), logger);
        const snapshots = await service.listSnapshots();

        if (options.output === 'json') {
          screen.printLine(JSON.stringify({ snapshots }, null, 2));
          return;
        }

        screen.printLine('\n=== Architecture Snapshots ===\n');
        if (!snapshots.length) {
          screen.printLine('No snapshots found. Run: smm architecture generate');
          return;
        }

        for (const snapshot of snapshots) {
          screen.printLine(
            `- ${snapshot.snapshotId} | ${snapshot.generatedAt} | commits=${snapshot.commitCount} | views=${snapshot.availableViews.join(',')}`
          );
        }
      } catch (error) {
        logger.error('Failed to list architecture snapshots', error);
        process.exit(1);
      }
    });

  architectureGroup
    .subcommand('export')
    .description('Export an architecture view from persisted snapshots')
    .option('--snapshot-id <id>', 'Snapshot id (defaults to latest)')
    .option('--view <level>', 'View level (context|container|component|code)', 'container')
    .option('--format <format>', 'Export format (json|mermaid)', 'json')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('ArchitectureCommand');
      try {
        const service = new ArchitectureService(command.getConfiguration(), logger);
        const view = await service.getView(options.view, options.snapshotId);

        if (!view) {
          screen.printLine('No architecture view found for the requested snapshot/level.');
          process.exit(1);
        }

        if (options.format === 'mermaid') {
          screen.printLine(toMermaid(view));
          return;
        }

        screen.printLine(JSON.stringify(view, null, 2));
      } catch (error) {
        logger.error('Failed to export architecture view', error);
        process.exit(1);
      }
    });
}
