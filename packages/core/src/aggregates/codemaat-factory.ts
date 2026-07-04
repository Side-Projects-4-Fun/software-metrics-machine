import { Configuration } from 'src/infrastructure';
import { Logger } from '@smmachine/utils';
import type { StorageType } from 'src/infrastructure/configuration';
import type { ICodeMetricsRepository } from './codemaat-metrics-repository';
import { CodeMaatMetricsCsvRepository } from './codemaat-metrics-repository-csv';
import { CodeMaatMetricsSqliteRepository } from './codemaat-metrics-repository-sqlite';
import type { ICodeMaatFetchRepository } from '../providers/codemaat/codemaat-fetch-repository';
import { CodemaatFetchCsvRepository } from '../providers/codemaat/codemaat-fetch-repository-csv';
import { CodemaatFetchSqliteRepository } from '../providers/codemaat/codemaat-fetch-repository-sqlite';

export class CodemaatFactory {
  static create(configuration: Configuration, logger: Logger): ICodeMetricsRepository {
    return CodemaatFactory.createReadRepository(
      configuration,
      logger,
      configuration.internal?.storageType ?? 'json'
    );
  }

  static createWriteRepository(
    configuration: Configuration,
    logger: Logger
  ): ICodeMaatFetchRepository {
    return CodemaatFactory.createWriteRepositoryForStorage(
      configuration,
      logger,
      configuration.internal?.storageType ?? 'json'
    );
  }

  static createForStorage(
    configuration: Configuration,
    logger: Logger,
    storageType: StorageType
  ): ICodeMetricsRepository {
    return CodemaatFactory.createReadRepository(configuration, logger, storageType);
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
