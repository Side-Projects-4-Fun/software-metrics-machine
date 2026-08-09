import type { SmmCommand } from './smm-command';
import { TimeZoneProvider } from '@smmachine/core/infrastructure/timezone-provider';
import type {
  ChangeRequestFilters,
  ChangeRequestSummary,
  IReadChangeRequestsRepository,
  MetricMethod,
} from '@smmachine/core';
import {
  GithubPrsClient,
  GitlabMrClient,
  defaultGitlabCliRunner,
  GitHubRateLimitManager,
  GitHubPullRequestsFetchRepository,
  parseMetricCleaningOptions,
  ChangeRequestsService,
  ChangeRequestFactory,
} from '@smmachine/core';
import { formatDuration } from '@smmachine/utils';
import { resolveSavedFilterOptions } from './helpers/filter-helper';

function createChangeRequestsOrchestratorRead(command: SmmCommand): IReadChangeRequestsRepository {
  const config = command.getConfiguration();
  return ChangeRequestFactory.create(
    config,
    command.getLogger('ChangeRequestsCommand'),
    new TimeZoneProvider(config.timezone)
  );
}

function createChangeRequestsOrchestratorFetch(
  command: SmmCommand
): GitHubPullRequestsFetchRepository {
  const config = command.getConfiguration();
  const logger = command.getLogger('ChangeRequestsCommand');
  const [githubOwner, githubRepo] = config.githubRepository!.split('/');
  const isGitlab = config.gitProvider?.toLowerCase() === 'gitlab';

  const rateLimitManager = new GitHubRateLimitManager(logger);
  const changeRequestsClient = isGitlab
    ? new GitlabMrClient(
        config.gitlabToken,
        config.githubRepository!,
        logger,
        defaultGitlabCliRunner,
        config.gitlabUrl
      )
    : new GithubPrsClient(config.githubToken!, githubOwner, githubRepo, rateLimitManager, logger);

  return new GitHubPullRequestsFetchRepository(changeRequestsClient, config, logger);
}

function createChangeRequestsService(command: SmmCommand): ChangeRequestsService {
  const config = command.getConfiguration();
  const changeRequestRepository = createChangeRequestsOrchestratorRead(command);
  return new ChangeRequestsService(
    changeRequestRepository,
    new TimeZoneProvider(config.timezone),
    command.getLogger('ChangeRequestsCommand')
  );
}

