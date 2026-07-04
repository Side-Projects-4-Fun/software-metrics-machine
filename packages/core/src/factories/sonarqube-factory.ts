import { SonarqubeComponentMeasure } from 'src';
import {
  Configuration,
  IRepository,
  JsonFileSystemRepository,
  RepositoryFactory,
  SqliteRepository,
} from '../infrastructure';
import { SonarqubeRepository } from '../aggregates/sonarqube-repository-json';
import {
  CodeMetric,
  SonarqubeComponentTreeMeasure,
  TimestampedStore,
} from '../providers/sonarqube/types';
import { Logger } from '@smmachine/utils';

export class SonarqubeFactory {
  static create(configuration: Configuration, logger: Logger): SonarqubeRepository {
    const storageType = configuration.internal?.storageType ?? 'json';
    const cacheDir = configuration.getSonarqubePath();
    const filePath = (name: string): string => `${cacheDir}/${name}`;

    const measuresRepository = this.createRepository<TimestampedStore<SonarqubeComponentMeasure>>(
      filePath('measures.json'),
      logger,
      configuration,
      storageType
    );
    const componentTreeRepository = this.createRepository<
      TimestampedStore<SonarqubeComponentTreeMeasure[]>
    >(filePath('component-tree.json'), logger, configuration, storageType);
    const historicalMeasuresRepository = this.createRepository<TimestampedStore<CodeMetric[]>>(
      filePath('historical-measures.json'),
      logger,
      configuration,
      storageType
    );

    return new SonarqubeRepository(
      measuresRepository,
      componentTreeRepository,
      historicalMeasuresRepository
    );
  }

  private static createRepository<T>(
    filePath: string,
    logger: Logger,
    configuration: Configuration,
    storageType: string
  ): IRepository<T> {
    if (storageType === 'sqlite') {
      return new SqliteRepository<T>(
        RepositoryFactory.getSqliteDatabasePath(configuration),
        RepositoryFactory.getSqliteNamespace(filePath, configuration),
        logger
      );
    }
    return new JsonFileSystemRepository<T>(filePath, logger);
  }
}
