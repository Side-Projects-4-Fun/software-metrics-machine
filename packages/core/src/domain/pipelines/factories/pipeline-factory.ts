import { PipelinesSqliteRepository } from '../infrastructure/pipelines-repository-sqlite';
import { Configuration, RepositoryFactory } from '../../../infrastructure';
import {
  WorkflowJobJsonResponse,
  WorkflowJsonResponse,
} from '../../../providers/github/github-response-types';
import { PipelinesFetchRepository } from '../../../providers/github/pipelines-fetch-repository-json';
import {
  GithubWorkflowClient,
  GithubWorkflowJobClient,
  GitlabPipelineClient,
  GitHubRateLimitManager,
} from '../../../providers';
import { PipelinesJobFetchRepository } from '../../../providers/github/pipelines-job-fetch-repository-json';
import {
  PipelineFiltersRepository,
  PipelineFilterOptions,
} from '../repositories/pipeline-filters-repository';
import { Logger } from '@smmachine/utils';
import { TimeZoneProvider } from '../../../infrastructure/timezone-provider';
import { PipelinesRepository } from '../repositories/pipeline-repository';
import { PipelinesRepositoryJson } from '..';
import { PipelineFiltersRepositoryJson } from '../infrastructure/pipeline-filters-repository-json';

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
      ? new GitlabPipelineClient(config.gitlabToken, config.githubRepository!, logger)
      : new GithubWorkflowClient(
          config.githubToken!,
          githubOwner,
          githubRepo,
          rateLimitManager,
          logger
        );
    const workflowJobClient = isGitlab
      ? new GitlabPipelineClient(config.gitlabToken, config.githubRepository!, logger)
      : new GithubWorkflowJobClient(
          config.githubToken!,
          githubOwner,
          githubRepo,
          rateLimitManager,
          logger
        );

    const pipelineRunJsonRepository = RepositoryFactory.create<WorkflowJsonResponse>(
      RepositoryFactory.getPipelineRunsRepositoryPath(config),
      logger,
      config
    );
    const pipelineJobsJsonRepository = RepositoryFactory.create<WorkflowJobJsonResponse>(
      RepositoryFactory.getPipelineJobsRepositoryPath(config),
      logger,
      config
    );
    const pipelineFiltersJsonRepository = RepositoryFactory.create<PipelineFilterOptions>(
      `${config.getPathFromGitProvider()}/pipeline-filter-options.json`,
      logger,
      config
    );

    const pipelineRepository =
      config.internal?.storageType === 'sqlite'
        ? new PipelinesSqliteRepository(config, logger, timeZoneProvider)
        : new PipelinesRepositoryJson(
            pipelineRunJsonRepository,
            pipelineJobsJsonRepository,
            logger,
            timeZoneProvider
          );
    const pipelineFiltersRepository = new PipelineFiltersRepositoryJson(
      pipelineRunJsonRepository,
      pipelineJobsJsonRepository,
      pipelineFiltersJsonRepository
    );

    const workflowRepository = new PipelinesFetchRepository(
      config,
      workflowClient,
      pipelineRunJsonRepository,
      pipelineFiltersRepository,
      logger
    );
    const workflowJobRepository = new PipelinesJobFetchRepository(
      config,
      workflowJobClient,
      pipelineRunJsonRepository,
      pipelineJobsJsonRepository,
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
