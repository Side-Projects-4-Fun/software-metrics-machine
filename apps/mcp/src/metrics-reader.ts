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

  async getDeploymentMetrics(filters: MetricFilters): Promise<unknown> {
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

  async getCodeMetrics(filters: CodeMetricFilters = {}): Promise<unknown> {
    const codeRepository = CodemaatFactory.create(
      this.configuration,
      createLogger(this.configuration, 'CodeMetricsRepository')
    );
    const pairingService = PairingFactory.create(
      this.configuration,
      createLogger(this.configuration, 'PairingService'),
      this.timeZoneProvider
    );

    const pairing = await pairingService.getPairingIndex(filters);
    const churn = await codeRepository.getCodeChurn(filters as CodeMaatChurnOptions);
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

  async getIssueMetrics(filters: IssueMetricFilters = {}): Promise<unknown> {
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

  async getQualityMetrics(filters: MetricFilters = {}): Promise<unknown> {
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

  async getFullReport(filters: MetricFilters = {}): Promise<unknown> {
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

  async getEngineeringHealthEvaluation(args: EngineeringHealthArguments): Promise<unknown> {
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

    return orchestrator.evaluate(input);
  }

  async getDoraMetrics(args: DoraMetricsArguments): Promise<unknown> {
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

  async listArchitectureSnapshots(): Promise<unknown> {
    const service = new ArchitectureService(
      this.configuration,
      createLogger(this.configuration, 'ArchitectureService')
    );

    return service.listSnapshots();
  }

  async getArchitectureView(args: ArchitectureViewArguments): Promise<unknown> {
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
}

export function createMcpMetricsReader(options: MetricsReaderOptions = {}): McpMetricsReader {
  return new McpMetricsReader(options);
}
