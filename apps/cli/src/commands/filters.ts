import type { SmmCommand } from './smm-command';
import type { DashboardFilters, DashboardSection } from '@smmachine/core';
import { defaultFilters } from '@smmachine/core';
import { listFilters, saveFilter, showFilter, deleteFilter } from './helpers/filter-helper';

const VALID_SECTIONS: DashboardSection[] = [
  'pipelines',
  'pull-requests',
  'source-code',
  'engineering-health',
  'architecture',
  'sonarqube',
  'insights',
];

function parseSection(value: string): DashboardSection {
  if (VALID_SECTIONS.includes(value as DashboardSection)) {
    return value as DashboardSection;
  }
  throw new Error(`Invalid section: ${value}. Must be one of: ${VALID_SECTIONS.join(', ')}`);
}

function buildFiltersFromOptions(options: Record<string, unknown>): DashboardFilters {
  return {
    ...defaultFilters,
    startDate: (options.startDate as string) ?? '',
    endDate: (options.endDate as string) ?? '',
    workflowSelector: options.workflowSelector as string | undefined,
    workflowStatus: parseArrayOption(options.workflowStatus),
    workflowConclusions: parseArrayOption(options.workflowConclusions),
    jobSelector: parseArrayOption(options.jobSelector),
    branch: parseArrayOption(options.branch),
    event: parseArrayOption(options.event),
    authorSelect: parseArrayOption(options.authorSelect),
    excludeAuthorSelect: parseArrayOption(options.excludeAuthorSelect),
    excludeCommenterSelect: parseArrayOption(options.excludeCommenterSelect),
    labelSelector: parseArrayOption(options.labelSelector),
    pullRequestStatus:
      (options.pullRequestStatus as DashboardFilters['pullRequestStatus']) ||
      defaultFilters.pullRequestStatus,
    aggregateBy: (options.aggregateBy as string) ?? defaultFilters.aggregateBy,
    weekends: (options.weekends as DashboardFilters['weekends']) ?? defaultFilters.weekends,
    outlierMode:
      (options.outlierMode as DashboardFilters['outlierMode']) ?? defaultFilters.outlierMode,
    rawFilters: (options.rawFilters as string) ?? '',
    metric: options.metric as string | undefined,
    category: options.category as string | undefined,
    compareStartDate: (options.compareStartDate as string) ?? '',
    compareEndDate: (options.compareEndDate as string) ?? '',
    period: (options.period as DashboardFilters['period']) ?? defaultFilters.period,
    ignorePatternFiles: (options.ignorePatternFiles as string) ?? '',
    includePatternFiles: (options.includePatternFiles as string) ?? '',
    authorSelectSourceCode: parseArrayOption(options.authorSelectSourceCode),
    topEntries:
      typeof options.topEntries === 'number'
        ? options.topEntries
        : Number(options.topEntries) || defaultFilters.topEntries,
    typeChurn: (options.typeChurn as string) ?? defaultFilters.typeChurn,
    aggregateMetric: (options.aggregateMetric as string) ?? defaultFilters.aggregateMetric,
    sonarqubeRemoveFolders:
      options.sonarqubeRemoveFolders !== undefined
        ? options.sonarqubeRemoveFolders === 'true' || options.sonarqubeRemoveFolders === true
        : defaultFilters.sonarqubeRemoveFolders,
    timezone: (options.timezone as string) ?? '',
  };
}

