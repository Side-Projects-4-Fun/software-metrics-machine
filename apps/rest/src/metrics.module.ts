import { Module, MiddlewareConsumer, NestModule, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import * as path from 'path';
import { MetricsController } from './metrics.controller';
import { CodeController } from './controllers/code.controller';
import { PipelinesController } from './controllers/pipelines.controller';
import { PullRequestsController } from './controllers/pull-requests.controller';
import { ConfigurationController } from './controllers/configuration.controller';
import { ProjectsController } from './controllers/projects.controller';
import { SonarqubeController } from './controllers/sonarqube.controller';
import { ArchitectureController } from './controllers/architecture.controller';
import { LoggingMiddleware } from './middleware/logging.middleware';
import {
  PullRequestsRepository,
  PullRequestFiltersRepository,
  PipelinesRepository,
  PipelineFiltersRepository,
  CodeMetricsRepository,
  IssuesRepository,
  JiraIssuesClient,
  SonarqubeMeasuresClient,
  CommitTraverser,
  ConfigurationRepository,
  Configuration,
  PipelinesService,
  PRsService,
  PullRequestFactory,
  SonarQubeService,
  SonarqubeRepository,
  SonarqubeFactory,
  PairingFactory,
  BigOService,
  ArchitectureService,
} from '@smmachine/core';
import PipelineFactory from '@smmachine/core/domain/pipelines/factories/pipeline-factory';
import { PairingService } from '@smmachine/core/domain/code/pairing/pairing-service';
import { TimeZoneProvider } from '@smmachine/core/infrastructure/timezone-provider';
import { Logger } from '@smmachine/utils';

function buildDataDirectories(config: Configuration) {
  const baseDir = config.storeData || './outputs';
  const gitProvider = config.gitProvider || 'github';
  const repoSlug = (config.githubRepository || '').replace('/', '_');
  const dataDirectory = path.join(baseDir, `${gitProvider}_${repoSlug}`);

  return {
    gitProviderDirectory: path.join(dataDirectory, gitProvider),
    jiraDirectory: path.join(dataDirectory, 'jira'),
    sonarqubeDirectory: path.join(dataDirectory, 'sonarqube'),
    codemaatDirectory: path.join(dataDirectory, 'codemaat'),
  };
}

function createLogger(config: Configuration, name: string): Logger {
  return new Logger(name, {
    level: config.loggingLevel,
    filePath: config.getLogPath(),
    storeLogs: config.storeLogs,
  });
}

function createRequestTimeZoneProvider(config: Configuration, req: Record<string, unknown>) {
  const request = req as { query?: { timezone?: string } };
  const requestTimezone = request.query?.timezone;
  const timezone = requestTimezone || config.timezone || 'UTC';

  try {
    return new TimeZoneProvider(timezone);
  } catch {
    return new TimeZoneProvider(config.timezone || 'UTC');
  }
}

/**
 * REST API Module
 *
 * Provides NestJS module configuration for the metrics API.
 * All providers and repositories are initialized here.
 *
 * Dependencies:
 * - ConfigurationRepository: Loads environment variables and smm_config.json
 * - GitHub Clients: Real API integration
 * - Jira Client: Issue tracking
 * - SonarQube Client: Code quality metrics
 * - Git Traverser: Local repository analysis
 * - CodeMaat Analyzer: Code churn and coupling
 * - Repositories: Data access layer
 */
@Module({
  controllers: [
    MetricsController,
    CodeController,
    PipelinesController,
    PullRequestsController,
    ConfigurationController,
    ProjectsController,
    SonarqubeController,
    ArchitectureController,
  ],
  providers: [
    // Configuration Repository (singleton — caches project list)
    {
      provide: ConfigurationRepository,
      useFactory: () =>
        new ConfigurationRepository(process.env, undefined, new Logger('ConfigurationRepository')),
    },

    // Configuration (request-scoped — resolved per request from ?project= query param)
    {
      provide: Configuration,
      scope: Scope.REQUEST,
      useFactory: (configRepo: ConfigurationRepository, req: Record<string, unknown>) => {
        const request = req as { query?: { project?: string }; url?: string };
        const projectName = request.query?.project as string | undefined;
        if (projectName) {
          const projectConfig = configRepo.getProjectByName(projectName);
          if (projectConfig) {
            return configRepo.fromProjectConfig(projectConfig);
          }
        }
        // Fallback: use default active configuration
        return configRepo.getActiveConfiguration();
      },
      inject: [ConfigurationRepository, REQUEST],
    },
    {
      provide: TimeZoneProvider,
      scope: Scope.REQUEST,
      useFactory: (config: Configuration, req: Record<string, unknown>) =>
        createRequestTimeZoneProvider(config, req),
      inject: [Configuration, REQUEST],
    },

    // Jira Client
    {
      provide: JiraIssuesClient,
      useFactory: (config: Configuration) =>
        new JiraIssuesClient(
          config.jiraUrl || '',
          config.jiraEmail || '',
          config.jiraToken || '',
          config.jiraProject || '',
          createLogger(config, 'JiraIssuesClient')
        ),
      inject: [Configuration],
    },

    // SonarQube Client
    {
      provide: SonarqubeMeasuresClient,
      useFactory: (config: Configuration) =>
        new SonarqubeMeasuresClient(
          config.sonarUrl || '',
          config.sonarToken || '',
          config.sonarProject || '',
          createLogger(config, 'SonarqubeMeasuresClient')
        ),
      inject: [Configuration],
    },

    // Git & CodeMaat
    {
      provide: CommitTraverser,
      useFactory: (config: Configuration) =>
        new CommitTraverser(
          config.gitRepositoryLocation || '.',
          createLogger(config, 'CommitTraverser')
        ),
      inject: [Configuration],
    },
    // Repositories
    {
      provide: PullRequestsRepository,
      useFactory: (config: Configuration, timeZoneProvider: TimeZoneProvider) => {
        return PullRequestFactory.create(
          config,
          createLogger(config, 'PullRequestsRepository'),
          timeZoneProvider
        );
      },
      inject: [Configuration, TimeZoneProvider],
    },
    {
      provide: PullRequestFiltersRepository,
      useFactory: (config: Configuration) => {
        return PullRequestFactory.createFilters(
          config,
          createLogger(config, 'PullRequestFiltersRepository')
        );
      },
      inject: [Configuration],
    },
    {
      provide: PipelinesRepository,
      useFactory: (config: Configuration, timeZoneProvider: TimeZoneProvider) => {
        return PipelineFactory.create(
          config,
          createLogger(config, 'PipelinesRepository'),
          timeZoneProvider
        ).pipelineRepository;
      },
      inject: [Configuration, TimeZoneProvider],
    },
    {
      provide: PipelineFiltersRepository,
      useFactory: (config: Configuration, timeZoneProvider: TimeZoneProvider) => {
        return PipelineFactory.create(
          config,
          createLogger(config, 'PipelineFiltersRepository'),
          timeZoneProvider
        ).pipelineFiltersRepository;
      },
      inject: [Configuration, TimeZoneProvider],
    },
    {
      provide: PipelinesService,
      useFactory: (
        pipelineRepository: PipelinesRepository,
        configuration: Configuration,
        timeZoneProvider: TimeZoneProvider
      ) => {
        return new PipelinesService(
          pipelineRepository,
          configuration,
          createLogger(configuration, 'PipelinesService'),
          timeZoneProvider
        );
      },
      inject: [PipelinesRepository, Configuration, TimeZoneProvider],
    },
    {
      provide: CodeMetricsRepository,
      useFactory: (config: Configuration) => {
        return new CodeMetricsRepository(config, createLogger(config, 'CodeMetricsRepository'));
      },
      inject: [Configuration],
    },
    {
      provide: IssuesRepository,
      useFactory: (
        client: JiraIssuesClient,
        config: Configuration,
        timeZoneProvider: TimeZoneProvider
      ) => {
        const paths = buildDataDirectories(config);
        return new IssuesRepository(
          client,
          paths.jiraDirectory,
          createLogger(config, 'IssuesRepository'),
          timeZoneProvider,
          config
        );
      },
      inject: [JiraIssuesClient, Configuration, TimeZoneProvider],
    },
    {
      provide: SonarqubeRepository,
      useFactory: (config: Configuration) => {
        const repo = SonarqubeFactory.create(config, createLogger(config, 'SonarqubeRepository'));
        return repo;
      },
      inject: [Configuration],
    },
    {
      provide: PRsService,
      useFactory: (
        pullRequestRepository: PullRequestsRepository,
        config: Configuration,
        timeZoneProvider: TimeZoneProvider
      ) => {
        return new PRsService(
          pullRequestRepository,
          timeZoneProvider,
          createLogger(config, 'PRsService')
        );
      },
      inject: [PullRequestsRepository, Configuration, TimeZoneProvider],
    },
    {
      provide: SonarQubeService,
      useFactory: (sonarqubeRepository: SonarqubeRepository, config: Configuration) => {
        return new SonarQubeService(sonarqubeRepository, createLogger(config, 'SonarQubeService'));
      },
      inject: [SonarqubeRepository, Configuration],
    },
    {
      provide: PairingService,
      useFactory: (config: Configuration, timeZoneProvider: TimeZoneProvider) => {
        return PairingFactory.create(
          config,
          createLogger(config, 'PairingService'),
          timeZoneProvider
        );
      },
      inject: [Configuration, TimeZoneProvider],
    },
    {
      provide: BigOService,
      useFactory: (config: Configuration) => {
        return new BigOService(config);
      },
      inject: [Configuration],
    },
    {
      provide: ArchitectureService,
      scope: Scope.REQUEST,
      useFactory: (config: Configuration) => {
        return new ArchitectureService(config, createLogger(config, 'ArchitectureService'));
      },
      inject: [Configuration],
    },
  ],
  exports: [Configuration, ConfigurationRepository],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Register logging middleware for all routes
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
