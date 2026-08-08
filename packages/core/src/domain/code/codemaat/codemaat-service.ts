import type {
  ICodeMetricsRepository,
  AuthorChurnRecord,
} from './repositories/codemaat-metrics-repository';
import type { CodeChurnResult, FileCoupling } from '../../../providers/codemaat/types';

export class CodemaatService {
  constructor(private metricsRepository: ICodeMetricsRepository) {}

  async getCodeChurn(options?: { startDate?: string; endDate?: string }): Promise<CodeChurnResult> {
    return this.metricsRepository.getCodeChurn(options);
  }

  async getAuthorChurn(options?: {
    startDate?: string;
    endDate?: string;
    authors?: string[];
  }): Promise<AuthorChurnRecord[]> {
    return this.metricsRepository.getAuthorChurn(options);
  }

  async getFileCoupling(options?: {
    ignorePatterns?: string[];
    startDate?: string;
    endDate?: string;
    minCoupling?: number;
  }): Promise<FileCoupling[]> {
    return this.metricsRepository.getFileCoupling(options);
  }

  async getEntityEffort(options?: {
    ignoreFiles?: string;
    includeOnly?: string;
    top?: number;
  }): Promise<Array<{ entity: string; 'total-revs': number }>> {
    return this.metricsRepository.getEntityEffort({
      ignorePatterns: options?.ignoreFiles,
      includePatterns: options?.includeOnly,
      top: options?.top,
    });
  }

  async getEntityOwnership(options?: {
    ignoreFiles?: string;
    includeOnly?: string;
    authors?: string;
    top?: number;
  }): Promise<Array<{ entity: string; author: string; added: number; deleted: number }>> {
    return this.metricsRepository.getEntityOwnership({
      ignorePatterns: options?.ignoreFiles,
      includePatterns: options?.includeOnly,
      authors: options?.authors,
      top: options?.top,
    });
  }
}
