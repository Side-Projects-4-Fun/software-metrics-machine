import type { SmmCommand } from './smm-command';
import type { IssuesRepository } from '@smmachine/core';
import { createJiraDependencies } from '../factories/jira-factory';

function createJiraOrchestrator(command: SmmCommand): IssuesRepository {
  const config = command.getConfiguration();
  const { issuesRepository } = createJiraDependencies(
    config,
    config.getJiraPath(),
    command.getLogger('JiraCommand')
  );

  return issuesRepository;
}

/**
 * Jira Command Group
 *
 * Provides CLI commands for Jira integration matching Python CLI functionality.
 *
 * Commands:
 *   smm jira fetch-issues      Fetch issues from Jira
 *   smm jira fetch-changelog   Fetch issue changelog from Jira
 *   smm jira fetch-comments    Fetch issue comments from Jira
 */
export function createJiraCommands(program: SmmCommand): void {
  const jiraGroup = program.subcommand('jira').description('Jira integration operations');
  const screen = program.getScreen();

  /**
   * smm jira fetch-issues [options]
   * Fetch issues from Jira
   */
  jiraGroup
    .subcommand('fetch-issues')
    .description('Fetch issues from Jira')
    .option('--force', 'Force re-fetching issues even if already fetched')
    .option(
      '--update',
      'Incrementally update issues — fetch only newer items and merge with existing cache'
    )
    .option('--start-date <date>', 'Filter issues created on or after this date')
    .option('--end-date <date>', 'Filter issues created on or before this date')
    .option('--status <status>', 'Filter by issue status')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('JiraCommand');
      try {
        screen.printLine('🔄 Fetching issues from Jira...');
        const orchestrator = createJiraOrchestrator(command);
        const issues = await orchestrator.getIssues({
          forceRefresh: options.force,
          startDate: options.startDate,
          endDate: options.endDate,
          status: options.status,
          incrementalUpdate: options.update,
        });

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(issues, null, 2));
        } else {
          screen.printLine(`\n✅ Fetched ${issues.length || 0} issues from Jira`);
        }
      } catch (error) {
        logger.error('Failed to fetch Jira issues', error);
        process.exit(1);
      }
    });

  /**
   * smm jira fetch-changelog [options]
   * Fetch issue changelog from Jira
   */
  jiraGroup
    .subcommand('fetch-changelog')
    .description('Fetch issue changelog from Jira')
    .option('--issue <key>', 'Specific issue key to fetch changelog for', '')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('JiraCommand');
      try {
        if (!options.issue) {
          screen.printLine('❌ Error: --issue parameter is required');
          process.exit(1);
        }

        screen.printLine(`🔄 Fetching changelog for issue ${options.issue}...`);

        // Note: This uses the issuesRepo directly via the orchestrator
        // The orchestrator doesn't expose getIssueChanges, so we'd need to enhance it
        screen.printLine('⚠️  Note: Changelog fetching requires direct repository access.');
        screen.printLine('   Use the Python CLI for full changelog support:');
        screen.printLine(
          `   python -m software_metrics_machine.apps.cli jira fetch-changelog --issue ${options.issue}`
        );
      } catch (error) {
        logger.error('Failed to fetch Jira changelog', error);
        process.exit(1);
      }
    });

  /**
   * smm jira fetch-comments [options]
   * Fetch issue comments from Jira
   */
  jiraGroup
    .subcommand('fetch-comments')
    .description('Fetch issue comments from Jira')
    .option('--issue <key>', 'Specific issue key to fetch comments for', '')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('JiraCommand');
      try {
        if (!options.issue) {
          screen.printLine('❌ Error: --issue parameter is required');
          process.exit(1);
        }

        screen.printLine(`🔄 Fetching comments for issue ${options.issue}...`);

        // Note: This uses the issuesRepo directly via the orchestrator
        // The orchestrator doesn't expose getIssueComments, so we'd need to enhance it
        screen.printLine('⚠️  Note: Comment fetching requires direct repository access.');
        screen.printLine('   Use the Python CLI for full comment support:');
        screen.printLine(
          `   python -m software_metrics_machine.apps.cli jira fetch-comments --issue ${options.issue}`
        );
      } catch (error) {
        logger.error('Failed to fetch Jira comments', error);
        process.exit(1);
      }
    });
}
