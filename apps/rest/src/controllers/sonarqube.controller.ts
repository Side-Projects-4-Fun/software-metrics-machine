import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { Logger as SmmLogger } from '@smmachine/utils';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiOkResponse } from '@nestjs/swagger';
import {
  SonarqubeComponentMeasure,
  SonarqubeComponentTreeMeasure,
  SonarqubeMeasure,
  SonarqubeRepository,
} from '@smmachine/core';
import { ComponentTreeQueryDto, QualityMetricsQueryDto } from '../dtos/index';
import { ErrorResponse } from '../dtos/response.dto';

/**
 * SonarQube API Controller
 *
 * Exposes SonarQube endpoints through REST API.
 * Delegates to SonarqubeMeasuresClient for business logic.
 */
@ApiTags('SonarQube')
@Controller('sonarqube')
export class SonarqubeController {
  private readonly logger = new SmmLogger('SonarqubeController', 'CRITICAL');

  constructor(private sonarqubeRepository: SonarqubeRepository) {}

  /**
   * GET /api/measures/component_tree
   * Retrieve component tree metrics from SonarQube
   *
   * Query Parameters:
   * - component: Component key to fetch tree for (defaults to configured project)
   * - depth: Depth of tree traversal (-1 for all depths, default: -1)
   * - metrics: SonarQube metrics to include (e.g., complexity, cognitive_complexity)
   *
   * Example: GET /api/measures/component_tree?component=my:project&depth=-1&metrics=complexity,cognitive_complexity
   */
  @Get('component-tree')
  @ApiOperation({ summary: 'Get component tree with metrics' })
  @ApiQuery({
    name: 'component',
    required: false,
    type: String,
    example: 'my:project',
    description: 'Component key',
  })
  @ApiQuery({
    name: 'depth',
    required: false,
    type: Number,
    example: -1,
    description: 'Depth of tree (-1 for all depths)',
  })
  @ApiQuery({
    name: 'metrics',
    required: false,
    type: [String],
    example: 'complexity,cognitive_complexity',
    description: 'Comma-separated metrics',
  })
  @ApiQuery({
    name: 'ignore_files',
    required: false,
    type: [String],
    example: '*.test.ts,node_modules/*',
    description: 'Comma-separated file/component ignore patterns (supports glob)',
  })
  @ApiQuery({
    name: 'include_files',
    required: false,
    type: [String],
    example: '*.ts,src/**',
    description:
      'Comma-separated file/component include patterns (supports glob). When set, only matching components are returned.',
  })
  @ApiQuery({
    name: 'remove_folders',
    required: false,
    type: Boolean,
    example: true,
    description: 'Remove directory components (type=DIR) from results',
  })
  @ApiOkResponse({
    description: 'Component tree retrieved successfully',
    type: Object,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication failed',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Component not found',
    type: ErrorResponse,
  })
  async getComponentTree(
    @Query() query: ComponentTreeQueryDto
  ): Promise<SonarqubeComponentTreeMeasure[]> {
    try {
      this.logger.debug(`Loading component tree: ${JSON.stringify(query)}`);

      const components = await this.sonarqubeRepository.loadComponentTree({
        component: query.component,
        depth: query.depth,
        metrics: query.metrics,
        ignore_files: query.ignore_files,
        include_files: query.include_files,
        remove_folders: query.remove_folders,
      });

      return components;
    } catch (error) {
      this.logger.error(
        `Failed to fetch component tree: ${error}`,
        error instanceof Error ? error.stack : ''
      );
      throw new HttpException(
        `Failed to fetch component tree: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * GET /api/metrics/quality
   * Retrieve quality metrics from SonarQube
   *
   * Query Parameters:
   * - measures: Specific metrics to retrieve (can be repeated)
   *   Available: coverage, complexity, sqale_rating, duplicated_lines_density, ncloc, vulnerability_rating
   *
   * Example: GET /api/metrics/quality?measures=coverage&measures=complexity
   */
  @Get('quality')
  @ApiOperation({ summary: 'Get code quality metrics' })
  @ApiQuery({ name: 'measures', required: false, type: [String], example: 'coverage' })
  @ApiOkResponse({
    description: 'Quality metrics retrieved successfully',
    type: Object,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
    type: ErrorResponse,
  })
  async getQualityMetrics(
    @Query() query: QualityMetricsQueryDto
  ): Promise<SonarqubeComponentMeasure | null> {
    try {
      this.logger.debug(`Loading quality metrics: ${JSON.stringify(query)}`);
      return await this.sonarqubeRepository.loadAll({ measures: query.measures });
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
   * GET /sonarqube/measurements
   * Retrieve all measurements from SonarQube
   *
   * Example: GET /sonarqube/measurements
   */
  @Get('measurements')
  @ApiOperation({ summary: 'Get all SonarQube measurements' })
  @ApiOkResponse({
    description: 'Measurements retrieved successfully',
    type: Array,
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication failed',
    type: ErrorResponse,
  })
  async getMeasurements(): Promise<SonarqubeMeasure[]> {
    try {
      this.logger.debug('Loading all SonarQube measurements');
      return await this.sonarqubeRepository.loadMeasurements();
    } catch (error) {
      this.logger.error(
        `Failed to fetch SonarQube measurements: ${error}`,
        error instanceof Error ? error.stack : ''
      );
      throw new HttpException(
        `Failed to fetch SonarQube measurements: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * GET /sonarqube/measurements/history
   * Retrieve all timestamped measurement entries
   */
  @Get('measurements/history')
  @ApiOperation({ summary: 'Get all timestamped SonarQube measurement entries' })
  @ApiOkResponse({
    description: 'Measurement history retrieved successfully',
    type: Array,
  })
  async getMeasurementHistory(): Promise<Array<{ fetchedAt: string; data: SonarqubeMeasure[] }>> {
    try {
      this.logger.debug('Loading SonarQube measurement history');
      return await this.sonarqubeRepository.loadAllMeasurementEntries();
    } catch (error) {
      this.logger.error(
        `Failed to fetch SonarQube measurement history: ${error}`,
        error instanceof Error ? error.stack : ''
      );
      throw new HttpException(
        `Failed to fetch SonarQube measurement history: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * GET /sonarqube/component-tree/history
   * Retrieve all timestamped component tree entries
   */
  @Get('component-tree/history')
  @ApiOperation({ summary: 'Get timestamped SonarQube component tree entries' })
  @ApiOkResponse({
    description: 'Component tree history retrieved successfully',
    type: Array,
  })
  async getComponentTreeHistory(
    @Query() query: ComponentTreeQueryDto
  ): Promise<Array<{ fetchedAt: string; data: SonarqubeComponentTreeMeasure[] }>> {
    try {
      this.logger.debug(`Loading SonarQube component tree history: ${JSON.stringify(query)}`);
      return await this.sonarqubeRepository.loadAllComponentTreeEntries({
        component: query.component,
        depth: query.depth,
        metrics: query.metrics,
        ignore_files: query.ignore_files,
        include_files: query.include_files,
        remove_folders: query.remove_folders,
      });
    } catch (error) {
      this.logger.error(
        `Failed to fetch SonarQube component tree history: ${error}`,
        error instanceof Error ? error.stack : ''
      );
      throw new HttpException(
        `Failed to fetch SonarQube component tree history: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
