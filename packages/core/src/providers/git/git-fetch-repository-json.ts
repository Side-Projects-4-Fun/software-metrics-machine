import { Logger } from '@smmachine/utils';
import { ICommitTraverser, IRepository } from 'src';
import { Commit } from 'src/domain-types';

export class GitFetchRepository {
  constructor(
    private commitTraverser: ICommitTraverser,
    private commitsJsonRepository: IRepository<Commit>,
    private logger: Logger
  ) {}

  async fetchCommits(options?: {
    startDate?: string;
    endDate?: string;
    forceRefresh?: boolean;
    maxBuffer?: number;
  }): Promise<Commit[]> {
    const fromCache = await this.commitsJsonRepository.loadAll();

    if (!options?.forceRefresh && fromCache.length > 0) {
      this.logger.info(`Using cached commits: ${fromCache.length} records`);
      return fromCache;
    }

    this.logger.info('Analyzing commits from git repository...');
    const result = await this.commitTraverser.traverseCommits({
      startDate: options?.startDate,
      endDate: options?.endDate,
      maxBuffer: options?.maxBuffer,
    });

    await this.commitsJsonRepository.saveAll(result.commits);

    return result.commits;
  }
}
