import { Configuration } from '../../../infrastructure';
import { Logger } from '@smmachine/utils';
import type { ICodeMetricsRepository } from './repositories/codemaat-metrics-repository';
import { CodeMaatMetricsSqliteRepository } from './infrastructure/codemaat-metrics-repository-sqlite';
import type { ICodeMaatFetchRepository } from '../../../providers/codemaat/codemaat-fetch-repository';
import { CodemaatFetchSqliteRepository } from '../../../providers/codemaat/codemaat-fetch-repository-sqlite';

export class CodemaatFactory {
  static create(configuration: Configuration, logger: Logger): ICodeMetricsRepository {
    return CodemaatFactory.createReadRepository(configuration, logger);
  }

  static createWriteRepository(
    configuration: Configuration,
    logger: Logger
  ): ICodeMaatFetchRepository {
    return CodemaatFactory.createWriteRepositoryForStorage(configuration, logger);
  }

  static createReadRepository(
    configuration: Configuration,
    logger: Logger
  ): ICodeMetricsRepository {
    return new CodeMaatMetricsSqliteRepository(configuration, logger);
  }

  static createWriteRepositoryForStorage(
    configuration: Configuration,
    logger: Logger
  ): ICodeMaatFetchRepository {
    return new CodemaatFetchSqliteRepository(configuration, logger);
  }
}