function parseCsvList(value?: string): string[] {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function buildChangeRequestFilters(options: {
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
}): ChangeRequestFilters {
  const filters: ChangeRequestFilters = {
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
    filters.state = options.state as ChangeRequestFilters['state'];
  }

  return filters;
}

const VALID_METRIC_METHODS: MetricMethod[] = [
  'average',
  'median',
  'p75',
  'p90',
  'p95',
  'min',
  'max',
];

function normalizeMetricMethod(value?: string): MetricMethod {
  const normalized = (value || 'average').toLowerCase();
  return VALID_METRIC_METHODS.includes(normalized as MetricMethod)
    ? (normalized as MetricMethod)
    : 'average';
}

function formatOptionalDate(value?: string): string {
  return value || 'None';
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

export function formatChangeRequestSummary(summary: ChangeRequestSummary): string {
  const lines: string[] = [
    'Change Requests Summary:',
    '',
    `Total change requests: ${summary.total_change_requests}`,
    `Merged change requests: ${summary.merged_change_requests}`,
    `Closed change requests: ${summary.closed_change_requests}`,
    `Change requests without conclusion: ${summary.change_requests_without_conclusion}`,
    `Unique Authors: ${summary.unique_authors}`,
    `Unique Labels: ${summary.unique_labels}`,
    `Comments per change request: ${summary.comments_per_change_request}`,
    '',
    'Labels:',
  ];

  for (const label of summary.labels) {
    lines.push(`  - ${label.label}: ${label.change_requests} change requests`);
  }

  lines.push('', 'First change request:');
  if (summary.first_change_request) {
    lines.push(
      `  Number: ${summary.first_change_request.number}`,
      `  Title: ${summary.first_change_request.title}`,
      `  Author: ${summary.first_change_request.author}`,
      `  Created: ${summary.first_change_request.created}`,
      `  Merged: ${formatOptionalDate(summary.first_change_request.merged)}`,
      `  Closed: ${formatOptionalDate(summary.first_change_request.closed)}`
    );
  } else {
    lines.push('  None');
  }

  lines.push('', 'Last change request:');
  if (summary.last_change_request) {
    lines.push(
      `  Number: ${summary.last_change_request.number}`,
      `  Title: ${summary.last_change_request.title}`,
      `  Author: ${summary.last_change_request.author}`,
      `  Created: ${summary.last_change_request.created}`,
      `  Merged: ${formatOptionalDate(summary.last_change_request.merged)}`,
      `  Closed: ${formatOptionalDate(summary.last_change_request.closed)}`
    );
  } else {
    lines.push('  None');
  }

  lines.push('', 'Most commented change request:');
  if (summary.most_commented_change_request) {
    lines.push(
      `  Number: ${summary.most_commented_change_request.number}`,
      `  Title: ${summary.most_commented_change_request.title}`,
      `  Author: ${summary.most_commented_change_request.author}`,
      `  Comments: ${summary.most_commented_change_request.comments}`
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
    'Time to first comment:',
    `  Average: ${formatDuration(summary.time_to_first_comment_hours.average, 'hours')}`,
    `  Median: ${formatDuration(summary.time_to_first_comment_hours.median, 'hours')}`,
    `  Min: ${formatDuration(summary.time_to_first_comment_hours.min, 'hours')}`,
    `  Max: ${formatDuration(summary.time_to_first_comment_hours.max, 'hours')}`,
    `  Change requests with comment: ${summary.time_to_first_comment_hours.change_requests_with_comment}`,
    `  Change requests without comment: ${summary.time_to_first_comment_hours.change_requests_without_comment}`
  );

  return lines.join('\n');
}

/**
 * Change Requests Command Group
 *
 * Provides CLI commands for change request operations matching Python CLI functionality.
 *
 * Commands:
 *   smm change-requests fetch       Fetch change requests from GitHub
 *   smm change-requests summary     View change request summary statistics
 *   smm change-requests by-month    View change request metrics by month
 *   smm change-requests by-week     View change request metrics by week
 */
export function createChangeRequestsCommands(program: SmmCommand): void {
  const changeRequestsGroup = program
    .subcommand('change-requests')
    .description('Change request operations');
  const screen = program.getScreen();

  /**
   * smm change-requests fetch [options]
   * Fetch change requests from GitHub
   */
  changeRequestsGroup
    .subcommand('fetch')
    .description('Fetch change requests from the configured Git provider')
    .option('--force', 'Force re-fetching change requests even if already fetched')
    .option(
      '--update',
      'Incrementally update change requests — fetch only newer items and merge with existing cache'
    )
    .option(
      '--start-date <date>',
      'Filter change requests created on or after this date (ISO 8601)'
    )
    .option('--end-date <date>', 'Filter change requests created on or before this date (ISO 8601)')
    .option('--raw-filters <filters>', 'Comma-separated raw filter string')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('ChangeRequestsCommand');
      try {
        screen.printLine('🔄 Fetching change requests from the configured Git provider...');
        const orchestrator = createChangeRequestsOrchestratorFetch(command);
        await orchestrator.fetchPRs({
          startDate: options.startDate,
          endDate: options.endDate,
          rawFilters: options.rawFilters,
          forceRefresh: options.force,
          incrementalUpdate: options.update,
        });

        screen.printLine('✅ Fetch data has been completed');
      } catch (error) {
        logger.error('Failed to fetch change requests', error);
      }
    });

  changeRequestsGroup
    .subcommand('fetch-comments')
    .description('Fetch change request comments from the configured Git provider')
    .option('--force', 'Force re-fetching change request comments even if already fetched')
    .option('--update', 'Incremental update: only fetch comments updated since last sync')
    .option(
      '--start-date <date>',
      'Filter change requests by creation date on or after this date (ISO 8601)'
    )
    .option(
      '--end-date <date>',
      'Filter change requests by creation date on or before this date (ISO 8601)'
    )
    .option('--raw-filters <filters>', 'Comma-separated raw filter string')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('ChangeRequestsCommand');
      try {
        screen.printLine('🔄 Fetching change request comments from the configured Git provider...');
        const orchestrator = createChangeRequestsOrchestratorRead(command);
        const changeRequests = await orchestrator.loadChangeRequestsWithFilters(
          buildChangeRequestFilters(options)
        );

        const orchestratorFetch = createChangeRequestsOrchestratorFetch(command);

        for (const changeRequest of changeRequests) {
          await orchestratorFetch.fetchPRComments(changeRequest.number, {
            forceRefresh: options.force,
            incrementalUpdate: options.update,
          });
        }

        screen.printLine('✅ Fetch change request comments data has been completed');
      } catch (error) {
        logger.error('Failed to fetch change request comments', error);
      }
    });

  /**
   * smm change-requests summary [options]
   * View change request summary statistics
   */
  changeRequestsGroup
    .subcommand('summary')
    .description('View change request summary statistics')
    .option('--start-date <date>', 'Filter change requests created on or after this date')
    .option('--end-date <date>', 'Filter change requests created on or before this date')
    .option('--exclude-authors <authors>', 'Comma-separated change request authors to exclude')
    .option(
      '--exclude-commenters <commenters>',
      'Comma-separated change request commenters to exclude'
    )
    .option('--authors <authors>', 'Comma-separated change request authors to include')
    .option('--labels <labels>', 'Comma-separated change request labels to filter by')
    .option(
      '--raw-filters <filters>',
      'Comma-separated raw filter string (e.g. status=draft,author=john)'
    )
    .option('--output <format>', 'Output format (text|json)', 'text')
    .option('--filter <name>', 'Apply a saved filter')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('ChangeRequestsCommand');
      try {
        const merged = await resolveSavedFilterOptions(command, 'change-requests', options);
        screen.printLine('📊 Generating change request summary...');
        const service = createChangeRequestsService(command);
        const filters = buildChangeRequestFilters(merged);
        const summary = await service.getSummary(filters);

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(summary, null, 2));
        } else {
          screen.printLine(`\n${formatChangeRequestSummary(summary.result)}`);
        }

        screen.printLine('\n✅ Summary generated');
      } catch (error) {
        logger.error('Failed to generate change request summary', error);
        process.exit(1);
      }
    });

  /**
   * smm change-requests by-month [options]
   * View change request metrics grouped by month
   */
  changeRequestsGroup
    .subcommand('by-month')
    .description('View change request metrics grouped by month')
    .option('--start-date <date>', 'Filter change requests created on or after this date')
    .option('--end-date <date>', 'Filter change requests created on or before this date')
    .option('--exclude-authors <authors>', 'Comma-separated change request authors to exclude')
    .option(
      '--exclude-commenters <commenters>',
      'Comma-separated change request commenters to exclude'
    )
    .option('--raw-filters <filters>', 'Comma-separated raw filter string')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('ChangeRequestsCommand');
      try {
        screen.printLine('📊 Analyzing change requests by month...');
        const service = createChangeRequestsService(command);
        const metrics = await service.getMetricsByMonth(buildChangeRequestFilters(options));

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(metrics, null, 2));
        } else {
          screen.printLine('\n=== Change Requests by Month ===\n');
          screen.printLine(JSON.stringify(metrics, null, 2));
        }

        screen.printLine('\n✅ Analysis completed');
      } catch (error) {
        logger.error('Failed to analyze change requests by month', error);
        process.exit(1);
      }
    });

  /**
   * smm change-requests by-week [options]
   * View change request metrics grouped by week
   */
  changeRequestsGroup
    .subcommand('by-week')
    .description('View change request metrics grouped by week')
    .option('--start-date <date>', 'Filter change requests created on or after this date')
    .option('--end-date <date>', 'Filter change requests created on or before this date')
    .option('--exclude-authors <authors>', 'Comma-separated change request authors to exclude')
    .option(
      '--exclude-commenters <commenters>',
      'Comma-separated change request commenters to exclude'
    )
    .option('--raw-filters <filters>', 'Comma-separated raw filter string')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('ChangeRequestsCommand');
      try {
        screen.printLine('📊 Analyzing change requests by week...');
        const service = createChangeRequestsService(command);
        const metrics = await service.getMetricsByWeek(buildChangeRequestFilters(options));

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(metrics, null, 2));
        } else {
          screen.printLine('\n=== Change Requests by Week ===\n');
          screen.printLine(JSON.stringify(metrics, null, 2));
        }

        screen.printLine('\n✅ Analysis completed');
      } catch (error) {
        logger.error('Failed to analyze change requests by week', error);
        process.exit(1);
      }
    });

  /**
   * smm change-requests through-time [options]
   * View change requests opened and closed through time
   */
  changeRequestsGroup
    .subcommand('through-time')
    .description('View change requests opened and closed through time (daily/weekly/monthly)')
    .option('--start-date <date>', 'Filter change requests created on or after this date')
    .option('--end-date <date>', 'Filter change requests created on or before this date')
    .option('--exclude-authors <authors>', 'Comma-separated change request authors to exclude')
    .option(
      '--exclude-commenters <commenters>',
      'Comma-separated change request commenters to exclude'
    )
    .option('--authors <authors>', 'Comma-separated change request authors to include')
    .option('--labels <labels>', 'Comma-separated change request labels to filter by')
    .option('--aggregate-by <period>', 'Aggregation period: day, week, or month (default: week)')
    .option('--raw-filters <filters>', 'Comma-separated raw filter string')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .option('--filter <name>', 'Apply a saved filter')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('ChangeRequestsCommand');
      try {
        const merged = await resolveSavedFilterOptions(command, 'change-requests', options);
        screen.printLine('📊 Analyzing change requests through time...');
        const service = createChangeRequestsService(command);
        const filters = buildChangeRequestFilters(merged);
        const rows = await service.getThroughTime(filters, options.aggregateBy);

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(rows, null, 2));
        } else {
          screen.printLine('\n=== Change Requests Through Time ===\n');
          for (const row of rows) {
            screen.printLine(`${row.date} | ${row.kind}: ${row.count}`);
          }
        }

        screen.printLine('\n✅ Analysis completed');
      } catch (error) {
        logger.error('Failed to analyze change requests through time', error);
        process.exit(1);
      }
    });

  /**
   * smm change-requests by-author [options]
   * View change requests grouped by author
   */
  changeRequestsGroup
    .subcommand('by-author')
    .description('View change requests grouped by author')
    .option('--start-date <date>', 'Filter change requests created on or after this date')
    .option('--end-date <date>', 'Filter change requests created on or before this date')
    .option('--exclude-authors <authors>', 'Comma-separated change request authors to exclude')
    .option(
      '--exclude-commenters <commenters>',
      'Comma-separated change request commenters to exclude'
    )
    .option('--authors <authors>', 'Comma-separated change request authors to include')
    .option('--labels <labels>', 'Comma-separated change request labels to filter by')
    .option('--top <number>', 'Show top N authors', '10')
    .option('--raw-filters <filters>', 'Comma-separated raw filter string')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('ChangeRequestsCommand');
      try {
        screen.printLine('📊 Analyzing change requests by author...');
        const service = createChangeRequestsService(command);
        const filters = buildChangeRequestFilters(options);
        const authors = await service.getByAuthor(filters, Number(options.top));

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(authors, null, 2));
        } else {
          screen.printLine('\n=== Change Requests by Author ===\n');
          for (const author of authors) {
            screen.printLine(`${author.author}: ${author.count} change requests`);
          }
        }

        screen.printLine('\n✅ Analysis completed');
      } catch (error) {
        logger.error('Failed to analyze change requests by author', error);
        process.exit(1);
      }
    });

  /**
   * smm change-requests review-time [options]
   * View review time by author with selectable statistical method
   */
  changeRequestsGroup
    .subcommand('review-time')
    .description('View review time (days) by author')
    .option('--start-date <date>', 'Filter change requests created on or after this date')
    .option('--end-date <date>', 'Filter change requests created on or before this date')
    .option('--exclude-authors <authors>', 'Comma-separated change request authors to exclude')
    .option(
      '--exclude-commenters <commenters>',
      'Comma-separated change request commenters to exclude'
    )
    .option('--authors <authors>', 'Comma-separated change request authors to include')
    .option('--labels <labels>', 'Comma-separated change request labels to filter by')
    .option('--top <number>', 'Show top N authors', '10')
    .option('--raw-filters <filters>', 'Comma-separated raw filter string')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .option(
      '--method <method>',
      'Statistical method: average, median, p75, p90, p95, min, max',
      'average'
    )
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
      const logger = command.getLogger('ChangeRequestsCommand');
      try {
        const metricMethod = normalizeMetricMethod(options.method);
        screen.printLine(`📊 Calculating ${metricMethod} review time...`);
        const service = createChangeRequestsService(command);
        const filters = buildChangeRequestFilters(options);
        const reviews = await service.getReviewTime(filters, Number(options.top), metricMethod);

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(reviews, null, 2));
        } else {
          screen.printLine(`\n=== ${metricMethod.toUpperCase()} Review Time by Author ===\n`);
          for (const review of reviews) {
            screen.printLine(
              `${review.author}: ${formatDuration(review.value, 'days')} (method: ${review.method})`
            );
            printOutliers(screen, review.outliers);
          }
        }

        screen.printLine('\n✅ Analysis completed');
      } catch (error) {
        logger.error('Failed to calculate review time', error);
        process.exit(1);
      }
    });

  /**
   * smm change-requests open-time [options]
   * View change request open time by period with selectable statistical method
   */
  changeRequestsGroup
    .subcommand('open-time')
    .description('View change request open time (days) aggregated by day/week/month')
    .option('--start-date <date>', 'Filter change requests created on or after this date')
    .option('--end-date <date>', 'Filter change requests created on or before this date')
    .option('--exclude-authors <authors>', 'Comma-separated change request authors to exclude')
    .option(
      '--exclude-commenters <commenters>',
      'Comma-separated change request commenters to exclude'
    )
    .option('--authors <authors>', 'Comma-separated change request authors to include')
    .option('--labels <labels>', 'Comma-separated change request labels to filter by')
    .option('--aggregate-by <period>', 'Aggregation period: day, week, or month (default: week)')
    .option('--raw-filters <filters>', 'Comma-separated raw filter string')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .option(
      '--method <method>',
      'Statistical method: average, median, p75, p90, p95, min, max',
      'average'
    )
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
      const logger = command.getLogger('ChangeRequestsCommand');
      try {
        const metricMethod = normalizeMetricMethod(options.method);
        screen.printLine(`📊 Calculating ${metricMethod} change request open time...`);
        const service = createChangeRequestsService(command);
        const filters = buildChangeRequestFilters(options);
        const periods = await service.getOpenTimeBy(filters, options.aggregateBy, metricMethod);

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(periods, null, 2));
        } else {
          screen.printLine(`\n=== ${metricMethod.toUpperCase()} Change Request Open Time ===\n`);
          for (const period of periods) {
            screen.printLine(
              `${period.period}: ${formatDuration(period.value, 'days')} (method: ${period.method})`
            );
            printOutliers(screen, period.outliers);
          }
        }

        screen.printLine('\n✅ Analysis completed');
      } catch (error) {
        logger.error('Failed to calculate change request open time', error);
        process.exit(1);
      }
    });

  /**
   * smm change-requests comments [options]
   * View comments per change request with selectable statistical method
   */
  changeRequestsGroup
    .subcommand('comments')
    .description('View number of comments per change request with selectable statistical method')
    .option('--start-date <date>', 'Filter change requests created on or after this date')
    .option('--end-date <date>', 'Filter change requests created on or before this date')
    .option('--exclude-authors <authors>', 'Comma-separated change request authors to exclude')
    .option(
      '--exclude-commenters <commenters>',
      'Comma-separated change request commenters to exclude'
    )
    .option('--authors <authors>', 'Comma-separated change request authors to include')
    .option('--labels <labels>', 'Comma-separated change request labels to filter by')
    .option(
      '--aggregate-by <period>',
      'Aggregation period: week or month. Shows per-period values.'
    )
    .option('--raw-filters <filters>', 'Comma-separated raw filter string')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .option(
      '--method <method>',
      'Statistical method: average, median, p75, p90, p95, min, max',
      'average'
    )
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
      const logger = command.getLogger('ChangeRequestsCommand');
      try {
        const metricMethod = normalizeMetricMethod(options.method);
        screen.printLine(`📊 Calculating ${metricMethod} comments per change request...`);
        const service = createChangeRequestsService(command);
        const filters = buildChangeRequestFilters(options);

        if (options.aggregateBy) {
          const mode = options.aggregateBy.toLowerCase();
          const timeframes =
            mode === 'month'
              ? await service.getMetricsByMonth(filters, metricMethod)
              : await service.getMetricsByWeek(filters, metricMethod);

          if (options.output === 'json') {
            screen.printLine(JSON.stringify(timeframes, null, 2));
          } else {
            screen.printLine(
              `\n=== ${metricMethod.toUpperCase()} Comments per change request by ${mode} ===\n`
            );
            for (const tf of timeframes) {
              screen.printLine(
                `${tf.period}: ${tf.comments} (${tf.count} change requests, method: ${tf.method})`
              );
              printOutliers(screen, tf.outliers?.comments);
            }
          }
        } else {
          const metrics = await service.getMetrics(filters, metricMethod);

          if (options.output === 'json') {
            screen.printLine(
              JSON.stringify(
                {
                  comments: metrics.comments,
                  method: metrics.method,
                  outliers: metrics.outliers?.comments,
                },
                null,
                2
              )
            );
          } else {
            screen.printLine(
              `\n=== ${metricMethod.toUpperCase()} Comments per change request ===\n`
            );
            screen.printLine(
              `${metricMethod.charAt(0).toUpperCase() + metricMethod.slice(1)} Comments: ${metrics.comments}`
            );
            printOutliers(screen, metrics.outliers?.comments);
          }
        }

        screen.printLine('\n✅ Analysis completed');
      } catch (error) {
        logger.error('Failed to calculate comments', error);
        process.exit(1);
      }
    });
}
