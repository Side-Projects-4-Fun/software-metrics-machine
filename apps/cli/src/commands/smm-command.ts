import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import {
  applySqliteMigrations,
  openSqliteConnection,
  RepositoryFactory,
  resolveStoreDataAt,
} from '@smmachine/core';
import type { Configuration } from '@smmachine/core/infrastructure/configuration';
import { ConfigurationRepository } from '@smmachine/core/infrastructure/configuration-repository';
import { Logger, type LogLevel } from '@smmachine/utils';
import { Screen } from '../screen';

type GlobalCliOptions = {
  debug?: boolean;
  project?: string;
};

/**
 * Shared CLI command base class.
 *
 * It ensures child commands are instances of SmmCommand and exposes
 * utility helpers for global option access.
 */
export class SmmCommand extends Command {
  private configurationRepository?: ConfigurationRepository;
  private screen?: Screen;

  override createCommand(name?: string): SmmCommand {
    return new SmmCommand(name);
  }

  subcommand(nameAndArgs: string): SmmCommand {
    return this.command(nameAndArgs) as SmmCommand;
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  actionWithSmm(handler: (...args: any[]) => void | Promise<void>): this {
    return this.action(async (...args: any[]) => {
      const smmCommand = args[args.length - 1] as SmmCommand;
      await smmCommand.autoMigrateIfNeeded();
      smmCommand.getConfigurationRepository();
      return await handler(...args);
    });
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  private async autoMigrateIfNeeded(): Promise<void> {
    if (!resolveStoreDataAt(process.env)) {
      return;
    }

    const configuration = this.getConfiguration();
    const sqliteDbPath = RepositoryFactory.getSqliteDatabasePath(configuration);
    fs.mkdirSync(path.dirname(sqliteDbPath), { recursive: true });
    const db = openSqliteConnection(sqliteDbPath);

    try {
      applySqliteMigrations(db);
    } catch (error) {
      const logger = new Logger('SmmCommand', 'CRITICAL');
      logger.error(
        `SQLite migration failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    } finally {
      db.close();
    }
  }

  getGlobalOptions(): GlobalCliOptions {
    return this.optsWithGlobals() as GlobalCliOptions;
  }

  getSelectedProject(): string | undefined {
    return this.getGlobalOptions().project;
  }

  getConfigurationRepository(): ConfigurationRepository {
    if (!this.configurationRepository) {
      const logger = new Logger('ConfigurationRepository', process.env.DEBUG ? 'DEBUG' : undefined);
      logger.debug(
        'Initializing ConfigurationRepository with environment variables and selected project'
      );

      this.configurationRepository = new ConfigurationRepository(
        process.env,
        this.getSelectedProject(),
        logger
      );
    }

    return this.configurationRepository;
  }

  getConfiguration(): Configuration {
    return this.getConfigurationRepository().getActiveConfiguration();
  }

  getScreen(): Screen {
    if (!this.screen) {
      this.screen = new Screen();
    }

    return this.screen;
  }

  getLogger(name: string): Logger {
    const configuration = this.getConfiguration();

    return new Logger(name, {
      level: this.resolveLogLevel(configuration),
      filePath: configuration.getLogPath(),
      storeLogs: configuration.storeLogs,
    });
  }

  private resolveLogLevel(configuration: Configuration): LogLevel {
    if (this.getGlobalOptions().debug || process.env.DEBUG) {
      return 'DEBUG';
    }

    return configuration.loggingLevel;
  }
}
