import { Commit } from '../../../domain-types';
import { PairingService } from './pairing-service';
import {
  Configuration,
  IRepository,
  JsonFileSystemRepository,
  RepositoryFactory,
  SqliteRepository,
  TimeZoneProvider,
} from '../../../infrastructure';
import { Logger } from '@smmachine/utils';

export class PairingFactory {
  static create(
    configuration: Configuration,
    logger: Logger,
    timeZoneProvider: TimeZoneProvider
  ): PairingService {
    const storageType = configuration.internal?.storageType ?? 'json';
    const filePath = `${configuration.getGitPath()}/commits.json`;
    let commitsRepository: IRepository<Commit>;

    if (storageType === 'sqlite') {
      commitsRepository = new SqliteRepository<Commit>(
        RepositoryFactory.getSqliteDatabasePath(configuration),
        RepositoryFactory.getSqliteNamespace(filePath, configuration),
        logger
      );
    } else {
      commitsRepository = new JsonFileSystemRepository<Commit>(filePath, logger);
    }

    return new PairingService(commitsRepository, timeZoneProvider, logger);
  }
}
