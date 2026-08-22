import type { Configuration } from '@smmachine/core';
import {
  ArchitectureEvaluationService,
  ArchitectureService,
  BigOService,
  CodeEvaluationService,
  createEngineeringHealthOrchestrator,
  DeploymentFrequencyService,
  FileSystemSavedFiltersAdapter,
  HealthCheckService,
  IssuesRepository,
  JiraIssuesClient,
  PairingFactory,
  PipelineEvaluationService,
  PipelineFactory,
  PipelineImplementation,
  PipelinesService,
  ChangeRequestEvaluationService,
  ChangeRequestsService,
  ChangeRequestFactory,
  SavedFiltersStore,
  SonarqubeEvaluationService,
  SonarqubeFactory,
  SonarQubeService,
  type ArchitectureDashboardData,
  type ArchitectureViewLevel,
  type CodeDashboardData,
  type CodeMaatChurnOptions,
  type CodeMaatEntityFilterOptions,
  type EngineeringHealthEvaluationInput,
  type MetricCategory,
  type MetricId,
  type PipelineDashboard,
  type PipelineFilters,
  type ChangeRequestDashboardData,
  type ChangeRequestFilters,
  type SonarqubeDashboardData,
  TimeZoneProvider,
  ConfigurationRepository,
  CodemaatFactory,
  parseMetricCleaningOptions,
  type MetricCleaningOptions,
} from '@smmachine/core';
import { getApplicationVersion, Logger, type LogLevel } from '@smmachine/utils';
import { operationLogger } from './mcp-logger';
import type {
  ArchitectureViewArguments,
  ChangeRequestMetricsArguments,
  CodeEntityArguments,
  CodeHistoryArguments,
  DoraMetricsArguments,
  EngineeringHealthArguments,
  PipelineDashboardArguments,
  SonarqubeComponentTreeArguments,
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
  includePatterns?: string;
  ignorePatterns?: string;
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

function buildChangeRequestFiltersFromArgs(
  args: ChangeRequestMetricsArguments
): ChangeRequestFilters {
  const cleaning: MetricCleaningOptions = parseMetricCleaningOptions({
    weekends: args.weekends,
    outlierMode: args.outlierMode,
  });

  return {
    startDate: args.startDate,
    endDate: args.endDate,
    authors: args.authors,
    excludeAuthors: args.excludeAuthors,
    excludeCommenters: args.excludeCommenters,
    labels: args.labels,
    state: args.status as ChangeRequestFilters['state'],
    cleaning,
  };
}

function buildPipelineFiltersFromArgs(args: PipelineDashboardArguments): PipelineFilters {
  const cleaning: MetricCleaningOptions = parseMetricCleaningOptions({
    weekends: args.weekends,
    outlierMode: args.outlierMode,
  });

  return {
    startDate: args.startDate,
    endDate: args.endDate,
    workflowPath: args.workflowPath,
    status: args.status,
    conclusion: args.conclusion,
    targetBranch: args.branch,
    jobName: args.jobName,
    jobConclusion: args.jobConclusion,
    event: args.event,
    method: args.method,
    cleaning,
  };
}

function buildCodeEntityFilterOptions(args: CodeEntityArguments): CodeMaatEntityFilterOptions {
  return {
    ignorePatterns: args.ignorePatterns,
    includePatterns: args.includePatterns,
    top: args.top,
    authors: args.authors,
  };
}

function buildCodeChurnOptions(args: CodeHistoryArguments): CodeMaatChurnOptions {
  return {
    startDate: args.startDate,
    endDate: args.endDate,
  };
}

function buildSonarqubeComponentTreeOptions(args: SonarqubeComponentTreeArguments): {
  component?: string;
  depth?: number;
  metrics?: string[];
  ignore_files?: string;
  include_files?: string;
  remove_folders?: boolean;
} {
  return {
    component: args.component,
    depth: args.depth,
    metrics: args.metrics ? parseCsvList(args.metrics, 'metrics') : undefined,
    ignore_files: args.ignoreFiles,
    include_files: args.includeFiles,
    remove_folders: args.removeFolders,
  };
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

  async getChangeRequestMetrics(filters: MetricFilters): Promise<unknown> {
    return traceOperation(
      'getChangeRequestMetrics',
      {
        project: this.configuration.githubRepository,
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
      async () => {
        const repository = ChangeRequestFactory.create(
          this.configuration,
          createLogger(this.configuration, 'ChangeRequestsRepository'),
          this.timeZoneProvider
        );
        const service = new ChangeRequestsService(
          repository,
          this.timeZoneProvider,
          createLogger(this.configuration, 'ChangeRequestsService')
        );

        return service.getMetrics(filters as ChangeRequestFilters);
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
        includePatterns: filters.includePatterns,
        ignorePatterns: filters.ignorePatterns,
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
          includePatterns: filters.includePatterns,
          ignorePatterns: filters.ignorePatterns,
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
        operationLogger.debug(
          'getFullReport: fetching change requests, deployment, code, issues, quality'
        );
        const [changeRequests, deployment, code, issues, quality] = await Promise.all([
          this.getChangeRequestMetrics(filters),
          this.getDeploymentMetrics(filters),
          this.getCodeMetrics(filters),
          this.getIssueMetrics(filters),
          this.getQualityMetrics(filters),
        ]);

        return {
          timestamp: new Date().toISOString(),
          changeRequests,
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
            changeRequestLabels: parseCsvList(args.changeRequestLabels, 'changeRequestLabels'),
            rawFilters: args.rawFilters,
            period: args.period,
            weekends: args.weekends,
            outlierMode: args.outlierMode,
          },
          previous: hasPrevious
            ? {
                startDate: args.compareStartDate,
                endDate: args.compareEndDate,
                changeRequestLabels: parseCsvList(args.changeRequestLabels, 'changeRequestLabels'),
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

  async evaluateChangeRequests(filters: MetricFilters = {}): Promise<unknown> {
    return traceOperation(
      'evaluateChangeRequests',
      {
        project: this.configuration.githubRepository,
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
      async () => {
        const repository = ChangeRequestFactory.create(
          this.configuration,
          createLogger(this.configuration, 'ChangeRequestsRepository'),
          this.timeZoneProvider
        );
        const service = new ChangeRequestsService(
          repository,
          this.timeZoneProvider,
          createLogger(this.configuration, 'ChangeRequestsService')
        );
        const evaluationService = new ChangeRequestEvaluationService();

        const changeRequestFilters = filters as ChangeRequestFilters;

        const [
          summary,
          reviewTime,
          openTime,
          byAuthor,
          commentsByAuthor,
          firstCommentTime,
          throughputRaw,
        ] = await Promise.all([
          service.getSummary(changeRequestFilters),
          service.getReviewTime(changeRequestFilters, 20),
          service.getOpenTimeBy(changeRequestFilters),
          service.getByAuthor(changeRequestFilters, 20),
          service.getCommentsByAuthor(changeRequestFilters, 20),
          service.getFirstCommentTime(changeRequestFilters, 20),
          service.getThroughTime(changeRequestFilters),
        ]);

        const throughput = [throughputRaw]
          .flat()
          .reduce<Array<{ period: string; opened: number; closed: number }>>((acc, item) => {
            const existing = acc.find((e) => e.period === item.date);
            if (existing) {
              if (item.kind === 'Opened') existing.opened += item.count;
              if (item.kind === 'Closed') existing.closed += item.count;
            } else {
              acc.push({
                period: item.date,
                opened: item.kind === 'Opened' ? item.count : 0,
                closed: item.kind === 'Closed' ? item.count : 0,
              });
            }
            return acc;
          }, [])
          .sort((a, b) => a.period.localeCompare(b.period));

        const unwrap = <T>(wrapped: { result: T } | T): T =>
          (wrapped && typeof wrapped === 'object' && 'result' in wrapped
            ? wrapped.result
            : wrapped) as T;

        const dashboardData: ChangeRequestDashboardData = {
          summary: summary
            ? (unwrap(
                summary as { result: unknown } | unknown
              ) as ChangeRequestDashboardData['summary'])
            : null,
          reviewTime: Array.isArray(unwrap(reviewTime))
            ? (unwrap(reviewTime) as ChangeRequestDashboardData['reviewTime'])
            : [],
          openTime: Array.isArray(openTime) ? openTime : [],
          byAuthor: Array.isArray(unwrap(byAuthor))
            ? (unwrap(byAuthor) as ChangeRequestDashboardData['byAuthor'])
            : [],
          commentsByAuthor: Array.isArray(unwrap(commentsByAuthor))
            ? (unwrap(commentsByAuthor) as ChangeRequestDashboardData['commentsByAuthor'])
            : [],
          firstCommentTime: Array.isArray(unwrap(firstCommentTime))
            ? (unwrap(firstCommentTime) as ChangeRequestDashboardData['firstCommentTime'])
            : [],
          throughput,
        };

        return evaluationService.evaluate(dashboardData);
      }
    );
  }

  async evaluatePipelines(filters: MetricFilters = {}): Promise<unknown> {
    return traceOperation(
      'evaluatePipelines',
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
        const pipelineImpl = new PipelineImplementation(
          repositories.pipelineRepository,
          this.configuration.getDeploymentFrequencyTargets(),
          createLogger(this.configuration, 'PipelineImplementation'),
          this.timeZoneProvider
        );
        const evaluationService = new PipelineEvaluationService();

        const pipelineFilters = filters as PipelineFilters;
        const dashboard: PipelineDashboard = await pipelineImpl.dashboard(pipelineFilters);

        return evaluationService.evaluate(dashboard);
      }
    );
  }

  async evaluateCode(filters: CodeMetricFilters = {}): Promise<unknown> {
    return traceOperation(
      'evaluateCode',
      {
        project: this.configuration.githubRepository,
        startDate: filters.startDate,
        endDate: filters.endDate,
        authors: filters.authors,
        includePatterns: filters.includePatterns,
        ignorePatterns: filters.ignorePatterns,
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
        const bigOService = new BigOService(this.configuration);
        const evaluationService = new CodeEvaluationService();

        const entityFilterOptions: CodeMaatEntityFilterOptions = {
          includePatterns: filters.includePatterns,
          ignorePatterns: filters.ignorePatterns,
          authors: filters.authors,
        };

        const [
          entityChurn,
          coupling,
          entityEffort,
          churnResult,
          entityOwnership,
          pairing,
          bigOFiles,
        ] = await Promise.all([
          codeRepository.getEntityChurn(entityFilterOptions),
          codeRepository.getFileCoupling({ ...entityFilterOptions, sortBy: 'degree' as const }),
          codeRepository.getEntityEffort(entityFilterOptions),
          codeRepository.getCodeChurn({
            startDate: filters.startDate,
            endDate: filters.endDate,
          } as CodeMaatChurnOptions),
          codeRepository.getEntityOwnership(entityFilterOptions),
          pairingService.getPairingIndex(filters).catch(() => null),
          bigOService.listFiles({ limit: 200 }).catch(() => []),
        ]);

        const dashboardData: CodeDashboardData = {
          entityChurn: Array.isArray(entityChurn) ? entityChurn : [],
          coupling: Array.isArray(coupling) ? coupling : [],
          entityEffort: Array.isArray(entityEffort) ? entityEffort : [],
          codeChurn: churnResult && Array.isArray(churnResult.data) ? churnResult.data : [],
          entityOwnership: Array.isArray(entityOwnership) ? entityOwnership : [],
          pairing: {
            pairingIndexPercentage: pairing?.pairingIndexPercentage ?? 0,
            totalAnalyzedCommits: pairing?.totalAnalyzedCommits ?? 0,
            pairedCommits: pairing?.pairedCommits ?? 0,
            topPairs: (pairing?.topPairings || []).map((p) => ({
              author: p.author,
              coAuthor: p.coAuthor,
              pairedCommits: p.pairedCommits,
            })),
          },
          bigOFiles: Array.isArray(bigOFiles) ? bigOFiles : [],
          crapMetrics: [],
        };

        return evaluationService.evaluate(dashboardData);
      }
    );
  }

  async evaluateQuality(): Promise<unknown> {
    return traceOperation(
      'evaluateQuality',
      { project: this.configuration.githubRepository },
      async () => {
        const repository = SonarqubeFactory.create(
          this.configuration,
          createLogger(this.configuration, 'SonarqubeRepository')
        );
        const evaluationService = new SonarqubeEvaluationService();

        const [quality, componentTree] = await Promise.all([
          repository.loadAll().catch(() => null),
          repository
            .loadComponentTree({
              metrics: ['complexity', 'cognitive_complexity', 'ncloc', 'coverage', 'sqale_rating'],
            })
            .catch(() => []),
        ]);

        const metricNumber = (
          measures: Array<{
            metric?: string;
            name?: string;
            key?: string;
            value?: string | number;
          }>,
          metric: string
        ): number => {
          const measure = measures.find(
            (item) => item.metric === metric || item.name === metric || item.key === metric
          );
          const numeric = Number(measure?.value ?? 0);
          return Number.isFinite(numeric) ? numeric : 0;
        };

        const dashboardData: SonarqubeDashboardData = {
          quality: quality
            ? {
                reliabilityRating: metricNumber(quality.measures, 'reliability_rating'),
                securityRating: metricNumber(quality.measures, 'security_rating'),
                maintainabilityRating: metricNumber(quality.measures, 'sqale_rating'),
                duplicationDensity: metricNumber(quality.measures, 'duplicated_lines_density'),
              }
            : null,
          componentTree: componentTree.map((c) => ({
            key: c.key,
            name: c.name,
            complexity: metricNumber(c.measures, 'complexity'),
            cognitiveComplexity: metricNumber(c.measures, 'cognitive_complexity'),
            ncloc: metricNumber(c.measures, 'ncloc'),
            coverage: metricNumber(c.measures, 'coverage'),
            maintainabilityRating: metricNumber(c.measures, 'sqale_rating'),
          })),
        };

        return evaluationService.evaluate(dashboardData);
      }
    );
  }

  async evaluateArchitecture(args: ArchitectureViewArguments): Promise<unknown> {
    return traceOperation(
      'evaluateArchitecture',
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
        const evaluationService = new ArchitectureEvaluationService();

        const level: ArchitectureViewLevel =
          args.level === 'context' ||
          args.level === 'container' ||
          args.level === 'component' ||
          args.level === 'code'
            ? args.level
            : 'container';

        const snapshot = await service.getSnapshot(args.snapshotId);
        let viewResult = snapshot?.views.find((v) => v.level === level) || null;

        if (snapshot && viewResult && (args.ignorePatterns || args.includePatterns)) {
          const filtered = await service.getView(level, snapshot.snapshotId, {
            ignorePatterns: args.ignorePatterns,
            includePatterns: args.includePatterns,
          });
          viewResult = filtered || viewResult;
        }

        if (!snapshot || !viewResult) {
          return {
            generatedAt: new Date().toISOString(),
            signals: [
              {
                id: 'no_snapshot',
                title: 'No architecture snapshot available',
                description:
                  'Generate an architecture snapshot via `smm architecture generate` before running evaluation.',
                severity: 'good',
                category: 'structure',
                metrics: [],
              },
            ],
            summary: {
              totalContainers: 0,
              totalEdges: 0,
              avgConfidence: 0,
              orphanNodes: 0,
            },
          };
        }

        const dashboardData: ArchitectureDashboardData = {
          snapshotId: snapshot.snapshotId,
          generatedAt: snapshot.generatedAt,
          commitCount: snapshot.commitCount,
          view: {
            level: viewResult.level,
            title: viewResult.title,
            nodes: viewResult.nodes.map((n) => ({
              id: n.id,
              kind: n.kind,
              name: n.name,
              technology: n.technology,
            })),
            edges: viewResult.edges.map((e) => ({
              id: e.id,
              source: e.source,
              target: e.target,
              confidence: e.confidence,
            })),
          },
        };

        return evaluationService.evaluate(dashboardData);
      }
    );
  }

  async listBigOFiles(options?: {
    search?: string;
    ignorePatterns?: string;
    includePatterns?: string;
    limit?: number;
  }): Promise<unknown> {
    return traceOperation(
      'listBigOFiles',
      { project: this.configuration.githubRepository },
      async () => {
        const bigOService = new BigOService(this.configuration);
        return bigOService.listFiles({
          search: options?.search,
          ignorePatterns: options?.ignorePatterns,
          includePatterns: options?.includePatterns,
          limit: options?.limit ?? 200,
        });
      }
    );
  }

  async analyzeBigOFile(filePath: string): Promise<unknown> {
    return traceOperation(
      'analyzeBigOFile',
      { project: this.configuration.githubRepository, filePath },
      async () => {
        const bigOService = new BigOService(this.configuration);
        return bigOService.analyzeFile(filePath);
      }
    );
  }

  async healthCheck(providerFilter?: string, maxGapDays?: number): Promise<unknown> {
    return traceOperation(
      'healthCheck',
      { project: this.configuration.githubRepository, providerFilter, maxGapDays },
      async () => {
        const service = new HealthCheckService();
        return service.generateReport(
          this.configuration,
          providerFilter || 'all',
          maxGapDays ?? 30
        );
      }
    );
  }

  getVersion(): unknown {
    return {
      version: getApplicationVersion(),
      name: 'software-metrics-machine',
    };
  }

  async listChangeRequestFilterOptions(): Promise<unknown> {
    return traceOperation(
      'listChangeRequestFilterOptions',
      { project: this.configuration.githubRepository },
      async () => {
        const filtersRepository = ChangeRequestFactory.createFilters(
          this.configuration,
          createLogger(this.configuration, 'ChangeRequestFiltersRepository')
        );
        return filtersRepository.loadOptions();
      }
    );
  }

  async listPipelineFilterOptions(): Promise<unknown> {
    return traceOperation(
      'listPipelineFilterOptions',
      { project: this.configuration.githubRepository },
      async () => {
        const repositories = PipelineFactory.create(
          this.configuration,
          createLogger(this.configuration, 'PipelinesRepository'),
          this.timeZoneProvider
        );
        return repositories.pipelineFiltersRepository.loadOptions();
      }
    );
  }

  async listCodeAuthors(): Promise<unknown> {
    return traceOperation(
      'listCodeAuthors',
      { project: this.configuration.githubRepository },
      async () => {
        const codeRepository = CodemaatFactory.create(
          this.configuration,
          createLogger(this.configuration, 'CodeMetricsRepository')
        );
        return codeRepository.getEntityOwnership({ select: 'authors' });
      }
    );
  }

  async getChangeRequestSummary(args: ChangeRequestMetricsArguments): Promise<unknown> {
    return traceOperation(
      'getChangeRequestSummary',
      {
        project: this.configuration.githubRepository,
        startDate: args.startDate,
        endDate: args.endDate,
        status: args.status,
      },
      async () => {
        const service = this.createChangeRequestsService();
        return service.getSummary(buildChangeRequestFiltersFromArgs(args));
      }
    );
  }

  async getChangeRequestThroughTime(args: ChangeRequestMetricsArguments): Promise<unknown> {
    return traceOperation(
      'getChangeRequestThroughTime',
      {
        project: this.configuration.githubRepository,
        startDate: args.startDate,
        endDate: args.endDate,
        aggregateBy: args.aggregateBy,
      },
      async () => {
        const service = this.createChangeRequestsService();
        return service.getThroughTime(buildChangeRequestFiltersFromArgs(args), args.aggregateBy);
      }
    );
  }

  async getChangeRequestByAuthor(args: ChangeRequestMetricsArguments): Promise<unknown> {
    return traceOperation(
      'getChangeRequestByAuthor',
      {
        project: this.configuration.githubRepository,
        startDate: args.startDate,
        endDate: args.endDate,
        top: args.top,
      },
      async () => {
        const service = this.createChangeRequestsService();
        return service.getByAuthor(buildChangeRequestFiltersFromArgs(args), args.top ?? 10);
      }
    );
  }

  async getChangeRequestReviewTime(args: ChangeRequestMetricsArguments): Promise<unknown> {
    return traceOperation(
      'getChangeRequestReviewTime',
      {
        project: this.configuration.githubRepository,
        startDate: args.startDate,
        endDate: args.endDate,
        method: args.method,
        top: args.top,
      },
      async () => {
        const service = this.createChangeRequestsService();
        return service.getReviewTime(
          buildChangeRequestFiltersFromArgs(args),
          args.top ?? 10,
          args.method ?? 'average'
        );
      }
    );
  }

  async getChangeRequestOpenTime(args: ChangeRequestMetricsArguments): Promise<unknown> {
    return traceOperation(
      'getChangeRequestOpenTime',
      {
        project: this.configuration.githubRepository,
        startDate: args.startDate,
        endDate: args.endDate,
        aggregateBy: args.aggregateBy,
        method: args.method,
      },
      async () => {
        const service = this.createChangeRequestsService();
        return service.getOpenTimeBy(
          buildChangeRequestFiltersFromArgs(args),
          args.aggregateBy,
          args.method ?? 'average'
        );
      }
    );
  }

  async getChangeRequestComments(args: ChangeRequestMetricsArguments): Promise<unknown> {
    return traceOperation(
      'getChangeRequestComments',
      {
        project: this.configuration.githubRepository,
        startDate: args.startDate,
        endDate: args.endDate,
        method: args.method,
      },
      async () => {
        const service = this.createChangeRequestsService();
        return service.getMetrics(
          buildChangeRequestFiltersFromArgs(args),
          args.method ?? 'average'
        );
      }
    );
  }

  async getChangeRequestCommentsByAuthor(args: ChangeRequestMetricsArguments): Promise<unknown> {
    return traceOperation(
      'getChangeRequestCommentsByAuthor',
      {
        project: this.configuration.githubRepository,
        startDate: args.startDate,
        endDate: args.endDate,
        top: args.top,
      },
      async () => {
        const service = this.createChangeRequestsService();
        return service.getCommentsByAuthor(buildChangeRequestFiltersFromArgs(args), args.top ?? 10);
      }
    );
  }

  async getChangeRequestFirstCommentTime(args: ChangeRequestMetricsArguments): Promise<unknown> {
    return traceOperation(
      'getChangeRequestFirstCommentTime',
      {
        project: this.configuration.githubRepository,
        startDate: args.startDate,
        endDate: args.endDate,
        method: args.method,
        top: args.top,
      },
      async () => {
        const service = this.createChangeRequestsService();
        return service.getFirstCommentTime(
          buildChangeRequestFiltersFromArgs(args),
          args.top ?? 10,
          args.method ?? 'average'
        );
      }
    );
  }

  async getPipelineDashboard(args: PipelineDashboardArguments): Promise<unknown> {
    return traceOperation(
      'getPipelineDashboard',
      {
        project: this.configuration.githubRepository,
        startDate: args.startDate,
        endDate: args.endDate,
        workflowPath: args.workflowPath,
        branch: args.branch,
        method: args.method,
      },
      async () => {
        const pipelineArtifacts = PipelineFactory.create(
          this.configuration,
          createLogger(this.configuration, 'PipelineDashboardRepository'),
          this.timeZoneProvider
        );
        const pipelineImpl = new PipelineImplementation(
          pipelineArtifacts.pipelineRepository,
          this.configuration.getDeploymentFrequencyTargets(),
          createLogger(this.configuration, 'PipelineDashboardImplementation'),
          this.timeZoneProvider
        );
        return pipelineImpl.dashboard(buildPipelineFiltersFromArgs(args));
      }
    );
  }

  async getCodePairingIndex(args: CodeHistoryArguments): Promise<unknown> {
    return traceOperation(
      'getCodePairingIndex',
      {
        project: this.configuration.githubRepository,
        startDate: args.startDate,
        endDate: args.endDate,
      },
      async () => {
        const pairingService = PairingFactory.create(
          this.configuration,
          createLogger(this.configuration, 'PairingService'),
          this.timeZoneProvider
        );
        return pairingService.getPairingIndex({
          startDate: args.startDate,
          endDate: args.endDate,
        });
      }
    );
  }

  async getCodeChurn(args: CodeHistoryArguments): Promise<unknown> {
    return traceOperation(
      'getCodeChurn',
      {
        project: this.configuration.githubRepository,
        startDate: args.startDate,
        endDate: args.endDate,
      },
      async () => {
        const codeRepository = CodemaatFactory.create(
          this.configuration,
          createLogger(this.configuration, 'CodeMetricsRepository')
        );
        return codeRepository.getCodeChurn(buildCodeChurnOptions(args));
      }
    );
  }

  async getCodeChurnHistory(args: CodeHistoryArguments): Promise<unknown> {
    return traceOperation(
      'getCodeChurnHistory',
      {
        project: this.configuration.githubRepository,
        startDate: args.startDate,
        endDate: args.endDate,
      },
      async () => {
        const codeRepository = CodemaatFactory.create(
          this.configuration,
          createLogger(this.configuration, 'CodeMetricsRepository')
        );
        return codeRepository.getCodeChurnHistory(buildCodeChurnOptions(args));
      }
    );
  }

  async getCodeCoupling(args: CodeEntityArguments): Promise<unknown> {
    return traceOperation(
      'getCodeCoupling',
      { project: this.configuration.githubRepository },
      async () => {
        const codeRepository = CodemaatFactory.create(
          this.configuration,
          createLogger(this.configuration, 'CodeMetricsRepository')
        );
        return codeRepository.getFileCoupling({
          ...buildCodeEntityFilterOptions(args),
          sortBy: 'degree',
        });
      }
    );
  }

  async getCodeCouplingHistory(args: CodeEntityArguments): Promise<unknown> {
    return traceOperation(
      'getCodeCouplingHistory',
      { project: this.configuration.githubRepository },
      async () => {
        const codeRepository = CodemaatFactory.create(
          this.configuration,
          createLogger(this.configuration, 'CodeMetricsRepository')
        );
        return codeRepository.getFileCouplingHistory({
          ...buildCodeEntityFilterOptions(args),
          sortBy: 'degree',
        });
      }
    );
  }

  async getCodeLayeredCoupling(args: CodeEntityArguments): Promise<unknown> {
    return traceOperation(
      'getCodeLayeredCoupling',
      { project: this.configuration.githubRepository },
      async () => {
        const codeRepository = CodemaatFactory.create(
          this.configuration,
          createLogger(this.configuration, 'CodeMetricsRepository')
        );
        return codeRepository.getLayeredCoupling({
          ...buildCodeEntityFilterOptions(args),
          sortBy: 'degree',
        });
      }
    );
  }

  async getCodeLayeredCouplingHistory(args: CodeEntityArguments): Promise<unknown> {
    return traceOperation(
      'getCodeLayeredCouplingHistory',
      { project: this.configuration.githubRepository },
      async () => {
        const codeRepository = CodemaatFactory.create(
          this.configuration,
          createLogger(this.configuration, 'CodeMetricsRepository')
        );
        return codeRepository.getLayeredCouplingHistory({
          ...buildCodeEntityFilterOptions(args),
          sortBy: 'degree',
        });
      }
    );
  }

  async getCodeEntityChurn(args: CodeEntityArguments): Promise<unknown> {
    return traceOperation(
      'getCodeEntityChurn',
      { project: this.configuration.githubRepository },
      async () => {
        const codeRepository = CodemaatFactory.create(
          this.configuration,
          createLogger(this.configuration, 'CodeMetricsRepository')
        );
        return codeRepository.getEntityChurn(buildCodeEntityFilterOptions(args));
      }
    );
  }

  async getCodeEntityChurnHistory(args: CodeEntityArguments): Promise<unknown> {
    return traceOperation(
      'getCodeEntityChurnHistory',
      { project: this.configuration.githubRepository },
      async () => {
        const codeRepository = CodemaatFactory.create(
          this.configuration,
          createLogger(this.configuration, 'CodeMetricsRepository')
        );
        return codeRepository.getEntityChurnHistory(buildCodeEntityFilterOptions(args));
      }
    );
  }

  async getCodeEntityEffort(args: CodeEntityArguments): Promise<unknown> {
    return traceOperation(
      'getCodeEntityEffort',
      { project: this.configuration.githubRepository },
      async () => {
        const codeRepository = CodemaatFactory.create(
          this.configuration,
          createLogger(this.configuration, 'CodeMetricsRepository')
        );
        return codeRepository.getEntityEffort(buildCodeEntityFilterOptions(args));
      }
    );
  }

  async getCodeEntityEffortHistory(args: CodeEntityArguments): Promise<unknown> {
    return traceOperation(
      'getCodeEntityEffortHistory',
      { project: this.configuration.githubRepository },
      async () => {
        const codeRepository = CodemaatFactory.create(
          this.configuration,
          createLogger(this.configuration, 'CodeMetricsRepository')
        );
        return codeRepository.getEntityEffortHistory(buildCodeEntityFilterOptions(args));
      }
    );
  }

  async getCodeEntityOwnership(args: CodeEntityArguments): Promise<unknown> {
    return traceOperation(
      'getCodeEntityOwnership',
      { project: this.configuration.githubRepository },
      async () => {
        const codeRepository = CodemaatFactory.create(
          this.configuration,
          createLogger(this.configuration, 'CodeMetricsRepository')
        );
        return codeRepository.getEntityOwnership(buildCodeEntityFilterOptions(args));
      }
    );
  }

  async getCodeEntityOwnershipHistory(args: CodeEntityArguments): Promise<unknown> {
    return traceOperation(
      'getCodeEntityOwnershipHistory',
      { project: this.configuration.githubRepository },
      async () => {
        const codeRepository = CodemaatFactory.create(
          this.configuration,
          createLogger(this.configuration, 'CodeMetricsRepository')
        );
        return codeRepository.getEntityOwnershipHistory(buildCodeEntityFilterOptions(args));
      }
    );
  }

  async getSonarqubeComponentTree(args: SonarqubeComponentTreeArguments): Promise<unknown> {
    return traceOperation(
      'getSonarqubeComponentTree',
      { project: this.configuration.githubRepository, component: args.component },
      async () => {
        const repository = SonarqubeFactory.create(
          this.configuration,
          createLogger(this.configuration, 'SonarqubeRepository')
        );
        return repository.loadComponentTree(buildSonarqubeComponentTreeOptions(args));
      }
    );
  }

  async getSonarqubeComponentTreeHistory(args: SonarqubeComponentTreeArguments): Promise<unknown> {
    return traceOperation(
      'getSonarqubeComponentTreeHistory',
      { project: this.configuration.githubRepository, component: args.component },
      async () => {
        const repository = SonarqubeFactory.create(
          this.configuration,
          createLogger(this.configuration, 'SonarqubeRepository')
        );
        return repository.loadAllComponentTreeEntries(buildSonarqubeComponentTreeOptions(args));
      }
    );
  }

  async getSonarqubeMeasurements(): Promise<unknown> {
    return traceOperation(
      'getSonarqubeMeasurements',
      { project: this.configuration.githubRepository },
      async () => {
        const repository = SonarqubeFactory.create(
          this.configuration,
          createLogger(this.configuration, 'SonarqubeRepository')
        );
        return repository.loadMeasurements();
      }
    );
  }

  async getSonarqubeMeasurementsHistory(): Promise<unknown> {
    return traceOperation(
      'getSonarqubeMeasurementsHistory',
      { project: this.configuration.githubRepository },
      async () => {
        const repository = SonarqubeFactory.create(
          this.configuration,
          createLogger(this.configuration, 'SonarqubeRepository')
        );
        return repository.loadAllMeasurementEntries();
      }
    );
  }

  async getArchitectureSummary(snapshotId?: string): Promise<unknown> {
    return traceOperation(
      'getArchitectureSummary',
      { project: this.configuration.githubRepository, snapshotId },
      async () => {
        const service = new ArchitectureService(
          this.configuration,
          createLogger(this.configuration, 'ArchitectureService')
        );
        const snapshot = await service.getSnapshot(snapshotId);
        if (!snapshot) {
          return null;
        }

        return {
          snapshotId: snapshot.snapshotId,
          generatedAt: snapshot.generatedAt,
          project: snapshot.project,
          branch: snapshot.branch,
          commitCount: snapshot.commitCount,
          views: snapshot.views.map((view) => ({
            level: view.level,
            title: view.title,
            nodes: view.nodes.length,
            edges: view.edges.length,
          })),
        };
      }
    );
  }

  async exportArchitectureView(args: ArchitectureViewArguments): Promise<unknown> {
    return traceOperation(
      'exportArchitectureView',
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
        if (!view) {
          return null;
        }
        return {
          view,
          mermaid: viewToMermaid(view),
        };
      }
    );
  }

  async listSavedFilters(): Promise<unknown> {
    return traceOperation(
      'listSavedFilters',
      { project: this.configuration.githubRepository },
      async () => {
        const baseDir = this.configuration.getBaseDirectory();
        const adapter = new FileSystemSavedFiltersAdapter(baseDir);
        const store = new SavedFiltersStore(adapter);
        const [filters, reports] = await Promise.all([store.getAll(), store.getReports()]);
        return {
          version: 1,
          filters,
          reports,
        };
      }
    );
  }

  private createChangeRequestsService(): ChangeRequestsService {
    const repository = ChangeRequestFactory.create(
      this.configuration,
      createLogger(this.configuration, 'ChangeRequestsRepository'),
      this.timeZoneProvider
    );
    return new ChangeRequestsService(
      repository,
      this.timeZoneProvider,
      createLogger(this.configuration, 'ChangeRequestsService')
    );
  }
}

export function viewToMermaid(view: {
  nodes: Array<{ id: string; name: string; technology?: string }>;
  edges: Array<{
    source: string;
    target: string;
    description?: string;
    kind?: string;
  }>;
}): string {
  const lines: string[] = ['flowchart LR'];

  for (const node of view.nodes) {
    const label = `${node.name}${node.technology ? `\\n${node.technology}` : ''}`;
    lines.push(`  ${sanitizeMermaidId(node.id)}["${label}"]`);
  }

  for (const edge of view.edges) {
    lines.push(
      `  ${sanitizeMermaidId(edge.source)} -->|${edge.description || edge.kind || ''}| ${sanitizeMermaidId(edge.target)}`
    );
  }

  return lines.join('\n');
}

function sanitizeMermaidId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, '_');
}

export function createMcpMetricsReader(options: MetricsReaderOptions = {}): McpMetricsReader {
  return new McpMetricsReader(options);
}
