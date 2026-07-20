import { Logger } from '@smmachine/utils';
import { Configuration } from '../../infrastructure';
import { CodemaatFetchSqliteRepository } from './codemaat-fetch-repository-sqlite';

export interface CodemaatFetchOptions {
  repositoryPath?: string;
  outputDirectory?: string;
  startDate: string;
  endDate?: string;
  subfolder?: string;
  groupDepth?: number;
  minRevs?: number;
  minSharedRevs?: number;
  minCoupling?: number;
  force?: boolean;
  scriptPath?: string;
}

export interface CodemaatFetchResult {
  repository: string;
  outputDirectory: string;
  stdout: string;
  persistedRecords?: number;
}

export type CodeMaatPersistenceResult = {
  persisted: boolean;
  records: number;
};

export interface ICodeMaatFetchRepository {
  fetch(options: CodemaatFetchOptions): CodemaatFetchResult;
  persistFetchedMetrics(): Promise<CodeMaatPersistenceResult>;
}

export class CodemaatFetchRepository implements ICodeMaatFetchRepository {
  private readonly delegate: ICodeMaatFetchRepository;

  constructor(configuration: Configuration, logger: Logger) {
    this.delegate = new CodemaatFetchSqliteRepository(configuration, logger);
  }

  fetch(options: CodemaatFetchOptions): CodemaatFetchResult {
    return this.delegate.fetch(options);
  }

  persistFetchedMetrics(): Promise<CodeMaatPersistenceResult> {
    return this.delegate.persistFetchedMetrics();
  }
}

export { CodemaatFetchCsvRepository } from './codemaat-fetch-repository-csv';
export { CodemaatFetchSqliteRepository } from './codemaat-fetch-repository-sqlite';
