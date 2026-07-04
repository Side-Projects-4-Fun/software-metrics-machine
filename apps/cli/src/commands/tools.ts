import * as fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import {
  CodemaatFactory,
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
  sqliteNamespace?: string;
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

        const configs = getJsonToSqliteMigrationConfigurations(command);

        screen.printLine('🔄 Migrating storage from JSON to SQLite...');
        screen.printLine(`   Projects: ${configs.length}`);

        let migratedStores = 0;
        let migratedRecords = 0;

        for (const config of configs) {
          const stores = getJsonToSqliteMigrationStores(config);
          const sqliteDbPath = RepositoryFactory.getSqliteDatabasePath(config);
          const projectLabel = config.githubRepository || config.getBaseDirectory();

          screen.printLine(`\n📦 Project: ${projectLabel}`);
          screen.printLine(`   SQLite database: ${sqliteDbPath}`);

          await new SqliteRepository<unknown>(
            sqliteDbPath,
            '__migration_metadata__',
            logger
          ).initialize();

          for (const store of stores) {
            const source = new JsonFileSystemRepository<unknown>(store.filePath, logger);
            if (!(await source.exists())) {
              screen.printLine(`  ⚠️  Skipped ${store.label}: ${store.filePath} does not exist`);
              continue;
            }

            const namespace =
              store.sqliteNamespace || RepositoryFactory.getSqliteNamespace(store.filePath, config);
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

          removeLegacyPipelineSqliteNamespaces(config, sqliteDbPath);

          const codemaatRepository = CodemaatFactory.createWriteRepositoryForStorage(
            config,
            logger,
            options.to
          );
          const codemaatPersistence = await codemaatRepository.persistFetchedMetrics();
          migratedRecords += codemaatPersistence.records;
          if (codemaatPersistence.records > 0) {
            migratedStores += 1;
          }
          screen.printLine(
            `  ✅ Migrated CodeMaat metrics: ${codemaatPersistence.records} records`
          );
        }

        screen.printLine(
          `\n✅ Migration complete: ${migratedRecords} records across ${migratedStores} stores`
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

function getJsonToSqliteMigrationConfigurations(command: SmmCommand): Configuration[] {
  if (command.getSelectedProject()) {
    return [command.getConfiguration()];
  }

  const configurationRepository = command.getConfigurationRepository();
  const projects = configurationRepository.getAllProjects();

  if (projects.length === 0) {
    return [configurationRepository.getActiveConfiguration()];
  }

  return projects.map((project) => configurationRepository.fromProjectConfig(project));
}

function getJsonToSqliteMigrationStores(config: Configuration): MigrationStore[] {
  const providerPath = config.getPathFromGitProvider();
  const gitPath = config.getGitPath();
  const sonarqubePath = config.getSonarqubePath();

  return [
    {
      label: 'commits',
      filePath: `${gitPath}/commits.json`,
      mode: 'array',
    },
    {
      label: 'workflow runs',
      filePath: `${providerPath}/workflows.json`,
      sqliteNamespace: RepositoryFactory.getPipelineRunsSqliteNamespace(config),
      mode: 'array',
    },
    {
      label: 'workflow jobs',
      filePath: `${providerPath}/jobs.json`,
      sqliteNamespace: RepositoryFactory.getPipelineJobsSqliteNamespace(config),
      mode: 'array',
    },
    {
      label: 'pipeline filter options',
      filePath: `${providerPath}/pipeline-filter-options.json`,
      mode: 'singleton',
    },
    {
      label: 'pull requests',
      filePath: `${providerPath}/prs.json`,
      mode: 'array',
    },
    {
      label: 'pull request comments',
      filePath: `${providerPath}/pr-comments.json`,
      mode: 'array',
    },
    {
      label: 'pull request filter options',
      filePath: `${providerPath}/pull-request-filter-options.json`,
      mode: 'singleton',
    },
    {
      label: 'sonarqube measures',
      filePath: `${sonarqubePath}/measures.json`,
      mode: 'singleton',
    },
    {
      label: 'sonarqube component tree',
      filePath: `${sonarqubePath}/component-tree.json`,
      mode: 'singleton',
    },
    {
      label: 'sonarqube historical measures',
      filePath: `${sonarqubePath}/historical-measures.json`,
      mode: 'singleton',
    },
  ];
}

function removeLegacyPipelineSqliteNamespaces(config: Configuration, sqliteDbPath: string): void {
  const db = new DatabaseSync(sqliteDbPath);
  try {
    if (tableExists(db, 'workflow_runs')) {
      db.prepare('DELETE FROM workflow_runs WHERE namespace = ?').run(
        RepositoryFactory.getSqliteNamespace(
          `${config.getPathFromGitProvider()}/workflows.json`,
          config
        )
      );
    }
    if (tableExists(db, 'workflow_jobs')) {
      db.prepare('DELETE FROM workflow_jobs WHERE namespace = ?').run(
        RepositoryFactory.getSqliteNamespace(`${config.getPathFromGitProvider()}/jobs.json`, config)
      );
    }
  } finally {
    db.close();
  }
}

function tableExists(db: DatabaseSync, tableName: string): boolean {
  return Boolean(
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
      .get(tableName)
  );
}
