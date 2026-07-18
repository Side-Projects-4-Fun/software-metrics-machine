import { createPRsCommands } from './commands/prs';
import { createPipelinesCommands } from './commands/pipelines';
import { createCodeCommands } from './commands/code';
import { createJiraCommands } from './commands/jira';
import { createSonarQubeCommands } from './commands/sonarqube';
import { createDashboardCommands } from './commands/dashboard';
import { createToolsCommands } from './commands/tools';
import { createHealthCheckCommand } from './commands/health-check';
import { createMcpCommands } from './commands/mcp';
import { createArchitectureCommands } from './commands/architecture';
import { createEngineeringHealthCommands } from './commands/engineering-health';
import { getApplicationVersion, Logger } from '@smmachine/utils';
import { SmmCommand } from './commands/smm-command';

export function commands() {
  const program = new SmmCommand();

  program
    .name('smm')
    .description('Software Metrics Machine - High-performing team metrics')
    .version(getApplicationVersion())
    .option('--debug', 'Enable debug logging')
    .option('--project <name>', 'Select active project by name (github_repository)');

  // Register command groups
  createPRsCommands(program);
  createPipelinesCommands(program);
  createCodeCommands(program);
  createJiraCommands(program);
  createSonarQubeCommands(program);
  createDashboardCommands(program);
  createToolsCommands(program);
  createHealthCheckCommand(program);
  createMcpCommands(program);
  createArchitectureCommands(program);
  createEngineeringHealthCommands(program);

  // Global help
  program
    .subcommand('help')
    .description('Show help information')
    .actionWithSmm(() => {
      program.outputHelp();
    });
  return program;
}

/**
 * Software Metrics Machine - CLI
 *
 * Command-line interface for metrics operations.
 * Provides commands for accessing metrics from various data sources.
 *
 * Available command groups:
 *   - smm prs           Pull request operations (fetch, analyze)
 *   - smm pipelines     Pipeline/workflow operations (fetch, analyze)
 *   - smm code          Code analysis operations (churn, coupling, etc.)
 *   - smm jira          Jira integration (fetch issues, changelog, comments)
 *   - smm sonarqube     SonarQube integration (fetch quality measures)
 *   - smm dashboard     Dashboard server operations
 *   - smm tools         Utility tools (JSON merge, etc.)
 *   - smm mcp           MCP server operations
 *
 * Configuration:
 *   Set SMM_STORE_DATA_AT environment variable to point to a JSON configuration file:
 *
 *   export SMM_STORE_DATA_AT=/path/to/config.json
 *
 *   JSON configuration format:
 *   {
 *     "git_provider": "github",
 *     "github_token": "your_token",
 *     "github_repository": "owner/repo",
 *     "git_repository_location": "/path/to/repo",
 *     "deployment_frequency_targets": [
 *       { "pipeline": ".github/workflows/ci.yml", "job": "delivery" }
 *     ],
 *     "main_branch": "main",
 *     "jira_url": "https://your-org.atlassian.net",
 *     "jira_token": "your_token",
 *     "jira_project": "PROJECT",
 *     "jira_email": "your@email.com",
 *     "sonar_url": "https://sonarcloud.io",
 *     "sonar_token": "your_token",
 *     "sonar_project": "project_key",
 *     "log_level": "INFO",
 *     "dashboard_start_date": "2024-01-01",
 *     "dashboard_end_date": "2024-12-31"
 *   }
 *
 *   Alternatively, you can use project-specific environment variables:
 *   uppercase github_repository, replace non-alphanumeric characters with
 *   underscores, and append the setting name:
 *   BLA_123_GITHUB_TOKEN, BLA_123_JIRA_TOKEN, BLA_123_SMM_TIMEZONE
 *   for github_repository "bla/123".
 *
 *   SMM_STORE_DATA_AT is the only global configuration environment variable.
 */
export async function main() {
  const program = commands();

  // Default action if no command provided
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
