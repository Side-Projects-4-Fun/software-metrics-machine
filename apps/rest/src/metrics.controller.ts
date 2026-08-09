import { Controller, Get, Query, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Logger as SmmLogger, formatDuration } from '@smmachine/utils';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiOkResponse } from '@nestjs/swagger';
import {
  ICodeMetricsRepository,
  IssuesRepository,
  PairingIndexService,
  PipelinesService,
  ChangeRequestsService,
  SonarQubeService,
} from '@smmachine/core';
import {
  IssueMetricsQueryDto,
  ChangeRequestMetricsQueryDto,
  DeploymentMetricsQueryDto,
  CodeMetricsQueryDto,
  QualityMetricsQueryDto,
  ErrorResponse,
  MetricsIssueResponse,
  MetricsChangeRequestsResponse,
  MetricsDeploymentResponse,
  MetricsCodeResponse,
  MetricsQualityResponse,
  MetricsFullReportResponse,
} from './dtos';

/**
 * Metrics API Controller
 *
 * Exposes all metrics through REST endpoints.
 *
 * Each endpoint supports date filtering via query parameters:
 * - startDate: ISO 8601 date or datetime
 * - endDate: ISO 8601 date or datetime
 */
@ApiTags('Metrics')
@Controller('')
export class MetricsController {
  private readonly logger = new SmmLogger('MetricsController', 'CRITICAL');

  constructor(
    private changeRequestsService: ChangeRequestsService,
    private pipelinesService: PipelinesService,
    @Inject('ICodeMetricsRepository')
    private codeMetricsRepository: ICodeMetricsRepository,
    private issuesRepository: IssuesRepository,
    private sonarqubeService: SonarQubeService,
    private pairingService: PairingIndexService
  ) {}

