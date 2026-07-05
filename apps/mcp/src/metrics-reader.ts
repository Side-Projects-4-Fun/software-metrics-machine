import {
  ICodeMetricsRepository,
  Configuration,
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
  type PipelineFilters,
  type PRFilters,
  TimeZoneProvider,
  ConfigurationRepository,
  PipelineFactory,
  CodemaatFactory,
} from '@smmachine/core';
import { Logger, type LogLevel } from '@smmachine/utils';

type MetricsReaderOptions = {
  project?: string;
  timezone?: string;
};

type MetricFilters = {
  startDate?: string;
  endDate?: string;
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
      new Logger('SmmMcpServer')
    );

    this.configuration = configurationRepository.getActiveConfiguration();
    this.timeZoneProvider = new TimeZoneProvider(
      options.timezone || this.configuration.timezone || 'UTC'
    );
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

  async getCodeMetrics(filters: MetricFilters): Promise<unknown> {
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
    const coupling = await codeRepository.getFileCoupling(filters as CodeMaatEntityFilterOptions);

    return {
      pairingIndex: pairing,
      codeChurn: churn,
      fileCoupling: coupling,
    };
  }

  async getIssueMetrics(filters: MetricFilters): Promise<unknown> {
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
}

export function createMcpMetricsReader(options: MetricsReaderOptions = {}): McpMetricsReader {
  return new McpMetricsReader(options);
}
