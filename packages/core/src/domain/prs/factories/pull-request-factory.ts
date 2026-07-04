import { Configuration, IRepository, RepositoryFactory } from '../../../infrastructure';
import { TimeZoneProvider } from '../../../infrastructure/timezone-provider';
import { PullRequestsRepository } from '../repositories/pull-requests-repository-json';
import {
  PullRequestCommentJsonResponse,
  PullRequestJsonResponse,
} from '../../../providers/github/github-response-types';
import {
  PullRequestFilterOptions,
  PullRequestFiltersRepository,
} from '../repositories/pull-request-filters-repository-json';
import { Logger } from '@smmachine/utils';

export class PullRequestFactory {
  static create(
    config: Configuration,
    logger: Logger,
    timeZoneProvider: TimeZoneProvider
  ): PullRequestsRepository {
    const repositories = this.createRepositories(config, logger);
    return new PullRequestsRepository(
      repositories.pullRequestsJsonRepository,
      repositories.pullRequestCommentsJsonRepository,
      timeZoneProvider
    );
  }

  static createFilters(config: Configuration, logger: Logger): PullRequestFiltersRepository {
    const repositories = this.createRepositories(config, logger);
    return new PullRequestFiltersRepository(
      repositories.pullRequestsJsonRepository,
      repositories.pullRequestCommentsJsonRepository,
      repositories.pullRequestFiltersJsonRepository
    );
  }

  private static createRepositories(
    config: Configuration,
    logger: Logger
  ): {
    pullRequestsJsonRepository: IRepository<PullRequestJsonResponse>;
    pullRequestCommentsJsonRepository: IRepository<PullRequestCommentJsonResponse>;
    pullRequestFiltersJsonRepository: IRepository<PullRequestFilterOptions>;
  } {
    const pullRequestsJsonRepository = RepositoryFactory.create<PullRequestJsonResponse>(
      `${config.getPathFromGitProvider()}/prs.json`,
      logger,
      config
    );
    const pullRequestCommentsJsonRepository = RepositoryFactory.create<PullRequestCommentJsonResponse>(
      `${config.getPathFromGitProvider()}/pr-comments.json`,
      logger,
      config
    );
    const pullRequestFiltersJsonRepository = RepositoryFactory.create<PullRequestFilterOptions>(
      `${config.getPathFromGitProvider()}/pull-request-filter-options.json`,
      logger,
      config
    );

    return {
      pullRequestsJsonRepository,
      pullRequestCommentsJsonRepository,
      pullRequestFiltersJsonRepository,
    };
  }
}
