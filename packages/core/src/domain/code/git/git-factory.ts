import { CommitTraverser } from '../../../providers';
import { Commit } from '../../../domain-types';
import { Configuration, RepositoryFactory } from '../../../infrastructure';
import { GitFetchRepository } from '../../../providers/git/git-fetch-repository-json';
import { Logger } from '@smmachine/utils';

export class GitFactory {
  static create(configuration: Configuration, logger: Logger): GitFetchRepository {
    const commitTraverser = new CommitTraverser(configuration.gitRepositoryLocation, logger);
    const commitsJsonRepository = RepositoryFactory.create<Commit>(
      `${configuration.getGitPath()}/commits.json`,
      logger,
      configuration
    );
    return new GitFetchRepository(commitTraverser, commitsJsonRepository, logger);
  }
}
