import { PipelinesSqliteRepository } from '../infrastructure/pipelines-repository-sqlite';
import type { Configuration } from '../../../infrastructure';
import { RepositoryFactory } from '../../../infrastructure';
import type {
  WorkflowJobJsonResponse,
  WorkflowJsonResponse,
} from '../../../providers/github/github-response-types';
import { PipelinesFetchRepository } from '../../../providers/github/pipelines-fetch-repository';
import {
  GithubWorkflowClient,
  GithubWorkflowJobClient,
  GitlabPipelineClient,
  defaultGitlabCliRunner,
  GitHubRateLimitManager,
} from '../../../providers';
import { PipelinesJobFetchRepository } from '../../../providers/github/pipelines-job-fetch-repository';
import type {
  PipelineFiltersRepository,
  PipelineFilterOptions,
} from '../repositories/pipeline-filters-repository';
import type { Logger } from '@smmachine/utils';
import type { TimeZoneProvider } from '../../../infrastructure/timezone-provider';
import type { PipelinesRepository } from '../repositories/pipeline-repository';
import { CachedPipelineFiltersRepository } from '../infrastructure/pipeline-filters-repository';

export default class PipelineFactory {
  static create(
    config: Configuration,
    logger: Logger,
    timeZoneProvider: TimeZoneProvider
  ): {
    pipelineRepository: PipelinesRepository;
    pipelineFiltersRepository: PipelineFiltersRepository;
    workflowRepository: PipelinesFetchRepository;
    workflowJobRepository: PipelinesJobFetchRepository;
  } {
    const [githubOwner, githubRepo] = config.githubRepository!.split('/');
    const isGitlab = config.gitProvider?.toLowerCase() === 'gitlab';

    // Shared rate limit manager across all GitHub API clients
    const rateLimitManager = new GitHubRateLimitManager(logger);

    const workflowClient = isGitlab
      ? new GitlabPipelineClient(
          config.gitlabToken,
          config.githubRepository!,
          logger,
          defaultGitlabCliRunner,
          config.gitlabUrl
        )
      : new GithubWorkflowClient(
          config.githubToken!,
          githubOwner,
          githubRepo,
          rateLimitManager,
          logger
        );
    const workflowJobClient = isGitlab
      ? new GitlabPipelineClient(
          config.gitlabToken,
          config.githubRepository!,
          logger,
          defaultGitlabCliRunner,
          config.gitlabUrl
        )
      : new GithubWorkflowJobClient(
          config.githubToken!,
          githubOwner,
          githubRepo,
          rateLimitManager,
          logger
        );

    const pipelineRunRepository = RepositoryFactory.create<WorkflowJsonResponse>(
      RepositoryFactory.getPipelineRunsRepositoryPath(config),
      logger,
      config
    );
    const pipelineJobsRepository = RepositoryFactory.create<WorkflowJobJsonResponse>(
      RepositoryFactory.getPipelineJobsRepositoryPath(config),
      logger,
      config
    );
    const pipelineFilterOptionsRepository = RepositoryFactory.create<PipelineFilterOptions>(
      `${config.getPathFromGitProvider()}/pipeline-filter-options.json`,
      logger,
      config
    );

    const pipelineRepository = new PipelinesSqliteRepository(config, logger, timeZoneProvider);
    const pipelineFiltersRepository = new CachedPipelineFiltersRepository(
      pipelineRunRepository,
      pipelineJobsRepository,
      pipelineFilterOptionsRepository
    );

    const workflowRepository = new PipelinesFetchRepository(
      config,
      workflowClient,
      pipelineRunRepository,
      pipelineFiltersRepository,
      logger
    );
    const workflowJobRepository = new PipelinesJobFetchRepository(
      config,
      workflowJobClient,
      pipelineRunRepository,
      pipelineJobsRepository,
      pipelineFiltersRepository,
      logger
    );

    return {
      pipelineRepository,
      pipelineFiltersRepository,
      workflowRepository,
      workflowJobRepository,
    };
  }
}
