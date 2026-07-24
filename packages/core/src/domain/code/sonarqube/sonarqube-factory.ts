import type { SonarqubeComponentMeasure } from 'src';
import type { Configuration, IRepository } from '../../../infrastructure';
import { RepositoryFactory } from '../../../infrastructure';
import type {
  CodeMetric,
  SonarqubeComponentTreeMeasure,
  TimestampedStore,
} from '../../../providers';
import { SonarqubeRepositoryJson as SonarqubeRepository } from '../../../providers/sonarqube/repositories/sonarqube-repository-json';
import type { Logger } from '@smmachine/utils';

export class SonarqubeFactory {
  static create(configuration: Configuration, logger: Logger): SonarqubeRepository {
    const cacheDir = configuration.getSonarqubePath();
    const filePath = (name: string): string => `${cacheDir}/${name}`;

    const measuresRepository = this.createRepository<TimestampedStore<SonarqubeComponentMeasure>>(
      filePath('measures.json'),
      logger,
      configuration
    );
    const componentTreeRepository = this.createRepository<
      TimestampedStore<SonarqubeComponentTreeMeasure[]>
    >(filePath('component-tree.json'), logger, configuration);
    const historicalMeasuresRepository = this.createRepository<TimestampedStore<CodeMetric[]>>(
      filePath('historical-measures.json'),
      logger,
      configuration
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
    configuration: Configuration
  ): IRepository<T> {
    return RepositoryFactory.create<T>(filePath, logger, configuration);
  }
}