function parseArrayOption(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value === 'string' && value.length > 0) {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function formatEntryLine(
  index: number,
  entry: { id: string; name: string; section: string; repository: string; createdAt: string }
): string {
  const repo = entry.repository || '(none)';
  return `${index + 1}. [${entry.section}] ${entry.name}  repository: ${repo}  created: ${entry.createdAt}`;
}

export function createFiltersCommands(program: SmmCommand): void {
  const filtersGroup = program.subcommand('filters').description('Manage saved filters');

  filtersGroup
    .subcommand('list')
    .description('List saved filters')
    .option('--section <section>', 'Filter by section (pipelines, pull-requests, etc.)')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (options, command) => {
      const screen = command.getScreen();

      try {
        const section = options.section ? parseSection(options.section) : undefined;
        const entries = await listFilters(command, section);

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(entries, null, 2));
          return;
        }

        if (entries.length === 0) {
          screen.printLine('No saved filters found.');
          return;
        }

        screen.printLine('\nSaved Filters:');
        for (let i = 0; i < entries.length; i += 1) {
          screen.printLine(formatEntryLine(i, entries[i]));
        }
      } catch (error) {
        screen.printLine(
          `Error: ${error instanceof Error ? error.message : 'Failed to list filters'}`
        );
        process.exit(1);
      }
    });

  filtersGroup
    .subcommand('save <name>')
    .description('Save current filter options as a named filter')
    .requiredOption(
      '--section <section>',
      'Section for the filter (pipelines, pull-requests, etc.)'
    )
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--workflow-selector <name>', 'Workflow name filter')
    .option('--job-selector <name>', 'Job name filter')
    .option('--branch <branches>', 'Branch filter (comma-separated)')
    .option('--authors <authors>', 'Authors filter (comma-separated)')
    .option('--exclude-authors <authors>', 'Authors to exclude (comma-separated)')
    .option('--exclude-commenters <commenters>', 'Commenters to exclude (comma-separated)')
    .option('--labels <labels>', 'Labels filter (comma-separated)')
    .option('--pull-request-status <status>', 'PR status (open|closed|merged|draft)')
    .option('--aggregate-by <period>', 'Aggregation period (day|week|month)')
    .option('--weekends <mode>', 'Weekend handling (include|exclude|weekends_only)')
    .option('--outlier-mode <mode>', 'Outlier handling (include|flag|exclude)')
    .option('--raw-filters <filters>', 'Raw provider filters')
    .option('--ignore-pattern-files <pattern>', 'Files to ignore')
    .option('--include-pattern-files <pattern>', 'Files to include')
    .option('--top-entries <number>', 'Top N entries')
    .option('--type-churn <type>', 'Churn type')
    .option('--metric <metric>', 'Engineering health metric')
    .option('--category <category>', 'Engineering health category')
    .option('--compare-start-date <date>', 'Comparison start date')
    .option('--compare-end-date <date>', 'Comparison end date')
    .option('--period <period>', 'Time period (day|week|month)')
    .option('--sonarqube-remove-folders', 'Remove folder prefix in SonarQube')
    .option('--timezone <tz>', 'Timezone (e.g., America/Sao_Paulo)')
    .actionWithSmm(async (name: string, options, command) => {
      const screen = command.getScreen();

      try {
        const section = parseSection(options.section);
        const filters = buildFiltersFromOptions(options);
        const repository = command.getConfiguration().githubRepository ?? '';

        const entry = await saveFilter(command, section, name, filters, repository);

        screen.printLine(`Saved filter: "${entry.name}" [${entry.section}]`);
        screen.printLine(`ID: ${entry.id}`);
      } catch (error) {
        screen.printLine(
          `Error: ${error instanceof Error ? error.message : 'Failed to save filter'}`
        );
        process.exit(1);
      }
    });

  filtersGroup
    .subcommand('show <name>')
    .description('Show details of a saved filter')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (name: string, options, command) => {
      const screen = command.getScreen();

      try {
        const entry = await showFilter(command, name);

        if (!entry) {
          screen.printLine(`Filter "${name}" not found.`);
          return;
        }

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(entry, null, 2));
          return;
        }

        screen.printLine(`\nFilter: ${entry.name}`);
        screen.printLine(`Section: ${entry.section}`);
        screen.printLine(`Repository: ${entry.repository || '(none)'}`);
        screen.printLine(`Created: ${entry.createdAt}`);
        screen.printLine(`ID: ${entry.id}`);
        screen.printLine('\nFilter values:');

        const f = entry.filters;
        screen.printLine(`  startDate: ${f.startDate || '(none)'}`);
        screen.printLine(`  endDate: ${f.endDate || '(none)'}`);
        screen.printLine(`  workflowSelector: ${f.workflowSelector || '(none)'}`);
        screen.printLine(`  jobSelector: ${f.jobSelector.join(', ') || '(none)'}`);
        screen.printLine(`  authorSelect: ${f.authorSelect.join(', ') || '(none)'}`);
        screen.printLine(`  excludeAuthorSelect: ${f.excludeAuthorSelect.join(', ') || '(none)'}`);
        screen.printLine(
          `  excludeCommenterSelect: ${f.excludeCommenterSelect.join(', ') || '(none)'}`
        );
        screen.printLine(`  labelSelector: ${f.labelSelector.join(', ') || '(none)'}`);
        screen.printLine(`  pullRequestStatus: ${f.pullRequestStatus || '(none)'}`);
        screen.printLine(`  aggregateBy: ${f.aggregateBy}`);
        screen.printLine(`  weekends: ${f.weekends}`);
        screen.printLine(`  outlierMode: ${f.outlierMode}`);
        screen.printLine(`  rawFilters: ${f.rawFilters || '(none)'}`);
        screen.printLine(`  ignorePatternFiles: ${f.ignorePatternFiles || '(none)'}`);
        screen.printLine(`  includePatternFiles: ${f.includePatternFiles || '(none)'}`);
        screen.printLine(`  topEntries: ${f.topEntries}`);
        screen.printLine(`  typeChurn: ${f.typeChurn || '(none)'}`);
        screen.printLine(`  metric: ${f.metric || '(none)'}`);
        screen.printLine(`  category: ${f.category || '(none)'}`);
        screen.printLine(`  compareStartDate: ${f.compareStartDate || '(none)'}`);
        screen.printLine(`  compareEndDate: ${f.compareEndDate || '(none)'}`);
        screen.printLine(`  period: ${f.period}`);
        screen.printLine(`  aggregateMetric: ${f.aggregateMetric}`);
        screen.printLine(`  sonarqubeRemoveFolders: ${f.sonarqubeRemoveFolders}`);
        screen.printLine(`  timezone: ${f.timezone || '(none)'}`);
      } catch (error) {
        screen.printLine(
          `Error: ${error instanceof Error ? error.message : 'Failed to show filter'}`
        );
        process.exit(1);
      }
    });

  filtersGroup
    .subcommand('delete <name>')
    .description('Delete a saved filter by name or ID')
    .actionWithSmm(async (name: string, _options, command) => {
      const screen = command.getScreen();

      try {
        const deleted = await deleteFilter(command, name);

        if (!deleted) {
          screen.printLine(`Filter "${name}" not found.`);
          return;
        }

        screen.printLine(`Deleted filter: "${name}"`);
      } catch (error) {
        screen.printLine(
          `Error: ${error instanceof Error ? error.message : 'Failed to delete filter'}`
        );
        process.exit(1);
      }
    });
}
