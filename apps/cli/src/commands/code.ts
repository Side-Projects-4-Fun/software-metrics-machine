import type { SmmCommand } from './smm-command';
import {
  BigOService,
  CodemaatFactory,
  CodemaatService,
  GitFactory,
  PairingFactory,
} from '@smmachine/core';
import { TimeZoneProvider } from '@smmachine/core/infrastructure/timezone-provider';
import type { CodeChurn } from '@smmachine/core/providers/codemaat/types';
import path from 'path';

export function createCodeCommands(program: SmmCommand): void {
  const codeGroup = program.subcommand('code').description('Code analysis operations');
  const screen = program.getScreen();

  codeGroup
    .subcommand('big-o')
    .description('Analyze Big O complexity risk for source files')
    .option('--search <text>', 'Filter files by repository-relative path')
    .option('--ignore-files <patterns>', 'Comma-separated repository-relative patterns to ignore')
    .option('--include-only <patterns>', 'Comma-separated repository-relative patterns to include')
    .option('--file <path>', 'Show line-level Big O analysis for a repository-relative file')
    .option('--limit <number>', 'Maximum files to analyze when listing summaries', '200')
    .option('--output <format>', 'Output format (text|json|csv)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('CodeCommand');
      try {
        const service = new BigOService(command.getConfiguration());

        if (options.file) {
          const analysis = await service.analyzeFile(options.file);

          if (options.output === 'json') {
            screen.printLine(JSON.stringify(analysis, null, 2));
            return;
          }

          if (options.output === 'csv') {
            const rows = ['line_number,classification,reason,content'];
            for (const line of analysis.lines) {
              rows.push(
                [
                  line.lineNumber,
                  line.classification,
                  line.reason,
                  `"${line.content.replace(/"/g, '""')}"`,
                ].join(',')
              );
            }
            screen.printLine(rows.join('\n'));
            return;
          }

          screen.printLine('\n=== Big O File Analysis ===\n');
          screen.printLine(`File: ${analysis.filePath}`);
          screen.printLine(`Classification: ${analysis.classification}`);
          screen.printLine(
            `Score: ${analysis.score}${analysis.needsHelp ? ' (needs performance attention)' : ''}`
          );
          screen.printLine('\nClassified lines:');
          for (const line of analysis.lines) {
            screen.printLine(
              `- ${line.lineNumber}: ${line.classification} (${line.reason}) ${line.content.trim()}`
            );
          }
          return;
        }

        const files = await service.listFiles({
          search: options.search,
          ignorePatterns: options.ignoreFiles,
          includePatterns: options.includeOnly,
          limit: Number(options.limit),
        });

        if (options.output === 'json') {
          screen.printLine(JSON.stringify({ files }, null, 2));
          return;
        }

        if (options.output === 'csv') {
          const rows = ['file_path,classification,score,needs_help'];
          for (const file of files) {
            rows.push(
              [
                `"${file.filePath.replace(/"/g, '""')}"`,
                file.classification,
                file.score,
                file.needsHelp,
              ].join(',')
            );
          }
          screen.printLine(rows.join('\n'));
          return;
        }

        screen.printLine('\n=== Big O Source File Analysis ===\n');
        screen.printLine(`Files analyzed: ${files.length}`);
        for (const file of files) {
          const help = file.needsHelp ? ' needs performance attention' : '';
          screen.printLine(
            `- ${file.filePath}: ${file.classification}, score ${file.score}${help}`
          );
        }
      } catch (error) {
        logger.error('Failed to analyze Big O complexity', error);
        process.exit(1);
      }
    });

  codeGroup
    .subcommand('summary')
    .description('View code summary with pairing insights')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--output <format>', 'Output format (text|json|csv)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('CodeCommand');
      try {
        screen.printLine('📊 Generating code summary...');

        const config = command.getConfiguration();
        const pairingService = PairingFactory.create(
          config,
          logger,
          new TimeZoneProvider(config.timezone)
        );
        const summary = await pairingService.getPairingIndex({
          startDate: options.startDate,
          endDate: options.endDate,
        });

        if (options.output === 'json') {
          screen.printLine(JSON.stringify(summary, null, 2));
          return;
        }

        if (options.output === 'csv') {
          const lines: string[] = ['section,metric,value'];
          lines.push(`pairing,pairing_index_percentage,${summary.pairingIndexPercentage ?? 0}`);
          lines.push(`pairing,total_analyzed_commits,${summary.totalAnalyzedCommits ?? 0}`);
          lines.push(`pairing,paired_commits,${summary.pairedCommits ?? 0}`);

          for (const pair of summary.topPairings || []) {
            lines.push(`top_pair,${pair.author} + ${pair.coAuthor},${pair.pairedCommits}`);
          }

          for (const commit of summary.latestPairedCommits || []) {
            const normalizedSubject = (commit.subject || '').replace(/,/g, ';');
            const normalizedCoAuthors = (commit.coAuthors || []).join('|').replace(/,/g, ';');
            lines.push(
              `latest_paired_commit,${commit.hash.slice(0, 8)}:${normalizedSubject},${commit.author}|${normalizedCoAuthors}`
            );
          }

          screen.printLine(lines.join('\n'));
          return;
        }

        screen.printLine('\n=== Code Summary ===\n');
        screen.printLine(`Pairing Index: ${summary.pairingIndexPercentage ?? 0}%`);
        screen.printLine(`Total Commits: ${summary.totalAnalyzedCommits ?? 0}`);
        screen.printLine(`Paired Commits: ${summary.pairedCommits ?? 0}`);

        if (summary.topPairings && summary.topPairings.length > 0) {
          screen.printLine('\nWho paired the most with whom:');
          for (const pair of summary.topPairings) {
            screen.printLine(`- ${pair.author} + ${pair.coAuthor}: ${pair.pairedCommits}`);
          }
        }

        if (summary.latestPairedCommits && summary.latestPairedCommits.length > 0) {
          screen.printLine('\nLatest 20 paired commits:');
          for (const commit of summary.latestPairedCommits) {
            const date = new Date(commit.timestamp).toISOString();
            screen.printLine(`- ${commit.hash.slice(0, 8)} ${date}`);
            screen.printLine(`  Author: ${commit.author}`);
            screen.printLine(`  Co-authors: ${commit.coAuthors.join(', ')}`);
            screen.printLine(`  Subject: ${commit.subject || '(no subject)'}`);
          }
        }

        screen.printLine('\n✅ Summary generated');
      } catch (error) {
        logger.error('Failed to generate code summary', error);
        process.exit(1);
      }
    });

  codeGroup
    .subcommand('fetch-commits')
    .description('Analyze change sets from git repository')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--authors <list>', 'Comma-separated list of authors to filter')
    .option('--force', 'Force refetch commits from git and bypass cache')
    .option('--buffer <size>', 'Max buffer size in MB for git output (default: 100)', '100')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('CodeCommand');
      try {
        screen.printLine('🔍 Analyzing change sets...');
        const config = command.getConfiguration();
        const repoPath = config.gitRepositoryLocation;

        const factory = GitFactory.create(config, logger);

        const result = await factory.fetchCommits({
          startDate: options.startDate,
          endDate: options.endDate,
          forceRefresh: options.force,
          maxBuffer: Number(options.buffer),
        });
        const commits = result;

        if (options.output === 'json') {
          screen.printLine(JSON.stringify({ commits: commits.length }, null, 2));
        } else {
          screen.printLine('\n=== Change Set Analysis ===\n');
          screen.printLine(`Repository: ${repoPath}`);
          screen.printLine(`Total Commits: ${commits.length}`);
          if (options.startDate) screen.printLine(`Start Date: ${options.startDate}`);
          if (options.endDate) screen.printLine(`End Date: ${options.endDate}`);
        }
      } catch (error) {
        const isMaxBufferError = error instanceof Error && error.message.includes('maxBuffer');

        if (isMaxBufferError) {
          logger.error(
            `The git output exceeded the buffer limit. ` +
              `Try increasing it with: --buffer <larger_number_in_MB>`
          );
        } else {
          logger.error('Failed to analyze change sets', error);
        }
        process.exit(1);
      }
    });

  codeGroup
    .subcommand('codemaat-fetch')
    .description('Fetch CodeMaat CSV data from the git repository')
    .requiredOption('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--subfolder <path>', 'Subfolder within the repository to analyze', '')
    .option('--force', 'Force regeneration of CodeMaat CSV files')
    .option('--output <format>', 'Output format (text|json)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('CodeCommand');
      try {
        screen.printLine('🔍 Running CodeMaat analysis...');
        const config = command.getConfiguration();
        const fetchRepository = CodemaatFactory.createWriteRepository(config, logger);
        const result = fetchRepository.fetch({
          startDate: options.startDate,
          subfolder: options.subfolder,
          force: options.force,
          scriptPath:
            process.env.SMM_DEV_MODE === 'true'
              ? path.resolve(__dirname, '../../fetch-codemaat.sh')
              : undefined,
        });

        if (options.output === 'json') {
          screen.printLine(
            JSON.stringify(
              {
                repository: result.repository,
                outputDirectory: result.outputDirectory,
                stdout: result.stdout,
              },
              null,
              2
            )
          );
        } else {
          screen.printLine('\n=== CodeMaat Fetch ===\n');
          screen.printLine(`Repository: ${result.repository}`);
          screen.printLine(`Output Directory: ${result.outputDirectory}`);
          screen.printLine(result.stdout.trimEnd());
        }

        if (result.persistedRecords !== undefined) {
          screen.printLine(`Persisted CodeMaat metrics: ${result.persistedRecords} records`);
        }
      } catch (error) {
        logger.error('Failed to run CodeMaat analysis', error);
        process.exit(1);
      }
    });

  codeGroup
    .subcommand('churn')
    .description('Calculate code churn metrics')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--authors <list>', 'Comma-separated list of authors to filter')
    .option('--output <format>', 'Output format (text|json|csv)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('CodeCommand');
      try {
        screen.printLine('📊 Calculating code churn...');
        const repository = CodemaatFactory.create(command.getConfiguration(), logger);
        const codemaatService = new CodemaatService(repository);
        const metrics = await codemaatService.getCodeChurn({
          startDate: options.startDate,
          endDate: options.endDate,
        });
        const churnRows = metrics.data;
        const totalCommits = churnRows.reduce(
          (sum: number, row: CodeChurn) => sum + (row.commits || 0),
          0
        );
        const linesAdded = churnRows.reduce(
          (sum: number, row: CodeChurn) => sum + (row.added || 0),
          0
        );
        const linesRemoved = churnRows.reduce(
          (sum: number, row: CodeChurn) => sum + (row.deleted || 0),
          0
        );

        if (options.output === 'json') {
          screen.printLine(JSON.stringify({ codeChurn: churnRows }, null, 2));
        } else {
          screen.printLine('\n=== Code Churn Metrics ===\n');
          screen.printLine(`Data Points: ${churnRows.length}`);
          screen.printLine(`Total Commits: ${totalCommits}`);
          screen.printLine(`Lines Added: ${linesAdded}`);
          screen.printLine(`Lines Removed: ${linesRemoved}`);
          screen.printLine(`Churn: ${linesAdded + linesRemoved}`);
        }
      } catch (error) {
        logger.error('Failed to calculate code churn', error);
        process.exit(1);
      }
    });

  codeGroup
    .subcommand('coupling')
    .description('Analyze code coupling between modules')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--min-coupling <number>', 'Minimum coupling threshold', '0.3')
    .option('--output <format>', 'Output format (text|json|csv)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('CodeCommand');
      try {
        screen.printLine('🔗 Analyzing code coupling...');
        const repository = CodemaatFactory.create(command.getConfiguration(), logger);
        const codemaatService = new CodemaatService(repository);
        const coupling = await codemaatService.getFileCoupling({
          ignorePatterns: undefined,
        });

        if (options.output === 'json') {
          screen.printLine(JSON.stringify({ coupling }, null, 2));
        } else {
          screen.printLine('\n=== Code Coupling Analysis ===\n');
          screen.printLine(`Min Coupling Threshold: ${options.minCoupling}`);
          screen.printLine(`Relationships: ${coupling.length}`);
        }
      } catch (error) {
        logger.error('Failed to analyze code coupling', error);
        process.exit(1);
      }
    });

  codeGroup
    .subcommand('entity-churn')
    .description('Calculate entity-level churn metrics')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--top <number>', 'Show top N entities', '20')
    .option('--output <format>', 'Output format (text|json|csv)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('CodeCommand');
      try {
        screen.printLine('📊 Calculating entity churn...');
        const repository = CodemaatFactory.create(command.getConfiguration(), logger);
        const codemaatService = new CodemaatService(repository);
        const metrics = await codemaatService.getCodeChurn({
          startDate: options.startDate,
          endDate: options.endDate,
        });
        const churnRows = metrics.data;
        const totalChurn = churnRows.reduce(
          (sum: number, row: CodeChurn) => sum + (row.added || 0) + (row.deleted || 0),
          0
        );

        if (options.output === 'json') {
          screen.printLine(JSON.stringify({ codeChurn: churnRows }, null, 2));
        } else {
          screen.printLine('\n=== Entity Churn Metrics ===\n');
          screen.printLine(`Top Entities: ${options.top}`);
          screen.printLine(`Total Churn: ${totalChurn}`);
        }
      } catch (error) {
        logger.error('Failed to calculate entity churn', error);
        process.exit(1);
      }
    });

  codeGroup
    .subcommand('entity-effort')
    .description('Calculate entity effort metrics')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--top <number>', 'Show top N entities', '20')
    .option('--output <format>', 'Output format (text|json|csv)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('CodeCommand');
      try {
        screen.printLine('⏱️  Calculating entity effort...');
        const repository = CodemaatFactory.create(command.getConfiguration(), logger);
        const codemaatService = new CodemaatService(repository);
        const maxRows = Number(options.top);
        const metrics = await codemaatService.getEntityEffort({
          top: Number.isFinite(maxRows) ? maxRows : undefined,
        });

        if (options.output === 'json') {
          screen.printLine(JSON.stringify({ entityEffort: metrics || [] }, null, 2));
        } else {
          screen.printLine('\n=== Entity Effort Metrics ===\n');
          screen.printLine(`Top Entities: ${metrics.length}`);
        }
      } catch (error) {
        logger.error('Failed to calculate entity effort', error);
        process.exit(1);
      }
    });

  codeGroup
    .subcommand('entity-ownership')
    .description('Analyze entity ownership by developers')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--entity <path>', 'Specific entity/file to analyze')
    .option('--output <format>', 'Output format (text|json|csv)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('CodeCommand');
      try {
        screen.printLine('👥 Analyzing entity ownership...');
        const repository = CodemaatFactory.create(command.getConfiguration(), logger);
        const codemaatService = new CodemaatService(repository);
        const metrics = await codemaatService.getEntityOwnership({
          authors: undefined,
          top: 100,
        });
        const filteredMetrics = options.entity
          ? metrics.filter((row) => row.entity.includes(options.entity))
          : metrics;

        if (options.output === 'json') {
          screen.printLine(JSON.stringify({ ownership: filteredMetrics }, null, 2));
        } else {
          screen.printLine('\n=== Entity Ownership Analysis ===\n');
          if (options.entity) {
            screen.printLine(`Entity: ${options.entity}`);
          }
          screen.printLine(`Ownership Records: ${filteredMetrics.length}`);
        }
      } catch (error) {
        logger.error('Failed to analyze entity ownership', error);
        process.exit(1);
      }
    });

  codeGroup
    .subcommand('pairing-index')
    .description('Calculate developer pairing index')
    .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
    .option('--end-date <date>', 'End date (YYYY-MM-DD)')
    .option('--min-shared <number>', 'Minimum shared commits', '2')
    .option('--output <format>', 'Output format (text|json|csv)', 'text')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('CodeCommand');
      try {
        screen.printLine('👥 Calculating developer pairing index...');
        const config = command.getConfiguration();
        const pairingService = PairingFactory.create(
          config,
          logger,
          new TimeZoneProvider(config.timezone)
        );
        const pairing = await pairingService.getPairingIndex({
          startDate: options.startDate,
          endDate: options.endDate,
        });

        if (options.output === 'json') {
          screen.printLine(JSON.stringify({ pairingIndex: pairing }, null, 2));
        } else {
          screen.printLine('\n\n=== Developer Pairing Index ===\n');
          screen.printLine(`Min Shared Commits: ${options.minShared}`);
          screen.printLine(`Pairing Index: ${pairing.pairingIndexPercentage ?? 0}%`);
          screen.printLine(`Total Commits: ${pairing.totalAnalyzedCommits ?? 0}`);
          screen.printLine(`Paired Commits: ${pairing.pairedCommits ?? 0}`);
        }
      } catch (error) {
        logger.error('Failed to calculate pairing index', error);
        process.exit(1);
      }
    });
}
