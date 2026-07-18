import { Commit } from '../../../domain-types';
import { PairingService } from './pairing-service';
import { Configuration, RepositoryFactory, TimeZoneProvider } from '../../../infrastructure';
import { Logger } from '@smmachine/utils';

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
