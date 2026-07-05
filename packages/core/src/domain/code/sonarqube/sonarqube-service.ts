import { Logger } from '@smmachine/utils';
import { SonarqubeRepositoryJson as SonarqubeRepository } from '../../../providers/sonarqube/repositories/sonarqube-repository-json';

export interface QualityFilters {
  metrics?: string[];
  startDate?: string;
  endDate?: string;
  component?: string;
  depth?: number;
  forceRefresh?: boolean;
  incrementalUpdate?: boolean;
}

export class SonarQubeService {
  constructor(
    private sonarqubeRepository: SonarqubeRepository,
    private logger: Logger
  ) {}

  async getQualityMetrics(_filters?: unknown): Promise<unknown> {
    this.logger.info('Fetching SonarQube quality metrics...');
    try {
      // Apply any necessary filtering logic here based on the provided filters
      return await this.sonarqubeRepository.loadAll();
    } catch (error) {
      this.logger.error('Error fetching SonarQube metrics:', error);
      throw error;
    }
  }
}
