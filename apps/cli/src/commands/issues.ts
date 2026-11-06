import type { SmmCommand } from './smm-command';
import type { IssuesRepository } from '@smmachine/core/domain/issues/issues-repository-json';
import { IssuesFactory } from '@smmachine/core/domain/issues/factories/issues-factory';
import { TimeZoneProvider } from '@smmachine/core/infrastructure/timezone-provider';

function createIssuesRepository(command: SmmCommand): IssuesRepository {
  const config = command.getConfiguration();
  return IssuesFactory.create(
    config,
    command.getLogger('IssuesCommand'),
    new TimeZoneProvider(config.timezone)
  ).issuesRepository;
}

function providerLabel(provider: string): string {
  if (provider === 'github') {
    return 'GitHub';
  }
  if (provider === 'jira-csv') {
    return 'Jira CSV';
  }
  return 'Jira';
}

function parseLabels(value?: string): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const labels = value
    .split(',')
    .map((label) => label.trim())
    .filter((label) => label.length > 0);

  return labels.length > 0 ? labels : undefined;
}

/**
 * Issues Command Group
 *
 * Provider-agnostic commands for the configured issue tracker
 * (`issues_provider`: jira or github).
 *
 * Commands:
 *   smm issues fetch            Fetch issues
 *   smm issues fetch-comments   Fetch comments for one issue or a creation window
 */
export function createIssuesCommands(program: SmmCommand): void {
  const issuesGroup = program.subcommand('issues').description('Issue tracker operations');
  const screen = program.getScreen();

  /**
   * smm issues fetch [options]
   */
  issuesGroup
    .subcommand('fetch')
    .description('Fetch issues from the configured issue tracker')
    .option('--force', 'Force re-fetching issues even if already fetched')
    .option(
      '--update',
      'Incrementally update issues — fetch only newer items and merge with existing cache'
    )
    .option('--start-date <date>', 'Filter issues created on or after this date')
    .option('--end-date <date>', 'Filter issues created on or before this date')
    .option('--status <status>', 'Filter by issue status')
    .option('--label <labels>', 'Filter by comma-separated labels')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('IssuesCommand');
      try {
        const repository = createIssuesRepository(command);
        const provider = providerLabel(repository.provider);

        screen.printLine(`🔄 Fetching issues from ${provider}...`);
        const issues = await repository.getIssues({
          forceRefresh: options.force,
          startDate: options.startDate,
          endDate: options.endDate,
          status: options.status,
          labels: parseLabels(options.label),
          incrementalUpdate: options.update,
        });

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(issues, null, 2));
        } else {
          screen.printLine(`\n✅ Fetched ${issues.length || 0} issues from ${provider}`);
        }
      } catch (error) {
        logger.error('Failed to fetch issues', error);
        process.exit(1);
      }
    });

  /**
   * smm issues fetch-comments [options]
   *
   * With `--issue`, fetch comments for that issue. Without it, fetch every
   * comment created inside the requested window.
   */
  issuesGroup
    .subcommand('fetch-comments')
    .description('Fetch issue comments for one issue or a creation window')
    .option('--issue <key>', 'Specific issue key to fetch comments for')
    .option('--start-date <date>', 'Comment creation start boundary')
    .option('--end-date <date>', 'Comment creation end boundary')
    .option('--force', 'Force re-fetching comments even if already cached')
    .option('--update', 'Incrementally update comments and merge with existing cache')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('IssuesCommand');
      try {
        const repository = createIssuesRepository(command);
        const provider = providerLabel(repository.provider);

        if (
          repository.provider === 'jira' &&
          !options.issue &&
          !options.startDate &&
          !options.endDate
        ) {
          screen.printLine(
            '⚠️  No --issue or date window given; fetching all comments can be slow on Jira.'
          );
        }

        screen.printLine(`🔄 Fetching comments from ${provider}...`);
        const comments = await repository.getComments({
          issueKey: options.issue,
          startDate: options.startDate,
          endDate: options.endDate,
          forceRefresh: options.force,
          incrementalUpdate: options.update,
        });

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(comments, null, 2));
        } else {
          screen.printLine(`\n✅ Fetched ${comments.length || 0} comments from ${provider}`);
        }
      } catch (error) {
        logger.error('Failed to fetch comments', error);
        process.exit(1);
      }
    });
}
