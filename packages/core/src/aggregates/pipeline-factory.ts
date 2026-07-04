import { PipelinesRepository } from './pipelines-repository-json';
import { Configuration, RepositoryFactory } from '../infrastructure';
import {
  WorkflowJobJsonResponse,
  WorkflowJsonResponse,
} from '../providers/github/github-response-types';
import { PipelinesFetchRepository } from '../providers/github/pipelines-fetch-repository-json';
import {
  GithubWorkflowClient,
  GithubWorkflowJobClient,
  GitlabPipelineClient,
  GitHubRateLimitManager,
} from '../providers';
import { PipelinesJobFetchRepository } from '../providers/github/pipelines-job-fetch-repository-json';
import { PipelineFiltersRepository, PipelineFilterOptions } from './pipeline-filters-repository-json';
import { Logger } from '@smmachine/utils';
import { TimeZoneProvider } from '../infrastructure/timezone-provider';

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
      `${config.getPathFromGitProvider()}/workflows.json`,
      logger,
      config
    );
    const pipelineJobsJsonRepository = RepositoryFactory.create<WorkflowJobJsonResponse>(
      `${config.getPathFromGitProvider()}/jobs.json`,
      logger,
      config
    );
    const pipelineFiltersJsonRepository = RepositoryFactory.create<PipelineFilterOptions>(
      `${config.getPathFromGitProvider()}/pipeline-filter-options.json`,
      logger,
      config
    );

    const pipelineRepository = new PipelinesRepository(
      pipelineRunJsonRepository,
      pipelineJobsJsonRepository,
      logger,
      timeZoneProvider
    );
    const pipelineFiltersRepository = new PipelineFiltersRepository(
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
