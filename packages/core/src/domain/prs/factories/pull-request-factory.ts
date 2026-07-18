import { Configuration, IRepository, RepositoryFactory } from '../../../infrastructure';
import { TimeZoneProvider } from '../../../infrastructure/timezone-provider';
import { IReadPullRequestsRepository } from '../repositories/pull-requests-repository-json';
import { PullRequestsSqliteRepository } from '../repositories/pull-requests-repository-sqlite';
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
    _logger: Logger,
    timeZoneProvider: TimeZoneProvider
  ): IReadPullRequestsRepository {
    return new PullRequestsSqliteRepository(config, timeZoneProvider);
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
    const pullRequestCommentsJsonRepository =
      RepositoryFactory.create<PullRequestCommentJsonResponse>(
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
