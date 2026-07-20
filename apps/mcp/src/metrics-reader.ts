import {
  ArchitectureService,
  Configuration,
  createEngineeringHealthOrchestrator,
  DeploymentFrequencyService,
  IssuesRepository,
  JiraIssuesClient,
  PairingFactory,
  PipelinesService,
  PRsService,
  PullRequestFactory,
  SonarQubeService,
  SonarqubeFactory,
  type CodeMaatChurnOptions,
  type CodeMaatEntityFilterOptions,
  type EngineeringHealthEvaluationInput,
  type MetricCategory,
  type MetricId,
  type PipelineFilters,
  type PRFilters,
  TimeZoneProvider,
  ConfigurationRepository,
  PipelineFactory,
  CodemaatFactory,
  parseMetricCleaningOptions,
  type ArchitectureViewLevel,
} from '@smmachine/core';
import { Logger, type LogLevel } from '@smmachine/utils';
import { operationLogger } from './mcp-logger';
import type {
  ArchitectureViewArguments,
  DoraMetricsArguments,
  EngineeringHealthArguments,
} from './validation';
import { parseCsvList } from './validation';

type MetricsReaderOptions = {
  project?: string;
  timezone?: string;
};

async function traceOperation<T>(
  operation: string,
  details: Record<string, unknown>,
  task: () => Promise<T>
): Promise<T> {
  operationLogger.debug(`Started ${operation}`, details);
  const startedAt = Date.now();
  try {
    const result = await task();
    operationLogger.debug(`Completed ${operation}`, {
      ...details,
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    operationLogger.warn(`Failed ${operation}`, {
      ...details,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

type MetricFilters = {
  startDate?: string;
  endDate?: string;
};

type CodeMetricFilters = MetricFilters & {
  authors?: string;
};

type IssueMetricFilters = MetricFilters & {
  status?: string;
};

function createLogger(configuration: Configuration, name: string): Logger {
  return new Logger(name, {
    level: (configuration.loggingLevel || 'CRITICAL') as LogLevel,
    filePath: configuration.getLogPath(),
    storeLogs: configuration.storeLogs,
  });
}

export class McpMetricsReader {
  private readonly configuration: Configuration;
  private readonly timeZoneProvider: TimeZoneProvider;

  constructor(options: MetricsReaderOptions = {}) {
    const configurationRepository = new ConfigurationRepository(
      process.env,
      options.project,
      new Logger('SmmMcpServer', 'CRITICAL')
    );

    this.configuration = configurationRepository.getActiveConfiguration();
    this.timeZoneProvider = new TimeZoneProvider(
      options.timezone || this.configuration.timezone || 'UTC'
    );
  }

  getConfiguration(): Configuration {
    return this.configuration;
  }

  getTimeZoneProvider(): TimeZoneProvider {
    return this.timeZoneProvider;
  }

  async getPRMetrics(filters: MetricFilters): Promise<unknown> {
    return traceOperation(
      'getPRMetrics',
      {
        project: this.configuration.githubRepository,
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
      async () => {
        const repository = PullRequestFactory.create(
          this.configuration,
          createLogger(this.configuration, 'PullRequestsRepository'),
          this.timeZoneProvider
        );
        const service = new PRsService(
          repository,
          this.timeZoneProvider,
          createLogger(this.configuration, 'PRsService')
        );

        return service.getMetrics(filters as PRFilters);
      }
    );
  }

  async getDeploymentMetrics(filters: MetricFilters): Promise<unknown> {
    return traceOperation(
      'getDeploymentMetrics',
      {
        project: this.configuration.githubRepository,
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
      async () => {
        const repositories = PipelineFactory.create(
          this.configuration,
          createLogger(this.configuration, 'PipelinesRepository'),
          this.timeZoneProvider
        );
        const service = new PipelinesService(
          repositories.pipelineRepository,
          this.configuration,
          createLogger(this.configuration, 'PipelinesService'),
          this.timeZoneProvider
        );
        const pipelineFilters = filters as PipelineFilters;

        const metrics = await service.getMetrics(pipelineFilters);
        const frequency = await service.getDeploymentFrequencyWithAllIntervals(pipelineFilters);
        const jobMetrics = await service.getJobMetrics(pipelineFilters);

        return {
          pipelineMetrics: metrics,
          deploymentFrequency: frequency,
          jobMetrics,
        };
      }
    );
  }

  async getCodeMetrics(filters: CodeMetricFilters = {}): Promise<unknown> {
    return traceOperation(
      'getCodeMetrics',
      {
        project: this.configuration.githubRepository,
        startDate: filters.startDate,
        endDate: filters.endDate,
        authors: filters.authors,
      },
      async () => {
        const codeRepository = CodemaatFactory.create(
          this.configuration,
          createLogger(this.configuration, 'CodeMetricsRepository')
        );
        const pairingService = PairingFactory.create(
          this.configuration,
          createLogger(this.configuration, 'PairingService'),
          this.timeZoneProvider
        );

        operationLogger.debug('getCodeMetrics: retrieving pairing index');
        const pairing = await pairingService.getPairingIndex(filters);
        operationLogger.debug('getCodeMetrics: retrieving code churn');
        const churn = await codeRepository.getCodeChurn(filters as CodeMaatChurnOptions);
        operationLogger.debug('getCodeMetrics: retrieving file coupling');
        const coupling = await codeRepository.getFileCoupling({
          authors: filters.authors ? parseCsvList(filters.authors, 'authors') : undefined,
          ...(filters as CodeMaatEntityFilterOptions),
        });

        return {
          pairingIndex: pairing,
          codeChurn: churn,
          fileCoupling: coupling,
        };
      }
    );
  }

  async getIssueMetrics(filters: IssueMetricFilters = {}): Promise<unknown> {
    return traceOperation(
      'getIssueMetrics',
      {
        project: this.configuration.githubRepository,
        startDate: filters.startDate,
        endDate: filters.endDate,
        status: filters.status,
      },
      async () => {
        const client = new JiraIssuesClient(
          this.configuration.jiraUrl || '',
          this.configuration.jiraEmail || '',
          this.configuration.jiraToken || '',
          this.configuration.jiraProject || '',
          createLogger(this.configuration, 'JiraIssuesClient')
        );
        const repository = new IssuesRepository(
          client,
          this.configuration.getJiraPath(),
          createLogger(this.configuration, 'IssuesRepository'),
          this.timeZoneProvider,
          this.configuration
        );
        const issues = await repository.getIssues(filters);

        return {
          totalIssues: issues.length,
          issues,
        };
      }
    );
  }

  async getQualityMetrics(filters: MetricFilters = {}): Promise<unknown> {
    return traceOperation(
      'getQualityMetrics',
      {
        project: this.configuration.githubRepository,
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
      async () => {
        const repository = SonarqubeFactory.create(
          this.configuration,
          createLogger(this.configuration, 'SonarqubeRepository')
        );
        const service = new SonarQubeService(
          repository,
          createLogger(this.configuration, 'SonarQubeService')
        );

        return service.getQualityMetrics(filters);
      }
    );
  }

  async getFullReport(filters: MetricFilters = {}): Promise<unknown> {
    return traceOperation(
      'getFullReport',
      {
        project: this.configuration.githubRepository,
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
      async () => {
        operationLogger.debug('getFullReport: fetching PR, deployment, code, issues, quality');
        const [pullRequests, deployment, code, issues, quality] = await Promise.all([
          this.getPRMetrics(filters),
          this.getDeploymentMetrics(filters),
          this.getCodeMetrics(filters),
          this.getIssueMetrics(filters),
          this.getQualityMetrics(filters),
        ]);

        return {
          timestamp: new Date().toISOString(),
          pullRequests,
          deployment,
          code,
          issues,
          quality,
          filters,
        };
      }
    );
  }

  async getEngineeringHealthEvaluation(args: EngineeringHealthArguments): Promise<unknown> {
    return traceOperation(
      'getEngineeringHealthEvaluation',
      {
        project: this.configuration.githubRepository,
        metric: args.metric,
        category: args.category,
        startDate: args.startDate,
        endDate: args.endDate,
        compareStartDate: args.compareStartDate,
        compareEndDate: args.compareEndDate,
      },
      async () => {
        const orchestrator = createEngineeringHealthOrchestrator(
          this.configuration,
          createLogger(this.configuration, 'EngineeringHealthOrchestrator'),
          this.timeZoneProvider
        );

        const metricIds = parseCsvList(args.metric, 'metric') as MetricId[] | undefined;
        const category = args.category as MetricCategory | undefined;
        const hasPrevious = Boolean(args.compareStartDate || args.compareEndDate);

        const input: EngineeringHealthEvaluationInput = {
          metrics: metricIds,
          category,
          current: {
            startDate: args.startDate,
            endDate: args.endDate,
            prLabels: parseCsvList(args.prLabels, 'prLabels'),
            rawFilters: args.rawFilters,
            period: args.period,
            weekends: args.weekends,
            outlierMode: args.outlierMode,
          },
          previous: hasPrevious
            ? {
                startDate: args.compareStartDate,
                endDate: args.compareEndDate,
                prLabels: parseCsvList(args.prLabels, 'prLabels'),
                rawFilters: args.rawFilters,
                period: args.period,
                weekends: args.weekends,
                outlierMode: args.outlierMode,
              }
            : undefined,
        };

        operationLogger.debug('getEngineeringHealthEvaluation: evaluating orchestrator', {
          metricCount: metricIds?.length ?? 'all',
          hasComparison: hasPrevious,
        });

        return orchestrator.evaluate(input);
      }
    );
  }

  async getDoraMetrics(args: DoraMetricsArguments): Promise<unknown> {
    return traceOperation(
      'getDoraMetrics',
      {
        project: this.configuration.githubRepository,
        workflowPath: args.workflowPath,
        branch: args.branch,
        startDate: args.startDate,
        endDate: args.endDate,
      },
      async () => {
        const pipelineArtifacts = PipelineFactory.create(
          this.configuration,
          createLogger(this.configuration, 'DoraPipelineRepository'),
          this.timeZoneProvider
        );

        const cleaning = parseMetricCleaningOptions({
          weekends: args.weekends,
          outlierMode: args.outlierMode,
        });

        const baseFilters = {
          startDate: args.startDate,
          endDate: args.endDate,
          workflowPath: args.workflowPath,
          status: args.status,
          conclusion: args.conclusion,
          targetBranch: args.branch,
          jobName: args.jobName,
          event: args.event,
          cleaning,
        };

        const pipelinesService = new PipelinesService(
          pipelineArtifacts.pipelineRepository,
          this.configuration,
          createLogger(this.configuration, 'DoraPipelinesService'),
          this.timeZoneProvider
        );

        const deploymentFrequencyService = new DeploymentFrequencyService(
          pipelineArtifacts.pipelineRepository,
          this.configuration.getDeploymentFrequencyTargets(),
          createLogger(this.configuration, 'DeploymentFrequencyService'),
          this.timeZoneProvider
        );

        operationLogger.debug(
          'getDoraMetrics: fetching deployment frequency, pipeline and job metrics'
        );
        const [deploymentFrequency, pipelineMetrics, jobMetrics] = await Promise.all([
          deploymentFrequencyService.getDeploymentFrequencyWithAllIntervals(baseFilters),
          pipelinesService.getMetrics(baseFilters),
          pipelinesService.getJobMetrics(baseFilters),
        ]);

        return {
          timestamp: new Date().toISOString(),
          deploymentFrequency,
          pipelineMetrics,
          jobMetrics,
          filters: baseFilters,
        };
      }
    );
  }

  async listArchitectureSnapshots(): Promise<unknown> {
    return traceOperation(
      'listArchitectureSnapshots',
      { project: this.configuration.githubRepository },
      async () => {
        const service = new ArchitectureService(
          this.configuration,
          createLogger(this.configuration, 'ArchitectureService')
        );

        return service.listSnapshots();
      }
    );
  }

  async getArchitectureView(args: ArchitectureViewArguments): Promise<unknown> {
    return traceOperation(
      'getArchitectureView',
      {
        project: this.configuration.githubRepository,
        level: args.level,
        snapshotId: args.snapshotId,
      },
      async () => {
        const service = new ArchitectureService(
          this.configuration,
          createLogger(this.configuration, 'ArchitectureService')
        );

        const level = (args.level || 'container') as ArchitectureViewLevel;
        const view = await service.getView(level, args.snapshotId, {
          ignorePatterns: args.ignorePatterns,
          includePatterns: args.includePatterns,
        });

        const snapshot = await service.getSnapshot(args.snapshotId);

        return {
          view,
          snapshot: snapshot
            ? {
                snapshotId: snapshot.snapshotId,
                generatedAt: snapshot.generatedAt,
                project: snapshot.project,
                branch: snapshot.branch,
                commitCount: snapshot.commitCount,
              }
            : null,
        };
      }
    );
  }
}

export function createMcpMetricsReader(options: MetricsReaderOptions = {}): McpMetricsReader {
  return new McpMetricsReader(options);
}
