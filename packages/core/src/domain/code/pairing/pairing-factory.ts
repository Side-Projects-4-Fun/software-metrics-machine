import type { Commit } from '../../../domain-types';
import { PairingService } from './pairing-service';
import type { Configuration, TimeZoneProvider } from '../../../infrastructure';
import { RepositoryFactory } from '../../../infrastructure';
import type { Logger } from '@smmachine/utils';

export class PairingFactory {
  static create(
    configuration: Configuration,
    logger: Logger,
    timeZoneProvider: TimeZoneProvider
  ): PairingService {
    const commitsRepository = RepositoryFactory.create<Commit>(
      `${configuration.getGitPath()}/commits.json`,
      logger,
      configuration
    );

    return new PairingService(commitsRepository, timeZoneProvider, logger);
  }
}
