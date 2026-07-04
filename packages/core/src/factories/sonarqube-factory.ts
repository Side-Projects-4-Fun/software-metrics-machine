import { SonarqubeComponentMeasure } from 'src';
import { Configuration, RepositoryFactory } from '../infrastructure';
import { SonarqubeRepository } from '../aggregates/sonarqube-repository-json';
import {
  CodeMetric,
  SonarqubeComponentTreeMeasure,
  TimestampedStore,
} from '../providers/sonarqube/types';
import { Logger } from '@smmachine/utils';

export class SonarqubeFactory {
  static create(configuration: Configuration, logger: Logger): SonarqubeRepository {
    const cacheDir = configuration.getSonarqubePath();
    const measuresJsonRepository = RepositoryFactory.create<
      TimestampedStore<SonarqubeComponentMeasure>
    >(
      `${cacheDir}/measures.json`,
      logger,
      configuration
    );
    const componentTreeJsonRepository = RepositoryFactory.create<
      TimestampedStore<SonarqubeComponentTreeMeasure[]>
    >(`${cacheDir}/component-tree.json`, logger, configuration);
    const historicalMeasuresJsonRepository = RepositoryFactory.create<TimestampedStore<CodeMetric[]>>(
      `${cacheDir}/historical-measures.json`,
      logger,
      configuration
    );

    return new SonarqubeRepository(
      measuresJsonRepository,
      componentTreeJsonRepository,
      historicalMeasuresJsonRepository
    );
  }
}
