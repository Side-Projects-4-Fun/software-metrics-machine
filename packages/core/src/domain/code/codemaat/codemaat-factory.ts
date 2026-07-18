import { Configuration } from '../../../infrastructure';
import { Logger } from '@smmachine/utils';
import type { StorageType } from '../../../infrastructure/configuration';
import type { ICodeMetricsRepository } from './repositories/codemaat-metrics-repository';
import { CodeMaatMetricsSqliteRepository } from './infrastructure/codemaat-metrics-repository-sqlite';
import { CodeMaatMetricsCsvRepository } from './infrastructure/codemaat-metrics-repository-csv';
import type { ICodeMaatFetchRepository } from '../../../providers/codemaat/codemaat-fetch-repository';
import { CodemaatFetchSqliteRepository } from '../../../providers/codemaat/codemaat-fetch-repository-sqlite';
import { CodemaatFetchCsvRepository } from '../../../providers/codemaat/codemaat-fetch-repository-csv';

export class CodemaatFactory {
  static create(configuration: Configuration, logger: Logger): ICodeMetricsRepository {
    return CodemaatFactory.createReadRepository(
      configuration,
      logger,
      configuration.internal?.storageType ?? 'sqlite'
    );
  }

  static createWriteRepository(
    configuration: Configuration,
    logger: Logger
  ): ICodeMaatFetchRepository {
    return CodemaatFactory.createWriteRepositoryForStorage(
      configuration,
      logger,
      configuration.internal?.storageType ?? 'sqlite'
    );
  }

  static createReadRepository(
    configuration: Configuration,
    logger: Logger,
    storageType: StorageType
  ): ICodeMetricsRepository {
    if (storageType === 'sqlite') {
      return new CodeMaatMetricsSqliteRepository(configuration, logger);
    }

    return new CodeMaatMetricsCsvRepository(configuration, logger);
  }

  static createWriteRepositoryForStorage(
    configuration: Configuration,
    logger: Logger,
    storageType: StorageType
  ): ICodeMaatFetchRepository {
    if (storageType === 'sqlite') {
      return new CodemaatFetchSqliteRepository(configuration, logger);
    }

    return new CodemaatFetchCsvRepository(configuration, logger);
  }
}
