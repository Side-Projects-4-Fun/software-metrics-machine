import type { Configuration, IRepository } from '../../../infrastructure';
import { RepositoryFactory } from '../../../infrastructure';
import type { TimeZoneProvider } from '../../../infrastructure/timezone-provider';
import type { IReadChangeRequestsRepository } from '../repositories/change-requests-repository-json';
import { ChangeRequestsSqliteRepository } from '../repositories/change-requests-repository-sqlite';
import type {
  PullRequestCommentJsonResponse,
  PullRequestJsonResponse,
} from '../../../providers/github/github-response-types';
import type { ChangeRequestFilterOptions } from '../repositories/change-request-filters-repository-json';
import { ChangeRequestFiltersRepository } from '../repositories/change-request-filters-repository-json';
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
      repositories.changeRequestsJsonRepository,
      repositories.changeRequestCommentsJsonRepository,
      repositories.changeRequestFiltersJsonRepository
    );
  }

  private static createRepositories(
    config: Configuration,
    logger: Logger
  ): {
    changeRequestsJsonRepository: IRepository<PullRequestJsonResponse>;
    changeRequestCommentsJsonRepository: IRepository<PullRequestCommentJsonResponse>;
    changeRequestFiltersJsonRepository: IRepository<ChangeRequestFilterOptions>;
  } {
    const changeRequestsJsonRepository = RepositoryFactory.create<PullRequestJsonResponse>(
      `${config.getPathFromGitProvider()}/prs.json`,
      logger,
      config
    );
    const changeRequestCommentsJsonRepository =
      RepositoryFactory.create<PullRequestCommentJsonResponse>(
        `${config.getPathFromGitProvider()}/pr-comments.json`,
        logger,
        config
      );
    const changeRequestFiltersJsonRepository = RepositoryFactory.create<ChangeRequestFilterOptions>(
      `${config.getPathFromGitProvider()}/pull-request-filter-options.json`,
      logger,
      config
    );

    return {
      changeRequestsJsonRepository,
      changeRequestCommentsJsonRepository,
      changeRequestFiltersJsonRepository,
    };
  }
}
