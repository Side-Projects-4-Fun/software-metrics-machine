import * as fs from 'fs';
import {
  Configuration,
  JsonFileSystemRepository,
  RepositoryFactory,
  SqliteRepository,
} from '@smmachine/core';
import type { SmmCommand } from './smm-command';
type JsonObject = Record<string, unknown>;

type MigrationStore = {
  label: string;
  filePath: string;
  mode: 'array' | 'singleton';
};

/**
 * Tools Command Group
 *
 * Provides CLI utility commands matching Python CLI functionality.
 *
 * Commands:
 *   smm tools json-merge   Merge multiple JSON files
 */
export function createToolsCommands(program: SmmCommand): void {
  const toolsGroup = program.subcommand('tools').description('Utility tools');
  const screen = program.getScreen();

  /**
   * smm tools json-merge [options]
   * Merge multiple JSON files into one
   */
  toolsGroup
    .subcommand('json-merge')
    .description('Merge multiple JSON files into one')
    .option('--input <pattern>', 'Input file pattern (glob)', '*.json')
    .option('--output <file>', 'Output file path', 'merged.json')
    .option('--pretty', 'Pretty print the output JSON')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('ToolsCommand');
      try {
        screen.printLine('🔄 Merging JSON files...');

        const inputPattern = options.input;
        const outputFile = options.output;

        // For simplicity, we'll just merge files from current directory
        // In a full implementation, use glob pattern matching
        const files = fs
          .readdirSync('.')
          .filter((file) => file.endsWith('.json') && file !== outputFile);

        if (files.length === 0) {
          screen.printLine(`⚠️  No JSON files found matching pattern: ${inputPattern}`);
          return;
        }

        screen.printLine(`📁 Found ${files.length} JSON files to merge`);

        const merged: JsonObject = {};
        let isArray = false;
        const arrays: unknown[] = [];

        for (const file of files) {
          try {
            const content = fs.readFileSync(file, 'utf-8');
            const data = JSON.parse(content);

            if (Array.isArray(data)) {
              isArray = true;
              arrays.push(...data);
            } else {
              Object.assign(merged, data as JsonObject);
            }

            screen.printLine(`  ✅ Merged: ${file}`);
          } catch (error) {
            screen.printLine(`  ❌ Failed to merge: ${file} - ${error}`);
          }
        }

        const result = isArray ? arrays : merged;
        const output = options.pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result);

        fs.writeFileSync(outputFile, output, 'utf-8');

        screen.printLine(`\n✅ Merged JSON saved to: ${outputFile}`);
        screen.printLine(`   Total items: ${isArray ? arrays.length : Object.keys(merged).length}`);
      } catch (error) {
        logger.error('Failed to merge JSON files', error);
        process.exit(1);
      }
    });

  toolsGroup
    .subcommand('migrate')
    .description('Migrate persisted metric data between storage backends')
    .requiredOption('--from <storage>', 'Source storage backend')
    .requiredOption('--to <storage>', 'Target storage backend')
    .actionWithSmm(async (options, command) => {
      const logger = command.getLogger('ToolsMigrateCommand');
      try {
        if (options.from !== 'json' || options.to !== 'sqlite') {
          throw new Error('Only --from=json --to=sqlite is supported at this time.');
        }

        const config = command.getConfiguration();
        const stores = getPipelineMigrationStores(config);
        const sqliteDbPath = RepositoryFactory.getSqliteDatabasePath(config);

        screen.printLine('🔄 Migrating pipeline storage from JSON to SQLite...');
        screen.printLine(`   SQLite database: ${sqliteDbPath}`);

        let migratedStores = 0;
        let migratedRecords = 0;

        for (const store of stores) {
          const source = new JsonFileSystemRepository<unknown>(store.filePath, logger);
          if (!(await source.exists())) {
            screen.printLine(`  ⚠️  Skipped ${store.label}: ${store.filePath} does not exist`);
            continue;
          }

          const namespace = RepositoryFactory.getSqliteNamespace(store.filePath, config);
          const target = new SqliteRepository<unknown>(sqliteDbPath, namespace, logger);

          if (store.mode === 'array') {
            const items = await source.loadAll();
            await target.saveAll(items);
            migratedRecords += items.length;
            screen.printLine(`  ✅ Migrated ${store.label}: ${items.length} records`);
          } else {
            const item = await source.load();
            if (item === null) {
              screen.printLine(`  ⚠️  Skipped ${store.label}: empty source`);
              continue;
            }

            await target.save(item);
            migratedRecords += 1;
            screen.printLine(`  ✅ Migrated ${store.label}: 1 record`);
          }

          migratedStores += 1;
        }

        screen.printLine(
          `\n✅ Migration complete: ${migratedRecords} records across ${migratedStores} pipeline stores`
        );
      } catch (error) {
        logger.error('Failed to migrate storage', error);
        screen.printLine(
          `❌ Migration failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });
}

function getPipelineMigrationStores(config: Configuration): MigrationStore[] {
  const providerPath = config.getPathFromGitProvider();

  return [
    {
      label: 'workflow runs',
      filePath: `${providerPath}/workflows.json`,
      mode: 'array',
    },
    {
      label: 'workflow jobs',
      filePath: `${providerPath}/jobs.json`,
      mode: 'array',
    },
    {
      label: 'pipeline filter options',
      filePath: `${providerPath}/pipeline-filter-options.json`,
      mode: 'singleton',
    },
  ];
}
