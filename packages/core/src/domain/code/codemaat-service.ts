import { CodeChurnResult, FileCoupling, ICodeMetricsRepository } from 'src/providers/codemaat';

export class CodemaatService {
  constructor(private metricsRepository: ICodeMetricsRepository) {}

  async getCodeChurn(options?: { startDate?: string; endDate?: string }): Promise<CodeChurnResult> {
    return this.metricsRepository.getCodeChurn(options);
  }

  async getFileCoupling(options?: { ignorePatterns?: string[] }): Promise<FileCoupling[]> {
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
