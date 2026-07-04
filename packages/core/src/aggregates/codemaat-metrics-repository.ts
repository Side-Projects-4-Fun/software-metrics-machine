import { Logger } from '@smmachine/utils';
import { Configuration } from 'src';
import { CodeChurnResult, FileCoupling } from '../providers/codemaat/types';
import { CodeMaatMetricsCsvRepository } from './codemaat-metrics-repository-csv';
import { CodeMaatMetricsSqliteRepository } from './codemaat-metrics-repository-sqlite';

export interface ICodeMetricsRepository {
  getCodeChurn(
    options: CodeMaatChurnOptions & { typeChurn: string }
  ): Promise<CodeChurnValueResult>;
  getCodeChurn(options?: CodeMaatChurnOptions): Promise<CodeChurnResult>;
  getFileCoupling(options?: CodeMaatEntityFilterOptions): Promise<FileCoupling[]>;
  getEntityChurn(
    options?: CodeMaatEntityFilterOptions
  ): Promise<Array<{ entity: string; added: number; deleted: number; commits: number }>>;
  getEntityEffort(
    options?: CodeMaatEntityFilterOptions
  ): Promise<Array<{ entity: string; 'total-revs': number }>>;
  getEntityOwnership(
    options: CodeMaatEntityFilterOptions & { select: 'authors' }
  ): Promise<string[]>;
  getEntityOwnership(
    options?: CodeMaatEntityFilterOptions
  ): Promise<Array<{ entity: string; author: string; added: number; deleted: number }>>;
}

export type CodeMaatEntityFilterOptions = {
  ignorePatterns?: string | string[];
  includePatterns?: string | string[];
  authors?: string | string[];
  top?: string | number;
  sortBy?: 'degree' | 'churn' | 'revs';
  select?: 'authors';
};

export type CodeMaatChurnOptions = {
  startDate?: string;
  endDate?: string;
  typeChurn?: string;
};

export type CodeChurnValue = {
  date: string;
  type: string;
  value: number;
};

export type CodeChurnValueResult = {
  data: CodeChurnValue[];
  startDate?: string;
  endDate?: string;
};

export class CodeMaatMetricsRepository implements ICodeMetricsRepository {
  private readonly delegate: ICodeMetricsRepository;

  constructor(configuration: Configuration, logger: Logger) {
    this.delegate =
      configuration.internal?.storageType === 'sqlite'
        ? new CodeMaatMetricsSqliteRepository(configuration, logger)
        : new CodeMaatMetricsCsvRepository(configuration, logger);
  }

  getCodeChurn(options: CodeMaatChurnOptions & { typeChurn: string }): Promise<CodeChurnValueResult>;
  getCodeChurn(options?: CodeMaatChurnOptions): Promise<CodeChurnResult>;
  getCodeChurn(options?: CodeMaatChurnOptions): Promise<CodeChurnResult | CodeChurnValueResult> {
    return this.delegate.getCodeChurn(options as CodeMaatChurnOptions & { typeChurn: string });
  }

  getFileCoupling(options?: CodeMaatEntityFilterOptions): Promise<FileCoupling[]> {
    return this.delegate.getFileCoupling(options);
  }

  getEntityChurn(
    options?: CodeMaatEntityFilterOptions
  ): Promise<Array<{ entity: string; added: number; deleted: number; commits: number }>> {
    return this.delegate.getEntityChurn(options);
  }

  getEntityEffort(
    options?: CodeMaatEntityFilterOptions
  ): Promise<Array<{ entity: string; 'total-revs': number }>> {
    return this.delegate.getEntityEffort(options);
  }

  getEntityOwnership(options: CodeMaatEntityFilterOptions & { select: 'authors' }): Promise<string[]>;
  getEntityOwnership(
    options?: CodeMaatEntityFilterOptions
  ): Promise<Array<{ entity: string; author: string; added: number; deleted: number }>>;
  getEntityOwnership(
    options?: CodeMaatEntityFilterOptions
  ): Promise<Array<{ entity: string; author: string; added: number; deleted: number }> | string[]> {
    return this.delegate.getEntityOwnership(
      options as CodeMaatEntityFilterOptions & { select: 'authors' }
    );
  }

}

export { CodeMaatMetricsCsvRepository } from './codemaat-metrics-repository-csv';
export { CodeMaatMetricsSqliteRepository } from './codemaat-metrics-repository-sqlite';
