import type { SmmCommand } from './smm-command';
import { TimeZoneProvider } from '@smmachine/core/infrastructure/timezone-provider';
import {
  GithubPrsClient,
  GitlabMrClient,
  GitHubRateLimitManager,
  GitHubPullRequestsFetchRepository,
  parseMetricCleaningOptions,
  PRFilters,
  PRSummary,
  PRsService,
  PullRequestFactory,
  IReadPullRequestsRepository,
} from '@smmachine/core';

function createPRsOrchestratorRead(command: SmmCommand): IReadPullRequestsRepository {
  const config = command.getConfiguration();
  return PullRequestFactory.create(
    config,
    command.getLogger('PRsCommand'),
    new TimeZoneProvider(config.timezone)
  );
}

function createPRsOrchestratorFetch(command: SmmCommand): GitHubPullRequestsFetchRepository {
  const config = command.getConfiguration();
  const logger = command.getLogger('PRsCommand');
  const [githubOwner, githubRepo] = config.githubRepository!.split('/');
  const isGitlab = config.gitProvider?.toLowerCase() === 'gitlab';

  const rateLimitManager = new GitHubRateLimitManager(logger);
  const prsClient = isGitlab
    ? new GitlabMrClient(config.gitlabToken, config.githubRepository!, logger)
    : new GithubPrsClient(config.githubToken!, githubOwner, githubRepo, rateLimitManager, logger);

  return new GitHubPullRequestsFetchRepository(prsClient, config, logger);
}

function createPRService(command: SmmCommand): PRsService {
  const config = command.getConfiguration();
  const prRepository = createPRsOrchestratorRead(command);
  return new PRsService(
    prRepository,
    new TimeZoneProvider(config.timezone),
    command.getLogger('PRsCommand')
  );
}

