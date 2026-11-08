import type { Configuration, IRepository } from '../../../infrastructure';
import { RepositoryFactory } from '../../../infrastructure';
import type { TimeZoneProvider } from '../../../infrastructure/timezone-provider';
import type { IReadChangeRequestsRepository } from '../repositories/change-requests-repository';
import { ChangeRequestsSqliteRepository } from '../repositories/change-requests-repository-sqlite';
import type {
  PullRequestCommentJsonResponse,
  PullRequestJsonResponse,
} from '../../../providers/github/github-response-types';
import type { ChangeRequestFilterOptions } from '../repositories/change-request-filters-repository';
import { ChangeRequestFiltersRepository } from '../repositories/change-request-filters-repository';
import type { Logger } from '@smmachine/utils';

export class ChangeRequestFactory {
  static create(
    config: Configuration,
    _logger: Logger,
    timeZoneProvider: TimeZoneProvider
  ): IReadChangeRequestsRepository {
    return new ChangeRequestsSqliteRepository(config, timeZoneProvider);
  }

  static createFilters(config: Configuration, logger: Logger): ChangeRequestFiltersRepository {
    const repositories = this.createRepositories(config, logger);
    return new ChangeRequestFiltersRepository(
      repositories.changeRequestsRepository,
      repositories.changeRequestCommentsRepository,
      repositories.changeRequestFilterOptionsRepository
    );
  }

  private static createRepositories(
    config: Configuration,
    logger: Logger
  ): {
    changeRequestsRepository: IRepository<PullRequestJsonResponse>;
    changeRequestCommentsRepository: IRepository<PullRequestCommentJsonResponse>;
    changeRequestFilterOptionsRepository: IRepository<ChangeRequestFilterOptions>;
  } {
    const changeRequestsRepository = RepositoryFactory.create<PullRequestJsonResponse>(
      `${config.getPathFromGitProvider()}/prs.json`,
      logger,
      config
    );
    const changeRequestCommentsRepository =
      RepositoryFactory.create<PullRequestCommentJsonResponse>(
        `${config.getPathFromGitProvider()}/pr-comments.json`,
        logger,
        config
      );
    const changeRequestFilterOptionsRepository =
      RepositoryFactory.create<ChangeRequestFilterOptions>(
        `${config.getPathFromGitProvider()}/pull-request-filter-options.json`,
        logger,
        config
      );

    return {
      changeRequestsRepository,
      changeRequestCommentsRepository,
      changeRequestFilterOptionsRepository,
    };
  }
}
