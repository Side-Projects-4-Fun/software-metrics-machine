import { CommitTraverser } from '../../../providers';
import type { Commit } from '../../../domain-types';
import type { Configuration } from '../../../infrastructure';
import { RepositoryFactory } from '../../../infrastructure';
import { GitFetchRepository } from '../../../providers/git/git-fetch-repository';
import type { Logger } from '@smmachine/utils';

export class GitFactory {
  static create(configuration: Configuration, logger: Logger): GitFetchRepository {
    const commitTraverser = new CommitTraverser(configuration.gitRepositoryLocation, logger);
    const commitsRepository = RepositoryFactory.create<Commit>(
      `${configuration.getGitPath()}/commits.json`,
      logger,
      configuration
    );
    return new GitFetchRepository(commitTraverser, commitsRepository, logger);
  }
}