  /**
   * GET /api/metrics/issues
   * Retrieve issue metrics from Jira
   */
  @Get('api/metrics/issues')
  @ApiOperation({ summary: 'Get issue metrics' })
  @ApiQuery({ name: 'status', required: false, type: String, example: 'Done' })
  @ApiQuery({ name: 'startDate', required: false, type: String, example: '2024-01-01T08:30:00Z' })
  @ApiQuery({ name: 'endDate', required: false, type: String, example: '2024-12-31T17:45:00Z' })
  @ApiOkResponse({ description: 'Issue metrics retrieved successfully', type: Object })
  @ApiResponse({ status: 400, description: 'Invalid query parameters', type: ErrorResponse })
  async getIssueMetrics(@Query() query: IssueMetricsQueryDto): Promise<MetricsIssueResponse> {
    try {
      this.logger.debug(`Fetching issue metrics: ${JSON.stringify(query)}`);
      return (await this.getIssueMetricsReport({
        status: query.status,
        startDate: query.startDate,
        endDate: query.endDate,
      })) as MetricsIssueResponse;
    } catch (error) {
      this.logger.error(
        `Failed to fetch issue metrics: ${error}`,
        error instanceof Error ? error.stack : ''
      );
      throw new HttpException(
        `Failed to fetch issue metrics: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * GET /api/metrics/change-requests
   * Retrieve change request metrics
   */
  @Get('api/metrics/change-requests')
  @ApiOperation({ summary: 'Get change request metrics' })
  @ApiQuery({ name: 'startDate', required: false, type: String, example: '2024-01-01T08:30:00Z' })
  @ApiQuery({ name: 'endDate', required: false, type: String, example: '2024-12-31T17:45:00Z' })
  @ApiOkResponse({ description: 'Change request metrics retrieved successfully', type: Object })
  @ApiResponse({ status: 500, description: 'Internal server error', type: ErrorResponse })
  async getChangeRequestMetrics(
    @Query() query: ChangeRequestMetricsQueryDto
  ): Promise<MetricsChangeRequestsResponse> {
    try {
      this.logger.debug(`Fetching change request metrics: ${JSON.stringify(query)}`);
      const metrics = await this.changeRequestsService.getMetrics({
        startDate: query.startDate,
        endDate: query.endDate,
      });

      return {
        openDays: metrics.openDays,
        openDays_formatted: formatDuration(metrics.openDays, 'days'),
        totalChangeRequests: metrics.totalChangeRequests,
        mergedChangeRequests: metrics.mergedChangeRequests,
        closedChangeRequests: metrics.closedChangeRequests,
        openChangeRequests: metrics.openChangeRequests,
        comments: metrics.comments,
        most_commented_change_requests: metrics.most_commented_change_requests,
        leadTime: metrics.leadTime,
        leadTime_formatted: formatDuration(metrics.leadTime, 'hours'),
        method: metrics.method,
        commentSummary: metrics.commentSummary,
        labelSummary: metrics.labelSummary?.map((label) => ({
          label: label.label,
          count: label.count,
          openDays: label.openDays,
          openDays_formatted: formatDuration(label.openDays, 'days'),
        })),
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch change request metrics: ${error}`,
        error instanceof Error ? error.stack : ''
      );
      throw new HttpException(
        `Failed to fetch change request metrics: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * GET /api/metrics/deployment
   * Retrieve deployment/pipeline metrics
   */
  @Get('api/metrics/deployment')
  @ApiOperation({ summary: 'Get deployment metrics' })
  @ApiQuery({ name: 'frequency', required: false, enum: ['day', 'week', 'month'] })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiOkResponse({ description: 'Deployment metrics retrieved successfully', type: Object })
  @ApiResponse({ status: 500, description: 'Internal server error', type: ErrorResponse })
  async getDeploymentMetrics(
    @Query() query: DeploymentMetricsQueryDto
  ): Promise<MetricsDeploymentResponse> {
    try {
      this.logger.debug(`Fetching deployment metrics: ${JSON.stringify(query)}`);
      return (await this.getDeploymentMetricsReport({
        frequency: query.frequency,
        startDate: query.startDate,
        endDate: query.endDate,
      })) as MetricsDeploymentResponse;
    } catch (error) {
      this.logger.error(
        `Failed to fetch deployment metrics: ${error}`,
        error instanceof Error ? error.stack : ''
      );
      throw new HttpException(
        `Failed to fetch deployment metrics: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * GET /api/metrics/code
   * Retrieve code metrics
   */
  @Get('api/metrics/code')
  @ApiOperation({ summary: 'Get code metrics' })
  @ApiQuery({ name: 'selectedAuthors', required: false, type: [String] })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiOkResponse({ description: 'Code metrics retrieved successfully', type: Object })
  @ApiResponse({ status: 500, description: 'Internal server error', type: ErrorResponse })
  async getCodeMetrics(@Query() query: CodeMetricsQueryDto): Promise<MetricsCodeResponse> {
    try {
      this.logger.debug(`Fetching code metrics: ${JSON.stringify(query)}`);
      return (await this.getCodeMetricsReport({
        selectedAuthors: query.selectedAuthors,
        startDate: query.startDate,
        endDate: query.endDate,
      })) as MetricsCodeResponse;
    } catch (error) {
      this.logger.error(
        `Failed to fetch code metrics: ${error}`,
        error instanceof Error ? error.stack : ''
      );
      throw new HttpException(
        `Failed to fetch code metrics: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * GET /api/metrics/quality
   * Retrieve quality metrics from SonarQube
   */
  @Get('api/metrics/quality')
  @ApiOperation({ summary: 'Get quality metrics' })
  @ApiQuery({ name: 'measures', required: false, type: [String] })
  @ApiOkResponse({ description: 'Quality metrics retrieved successfully', type: Object })
  @ApiResponse({ status: 500, description: 'Internal server error', type: ErrorResponse })
  async getQualityMetrics(@Query() query: QualityMetricsQueryDto): Promise<MetricsQualityResponse> {
    try {
      this.logger.debug(`Fetching quality metrics: ${JSON.stringify(query)}`);
      return (await this.sonarqubeService.getQualityMetrics(
        query.measures
      )) as MetricsQualityResponse;
    } catch (error) {
      this.logger.error(
        `Failed to fetch quality metrics: ${error}`,
        error instanceof Error ? error.stack : ''
      );
      throw new HttpException(
        `Failed to fetch quality metrics: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * GET /api/metrics/report
   * Retrieve complete metrics report
   */
  @Get('api/metrics/report')
  @ApiOperation({ summary: 'Get complete metrics report' })
  @ApiOkResponse({ description: 'Complete metrics report', type: Object })
  @ApiResponse({ status: 500, description: 'Internal server error', type: ErrorResponse })
  async getFullReport(): Promise<MetricsFullReportResponse> {
    try {
      this.logger.debug('Fetching full metrics report');
      const [changeRequests, deployment, code, issues, quality] = await Promise.all([
        this.changeRequestsService.getMetrics(),
        this.getDeploymentMetricsReport(),
        this.getCodeMetricsReport(),
        this.getIssueMetricsReport(),
        this.sonarqubeService.getQualityMetrics(),
      ]);

      const formattedChangeRequests: MetricsChangeRequestsResponse = {
        openDays: changeRequests.openDays,
        openDays_formatted: formatDuration(changeRequests.openDays, 'days'),
        totalChangeRequests: changeRequests.totalChangeRequests,
        mergedChangeRequests: changeRequests.mergedChangeRequests,
        closedChangeRequests: changeRequests.closedChangeRequests,
        openChangeRequests: changeRequests.openChangeRequests,
        comments: changeRequests.comments,
        most_commented_change_requests: changeRequests.most_commented_change_requests,
        leadTime: changeRequests.leadTime,
        leadTime_formatted: formatDuration(changeRequests.leadTime, 'hours'),
        method: changeRequests.method,
        commentSummary: changeRequests.commentSummary,
        labelSummary: changeRequests.labelSummary?.map((label) => ({
          label: label.label,
          count: label.count,
          openDays: label.openDays,
          openDays_formatted: formatDuration(label.openDays, 'days'),
        })),
      };

      return {
        timestamp: new Date().toISOString(),
        changeRequests: formattedChangeRequests,
        deployment,
        code,
        issues,
        quality,
      } as MetricsFullReportResponse;
    } catch (error) {
      this.logger.error(
        `Failed to fetch full report: ${error}`,
        error instanceof Error ? error.stack : ''
      );
      throw new HttpException(
        `Failed to fetch full report: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private async getDeploymentMetricsReport(filters?: DeploymentMetricsQueryDto): Promise<{
    pipelineMetrics: Awaited<ReturnType<PipelinesService['getMetrics']>>;
    deploymentFrequency: Awaited<
      ReturnType<PipelinesService['getDeploymentFrequencyWithAllIntervals']>
    >;
    jobMetrics: Awaited<ReturnType<PipelinesService['getJobMetrics']>>;
  }> {
    const pipelineMetrics = await this.pipelinesService.getMetrics(filters);
    const deploymentFrequency =
      await this.pipelinesService.getDeploymentFrequencyWithAllIntervals(filters);
    const jobMetrics = await this.pipelinesService.getJobMetrics(filters);

    return {
      pipelineMetrics,
      deploymentFrequency,
      jobMetrics,
    };
  }

  private async getCodeMetricsReport(filters?: CodeMetricsQueryDto): Promise<{
    pairingIndex: Awaited<ReturnType<PairingIndexService['getPairingIndex']>>;
    codeChurn: Awaited<ReturnType<ICodeMetricsRepository['getCodeChurn']>>;
    fileCoupling: Awaited<ReturnType<ICodeMetricsRepository['getFileCoupling']>>;
  }> {
    const pairingIndex = await this.pairingService.getPairingIndex(filters);
    const codeChurn = await this.codeMetricsRepository.getCodeChurn({
      startDate: filters?.startDate,
      endDate: filters?.endDate,
    });
    const fileCoupling = await this.codeMetricsRepository.getFileCoupling({
      authors: filters?.selectedAuthors,
    });

    return {
      pairingIndex,
      codeChurn,
      fileCoupling,
    };
  }

  private async getIssueMetricsReport(filters?: IssueMetricsQueryDto): Promise<{
    totalIssues: number;
    issues: Awaited<ReturnType<IssuesRepository['getIssues']>>;
  }> {
    const issues = await this.issuesRepository.getIssues(filters);

    return {
      totalIssues: issues.length,
      issues,
    };
  }
}
