import { Command } from 'commander';
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

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  actionWithSmm(handler: (options: any, command: SmmCommand) => void | Promise<void>): this {
    return this.action((options: unknown, command: Command) => {
      const smmCommand = command as unknown as SmmCommand;
      smmCommand.getConfigurationRepository();
      return handler(options, smmCommand);
    });
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
