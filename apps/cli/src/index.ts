import { createChangeRequestsCommands } from './commands/change-requests';
import { createPipelinesCommands } from './commands/pipelines';
import { createCodeCommands } from './commands/code';
import { createIssuesCommands } from './commands/issues';
import { createSonarQubeCommands } from './commands/sonarqube';
import { createDashboardCommands } from './commands/dashboard';
import { createToolsCommands } from './commands/tools';
import { createHealthCheckCommand } from './commands/health-check';
import { createMcpCommands } from './commands/mcp';
import { createArchitectureCommands } from './commands/architecture';
import { createEngineeringHealthCommands } from './commands/engineering-health';
import { createMetricsCommands } from './commands/metrics';
import { createFiltersCommands } from './commands/filters';
import { createProjectCommands } from './commands/project';
import { getApplicationVersion, Logger } from '@smmachine/utils';
import { SmmCommand } from './commands/smm-command';

export function commands(): SmmCommand {
  const program = new SmmCommand();

  program
    .name('smm')
    .description('Software Metrics Machine - High-performing team metrics')
    .version(getApplicationVersion())
    .option('--debug', 'Enable debug logging')
    .option('--project <name>', 'Select active project by name (github_repository)');

  createChangeRequestsCommands(program);
  createPipelinesCommands(program);
  createCodeCommands(program);
  createIssuesCommands(program);
  createSonarQubeCommands(program);
  createDashboardCommands(program);
  createToolsCommands(program);
  createHealthCheckCommand(program);
  createMcpCommands(program);
  createArchitectureCommands(program);
  createEngineeringHealthCommands(program);
  createMetricsCommands(program);
  createFiltersCommands(program);
  createProjectCommands(program);

  program
    .subcommand('help')
    .description('Show help information')
    .actionWithSmm(() => {
      program.outputHelp();
    });
  return program;
}

export async function main(): Promise<void> {
  const program = commands();

  if (!process.argv.slice(2).length) {
    program.outputHelp();
    return;
  }

  try {
    await program.parseAsync();
  } catch (error) {
    const logger = new Logger('smm-cli', process.env.DEBUG ? 'DEBUG' : undefined);
    if (error instanceof Error) {
      logger.error(`CLI Error: ${error.message}`);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
    } else {
      logger.error('Unknown CLI error');
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    const logger = new Logger('smm-cli', process.env.DEBUG ? 'DEBUG' : undefined);
    logger.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    if (process.env.DEBUG && error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}