function parseCsvList(value?: string): string[] {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function buildPRFilters(options: {
  startDate?: string;
  endDate?: string;
  excludeAuthors?: string;
  excludeCommenters?: string;
  authors?: string;
  labels?: string;
  state?: string;
  rawFilters?: string;
  weekends?: string;
  outlierMode?: string;
}): PRFilters {
  const filters: PRFilters = {
    startDate: options.startDate,
    endDate: options.endDate,
    excludeAuthors: parseCsvList(options.excludeAuthors),
    excludeCommenters: parseCsvList(options.excludeCommenters),
    authors: parseCsvList(options.authors),
    labels: parseCsvList(options.labels),
    rawFilters: options.rawFilters,
    cleaning: parseMetricCleaningOptions({
      weekends: options.weekends,
      outlierMode: options.outlierMode,
    }),
  };

  if (options.state) {
    filters.state = options.state as PRFilters['state'];
  }

  return filters;
}

function formatOptionalDate(value?: string): string {
  return value || 'None';
}

function formatHours(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

type CliOutlier = {
  value: number;
  timestamp: string;
  lowerBound: number;
  upperBound: number;
  item?: {
    number?: number;
    title?: string;
    author?: string;
    url?: string;
  };
};

function formatOutlierLine(outlier: CliOutlier): string {
  const item = outlier.item;
  const identity = item
    ? [`#${item.number ?? 'unknown'}`, item.title, item.author].filter(Boolean).join(' | ')
    : 'unknown item';
  return `    - ${identity}: ${outlier.value.toFixed(2)} (${outlier.timestamp}, bounds ${outlier.lowerBound.toFixed(2)} - ${outlier.upperBound.toFixed(2)})`;
}

function printOutliers(screen: ReturnType<SmmCommand['getScreen']>, outliers?: CliOutlier[]): void {
  if (!outliers || outliers.length === 0) {
    return;
  }

  screen.printLine(`  Outliers: ${outliers.length}`);
  for (const outlier of outliers.slice(0, 10)) {
    screen.printLine(formatOutlierLine(outlier));
  }
  if (outliers.length > 10) {
    screen.printLine(`    ...and ${outliers.length - 10} more`);
  }
}

export function formatPRSummary(summary: PRSummary): string {
  const lines: string[] = [
    'PRs Summary:',
    '',
    `Total PRs: ${summary.total_prs}`,
    `Merged PRs: ${summary.merged_prs}`,
    `Closed PRs: ${summary.closed_prs}`,
    `PRs Without Conclusion: ${summary.prs_without_conclusion}`,
    `Unique Authors: ${summary.unique_authors}`,
    `Unique Labels: ${summary.unique_labels}`,
    `Average of comments per PR: ${summary.avg_comments_per_pr}`,
    '',
    'Labels:',
  ];

  for (const label of summary.labels) {
    lines.push(`  - ${label.label}: ${label.prs} PRs`);
  }

  lines.push('', 'First PR:');
  if (summary.first_pr) {
    lines.push(
      `  Number: ${summary.first_pr.number}`,
      `  Title: ${summary.first_pr.title}`,
      `  Author: ${summary.first_pr.author}`,
      `  Created: ${summary.first_pr.created}`,
      `  Merged: ${formatOptionalDate(summary.first_pr.merged)}`,
      `  Closed: ${formatOptionalDate(summary.first_pr.closed)}`
    );
  } else {
    lines.push('  None');
  }

  lines.push('', 'Last PR:');
  if (summary.last_pr) {
    lines.push(
      `  Number: ${summary.last_pr.number}`,
      `  Title: ${summary.last_pr.title}`,
      `  Author: ${summary.last_pr.author}`,
      `  Created: ${summary.last_pr.created}`,
      `  Merged: ${formatOptionalDate(summary.last_pr.merged)}`,
      `  Closed: ${formatOptionalDate(summary.last_pr.closed)}`
    );
  } else {
    lines.push('  None');
  }

  lines.push('', 'Most commented PR:');
  if (summary.most_commented_pr) {
    lines.push(
      `  Number: ${summary.most_commented_pr.number}`,
      `  Title: ${summary.most_commented_pr.title}`,
      `  Author: ${summary.most_commented_pr.author}`,
      `  Comments: ${summary.most_commented_pr.comments}`
    );
  } else {
    lines.push('  None');
  }

  lines.push('', 'Top commenter:');
  if (summary.top_commenter) {
    lines.push(
      `  Login: ${summary.top_commenter.login}`,
      `  Comments: ${summary.top_commenter.comments}`
    );
  } else {
    lines.push('  None');
  }

  lines.push('', 'Top themes:');
  for (const theme of summary.top_themes) {
    lines.push(`  ${theme.text}: ${theme.value}`);
  }

  lines.push(
    '',
    'Time to first comment (hours):',
    `  Average: ${formatHours(summary.time_to_first_comment_hours.average)}`,
    `  Median: ${formatHours(summary.time_to_first_comment_hours.median)}`,
    `  Min: ${formatHours(summary.time_to_first_comment_hours.min)}`,
    `  Max: ${formatHours(summary.time_to_first_comment_hours.max)}`,
    `  PRs with comment: ${summary.time_to_first_comment_hours.prs_with_comment}`,
    `  PRs without comment: ${summary.time_to_first_comment_hours.prs_without_comment}`
  );

  return lines.join('\n');
}

/**
 * PRs Command Group
 *
 * Provides CLI commands for pull request operations matching Python CLI functionality.
 *
 * Commands:
 *   smm prs fetch       Fetch pull requests from GitHub
 *   smm prs summary     View PR summary statistics
 *   smm prs by-month    View PR metrics by month
 *   smm prs by-week     View PR metrics by week
 */
export function createPRsCommands(program: SmmCommand): void {
  const prsGroup = program.subcommand('prs').description('Pull request operations');
  const screen = program.getScreen();

  /**
   * smm prs fetch [options]
   * Fetch pull requests from GitHub
   */
  prsGroup
    .subcommand('fetch')
    .description('Fetch pull requests from the configured Git provider')
    .option('--force', 'Force re-fetching PRs even if already fetched')
    .option(
      '--update',
      'Incrementally update PRs — fetch only newer items and merge with existing cache'
    )
    .option('--start-date <date>', 'Filter PRs created on or after this date (ISO 8601)')
    .option('--end-date <date>', 'Filter PRs created on or before this date (ISO 8601)')
    .option('--raw-filters <filters>', 'Comma-separated raw filter string')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('PRsCommand');
      try {
        screen.printLine('🔄 Fetching pull requests from the configured Git provider...');
        const orchestrator = createPRsOrchestratorFetch(command);
        await orchestrator.fetchPRs({
          startDate: options.startDate,
          endDate: options.endDate,
          rawFilters: options.rawFilters,
          forceRefresh: options.force,
          incrementalUpdate: options.update,
        });

        screen.printLine('✅ Fetch data has been completed');
      } catch (error) {
        logger.error('Failed to fetch pull requests', error);
      }
    });

  prsGroup
    .subcommand('fetch-comments')
    .description('Fetch pull request comments from the configured Git provider')
    .option('--force', 'Force re-fetching PR comments even if already fetched')
    .option('--update', 'Incremental update: only fetch comments updated since last sync')
    .option('--start-date <date>', 'Filter PRs by creation date on or after this date (ISO 8601)')
    .option('--end-date <date>', 'Filter PRs by creation date on or before this date (ISO 8601)')
    .option('--raw-filters <filters>', 'Comma-separated raw filter string')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('PRsCommand');
      try {
        screen.printLine('🔄 Fetching pull request comments from the configured Git provider...');
        const orchestrator = createPRsOrchestratorRead(command);
        const prs = await orchestrator.loadPrsWithFilters(buildPRFilters(options));

        const orchestratorFetch = createPRsOrchestratorFetch(command);

        for (const pr of prs) {
          await orchestratorFetch.fetchPRComments(pr.number, {
            forceRefresh: options.force,
            incrementalUpdate: options.update,
          });
        }

        screen.printLine('✅ Fetch PR comments data has been completed');
      } catch (error) {
        logger.error('Failed to fetch pull request comments', error);
      }
    });

  /**
   * smm prs summary [options]
   * View PR summary statistics
   */
  prsGroup
    .subcommand('summary')
    .description('View PR summary statistics')
    .option('--start-date <date>', 'Filter PRs created on or after this date')
    .option('--end-date <date>', 'Filter PRs created on or before this date')
    .option('--exclude-authors <authors>', 'Comma-separated PR authors to exclude')
    .option('--exclude-commenters <commenters>', 'Comma-separated PR commenters to exclude')
    .option('--authors <authors>', 'Comma-separated PR authors to include')
    .option('--labels <labels>', 'Comma-separated PR labels to filter by')
    .option(
      '--raw-filters <filters>',
      'Comma-separated raw filter string (e.g. status=draft,author=john)'
    )
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('PRsCommand');
      try {
        screen.printLine('📊 Generating PR summary...');
        const service = createPRService(command);
        const filters = buildPRFilters(options);
        const summary = await service.getSummary(filters);

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(summary, null, 2));
        } else {
          screen.printLine(`\n${formatPRSummary(summary.result)}`);
        }

        screen.printLine('\n✅ Summary generated');
      } catch (error) {
        logger.error('Failed to generate PR summary', error);
        process.exit(1);
      }
    });

  /**
   * smm prs by-month [options]
   * View PR metrics grouped by month
   */
  prsGroup
    .subcommand('by-month')
    .description('View PR metrics grouped by month')
    .option('--start-date <date>', 'Filter PRs created on or after this date')
    .option('--end-date <date>', 'Filter PRs created on or before this date')
    .option('--exclude-authors <authors>', 'Comma-separated PR authors to exclude')
    .option('--exclude-commenters <commenters>', 'Comma-separated PR commenters to exclude')
    .option('--raw-filters <filters>', 'Comma-separated raw filter string')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('PRsCommand');
      try {
        screen.printLine('📊 Analyzing PRs by month...');
        const service = createPRService(command);
        const metrics = await service.getMetricsByMonth(buildPRFilters(options));

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(metrics, null, 2));
        } else {
          screen.printLine('\n=== PRs by Month ===\n');
          screen.printLine(JSON.stringify(metrics, null, 2));
        }

        screen.printLine('\n✅ Analysis completed');
      } catch (error) {
        logger.error('Failed to analyze PRs by month', error);
        process.exit(1);
      }
    });

  /**
   * smm prs by-week [options]
   * View PR metrics grouped by week
   */
  prsGroup
    .subcommand('by-week')
    .description('View PR metrics grouped by week')
    .option('--start-date <date>', 'Filter PRs created on or after this date')
    .option('--end-date <date>', 'Filter PRs created on or before this date')
    .option('--exclude-authors <authors>', 'Comma-separated PR authors to exclude')
    .option('--exclude-commenters <commenters>', 'Comma-separated PR commenters to exclude')
    .option('--raw-filters <filters>', 'Comma-separated raw filter string')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('PRsCommand');
      try {
        screen.printLine('📊 Analyzing PRs by week...');
        const service = createPRService(command);
        const metrics = await service.getMetricsByWeek(buildPRFilters(options));

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(metrics, null, 2));
        } else {
          screen.printLine('\n=== PRs by Week ===\n');
          screen.printLine(JSON.stringify(metrics, null, 2));
        }

        screen.printLine('\n✅ Analysis completed');
      } catch (error) {
        logger.error('Failed to analyze PRs by week', error);
        process.exit(1);
      }
    });

  /**
   * smm prs through-time [options]
   * View PRs opened and closed through time
   */
  prsGroup
    .subcommand('through-time')
    .description('View PRs opened and closed through time (daily/weekly/monthly)')
    .option('--start-date <date>', 'Filter PRs created on or after this date')
    .option('--end-date <date>', 'Filter PRs created on or before this date')
    .option('--exclude-authors <authors>', 'Comma-separated PR authors to exclude')
    .option('--exclude-commenters <commenters>', 'Comma-separated PR commenters to exclude')
    .option('--authors <authors>', 'Comma-separated PR authors to include')
    .option('--labels <labels>', 'Comma-separated PR labels to filter by')
    .option('--aggregate-by <period>', 'Aggregation period: day, week, or month (default: week)')
    .option('--raw-filters <filters>', 'Comma-separated raw filter string')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('PRsCommand');
      try {
        screen.printLine('📊 Analyzing PRs through time...');
        const service = createPRService(command);
        const filters = buildPRFilters(options);
        const rows = await service.getThroughTime(filters, options.aggregateBy);

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(rows, null, 2));
        } else {
          screen.printLine('\n=== PRs Through Time ===\n');
          for (const row of rows) {
            screen.printLine(`${row.date} | ${row.kind}: ${row.count}`);
          }
        }

        screen.printLine('\n✅ Analysis completed');
      } catch (error) {
        logger.error('Failed to analyze PRs through time', error);
        process.exit(1);
      }
    });

  /**
   * smm prs by-author [options]
   * View PRs grouped by author
   */
  prsGroup
    .subcommand('by-author')
    .description('View PRs grouped by author')
    .option('--start-date <date>', 'Filter PRs created on or after this date')
    .option('--end-date <date>', 'Filter PRs created on or before this date')
    .option('--exclude-authors <authors>', 'Comma-separated PR authors to exclude')
    .option('--exclude-commenters <commenters>', 'Comma-separated PR commenters to exclude')
    .option('--authors <authors>', 'Comma-separated PR authors to include')
    .option('--labels <labels>', 'Comma-separated PR labels to filter by')
    .option('--top <number>', 'Show top N authors', '10')
    .option('--raw-filters <filters>', 'Comma-separated raw filter string')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('PRsCommand');
      try {
        screen.printLine('📊 Analyzing PRs by author...');
        const service = createPRService(command);
        const filters = buildPRFilters(options);
        const authors = await service.getByAuthor(filters, Number(options.top));

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(authors, null, 2));
        } else {
          screen.printLine('\n=== PRs by Author ===\n');
          for (const author of authors) {
            screen.printLine(`${author.author}: ${author.count} PRs`);
          }
        }

        screen.printLine('\n✅ Analysis completed');
      } catch (error) {
        logger.error('Failed to analyze PRs by author', error);
        process.exit(1);
      }
    });

  /**
   * smm prs average-review-time [options]
   * View average review time by author
   */
  prsGroup
    .subcommand('average-review-time')
    .description('View average review time (days) by author')
    .option('--start-date <date>', 'Filter PRs created on or after this date')
    .option('--end-date <date>', 'Filter PRs created on or before this date')
    .option('--exclude-authors <authors>', 'Comma-separated PR authors to exclude')
    .option('--exclude-commenters <commenters>', 'Comma-separated PR commenters to exclude')
    .option('--authors <authors>', 'Comma-separated PR authors to include')
    .option('--labels <labels>', 'Comma-separated PR labels to filter by')
    .option('--top <number>', 'Show top N authors', '10')
    .option('--raw-filters <filters>', 'Comma-separated raw filter string')
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
      const logger = command.getLogger('PRsCommand');
      try {
        screen.printLine('📊 Calculating average review time...');
        const service = createPRService(command);
        const filters = buildPRFilters(options);
        const reviews = await service.getAverageReviewTime(filters, Number(options.top));

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(reviews, null, 2));
        } else {
          screen.printLine('\n=== Average Review Time by Author ===\n');
          for (const review of reviews) {
            screen.printLine(`${review.author}: ${review.avg_days.toFixed(2)} days`);
            printOutliers(screen, review.outliers);
          }
        }

        screen.printLine('\n✅ Analysis completed');
      } catch (error) {
        logger.error('Failed to calculate average review time', error);
        process.exit(1);
      }
    });

  /**
   * smm prs average-open [options]
   * View average PR open time by period
   */
  prsGroup
    .subcommand('average-open')
    .description('View average PR open time (days) aggregated by day/week/month')
    .option('--start-date <date>', 'Filter PRs created on or after this date')
    .option('--end-date <date>', 'Filter PRs created on or before this date')
    .option('--exclude-authors <authors>', 'Comma-separated PR authors to exclude')
    .option('--exclude-commenters <commenters>', 'Comma-separated PR commenters to exclude')
    .option('--authors <authors>', 'Comma-separated PR authors to include')
    .option('--labels <labels>', 'Comma-separated PR labels to filter by')
    .option('--aggregate-by <period>', 'Aggregation period: day, week, or month (default: week)')
    .option('--raw-filters <filters>', 'Comma-separated raw filter string')
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
      const logger = command.getLogger('PRsCommand');
      try {
        screen.printLine('📊 Calculating average PR open time...');
        const service = createPRService(command);
        const filters = buildPRFilters(options);
        const periods = await service.getAverageOpenBy(filters, options.aggregateBy);

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(periods, null, 2));
        } else {
          screen.printLine('\n=== Average PR Open Time ===\n');
          for (const period of periods) {
            screen.printLine(`${period.period}: ${period.avg_days.toFixed(2)} days`);
            printOutliers(screen, period.outliers);
          }
        }

        screen.printLine('\n✅ Analysis completed');
      } catch (error) {
        logger.error('Failed to calculate average PR open time', error);
        process.exit(1);
      }
    });

  /**
   * smm prs average-comments [options]
   * View average comments per PR
   */
  prsGroup
    .subcommand('average-comments')
    .description('View average number of comments per PR')
    .option('--start-date <date>', 'Filter PRs created on or after this date')
    .option('--end-date <date>', 'Filter PRs created on or before this date')
    .option('--exclude-authors <authors>', 'Comma-separated PR authors to exclude')
    .option('--exclude-commenters <commenters>', 'Comma-separated PR commenters to exclude')
    .option('--authors <authors>', 'Comma-separated PR authors to include')
    .option('--labels <labels>', 'Comma-separated PR labels to filter by')
    .option(
      '--aggregate-by <period>',
      'Aggregation period: week or month. Shows per-period averages.'
    )
    .option('--raw-filters <filters>', 'Comma-separated raw filter string')
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
      const logger = command.getLogger('PRsCommand');
      try {
        screen.printLine('📊 Calculating average comments per PR...');
        const service = createPRService(command);
        const filters = buildPRFilters(options);

        if (options.aggregateBy) {
          const mode = options.aggregateBy.toLowerCase();
          const timeframes =
            mode === 'month'
              ? await service.getMetricsByMonth(filters)
              : await service.getMetricsByWeek(filters);

          if (options.output === 'json') {
            screen.printLine(JSON.stringify(timeframes, null, 2));
          } else {
            screen.printLine(`\n=== Average Comments per PR by ${mode} ===\n`);
            for (const tf of timeframes) {
              screen.printLine(
                `${tf.period}: ${tf.averageComments} avg comments (${tf.count} PRs)`
              );
              printOutliers(screen, tf.outliers?.comments);
            }
          }
        } else {
          const metrics = await service.getMetrics(filters);

          if (options.output === 'json') {
            screen.printLine(
              JSON.stringify(
                { avg_comments: metrics.averageComments, outliers: metrics.outliers?.comments },
                null,
                2
              )
            );
          } else {
            screen.printLine(`\n=== Average Comments per PR ===\n`);
            screen.printLine(`Average Comments: ${metrics.averageComments}`);
            printOutliers(screen, metrics.outliers?.comments);
          }
        }

        screen.printLine('\n✅ Analysis completed');
      } catch (error) {
        logger.error('Failed to calculate average comments', error);
        process.exit(1);
      }
    });
}
