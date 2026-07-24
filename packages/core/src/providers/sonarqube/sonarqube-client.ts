import type { AxiosInstance } from 'axios';
import axios from 'axios';
import type { Logger } from '@smmachine/utils';
import type { SonarqubeComponentMeasure, SonarqubeComponentTreeMeasure, CodeMetric } from '.';

export interface ISonarqubeMeasuresClient {
  fetchComponentMeasures(options?: { metrics?: string[] }): Promise<SonarqubeComponentMeasure>;

  fetchHistoricalMeasures(options?: {
    metrics?: string[];
    startDate?: string;
    endDate?: string;
  }): Promise<CodeMetric[]>;

  fetchComponentTree(options?: {
    component?: string;
    depth?: number;
    metrics?: string[];
  }): Promise<SonarqubeComponentTreeMeasure[]>;
}

/**
 * SonarQube API client for Code Quality Metrics
 * Real implementation using SonarQube Web API
 * Endpoints utilized:
 *   - GET /api/measures/component - Get current component measures
 *   - GET /api/measures/search_history - Get historical measures over time
 * Auth: SonarCloud (sonarcloud.io) uses ?token= query param; self-hosted uses HTTP Basic.
 */
export class SonarqubeMeasuresClient implements ISonarqubeMeasuresClient {
  private axiosInstance: AxiosInstance;
  private logger: Logger;
  private isSonarCloud: boolean;

  constructor(
    private url: string,
    private token: string,
    private projectKey: string,
    logger: Logger
  ) {
    this.logger = logger;

    // Ensure URL ends without slash for consistency
    const baseURL = this.url.endsWith('/') ? this.url.slice(0, -1) : this.url;
    this.isSonarCloud = baseURL === 'https://sonarcloud.io';

    this.axiosInstance = axios.create({
      baseURL,
      timeout: 30000,
      ...(this.isSonarCloud
        ? { params: { token: this.token } }
        : { auth: { username: this.token, password: '' } }),
    });
  }

  async fetchComponentMeasures(options?: {
    metrics?: string[];
  }): Promise<SonarqubeComponentMeasure> {
    try {
      const metrics = options?.metrics || [
        'coverage',
        'sqale_rating',
        'complexity',
        'duplicated_lines_density',
        'ncloc',
        'code_smells',
        'bugs',
      ];

      this.logger.info(
        `Fetching SonarQube metrics for project ${this.projectKey} (${this.url}): ${metrics.join(', ')}`
      );

      const response = await this.axiosInstance.get('/api/measures/component', {
        params: {
          component: this.projectKey,
          metricKeys: metrics.join(','),
        },
      });

      const { component } = response.data;

      if (!component) {
        throw new Error(`Project ${this.projectKey} not found in SonarQube.`);
      }

      this.logger.info(
        `Fetched ${(component.measures || []).length} metrics for project ${this.projectKey}`
      );

      return component;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to fetch SonarQube measures: ${errorMsg}`);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('SonarQube authentication failed. Check token.');
        } else if (error.response?.status === 403) {
          throw new Error(
            `SonarQube access denied for project ${this.projectKey}. ` +
              'Ensure the token user has Browse permission for this project.'
          );
        } else if (error.response?.status === 404) {
          throw new Error(`SonarQube project ${this.projectKey} not found.`);
        } else if (error.code === 'ECONNABORTED') {
          throw new Error('SonarQube API request timeout (30s).');
        }
      }

      throw error;
    }
  }

  async fetchHistoricalMeasures(options?: {
    metrics?: string[];
    startDate?: string;
    endDate?: string;
  }): Promise<CodeMetric[]> {
    try {
      // Default metrics if not specified
      const metrics = options?.metrics || ['sqale_rating', 'coverage', 'duplicated_lines_density'];

      this.logger.info(
        `Fetching SonarQube historical metrics for project ${this.projectKey}` +
          (options?.startDate ? ` from ${options.startDate}` : '') +
          (options?.endDate ? ` to ${options.endDate}` : '')
      );

      const response = await this.axiosInstance.get('/api/measures/search_history', {
        params: {
          component: this.projectKey,
          metrics: metrics.join(','),
          ...(options?.startDate && { from: options.startDate }),
          ...(options?.endDate && { to: options.endDate }),
          p: 1, // First page
          ps: 100, // Max 100 results per page
        },
      });

      const { measures } = response.data;

      if (!measures || measures.length === 0) {
        this.logger.warn(`No historical measures found for project ${this.projectKey}`);
        return [];
      }

      // Flatten measurements
      const flatMeasures: CodeMetric[] = [];
      for (const measure of measures) {
        for (const history of measure.history || []) {
          flatMeasures.push({
            key: `${measure.metric}_${history.date}`,
            name: `${measure.metric} on ${history.date}`,
            metric: measure.metric,
            value: history.value || 0,
            formatter: measure.metric === 'coverage' ? 'PERCENT' : 'NUMBER',
            timestamp: history.date,
          });
        }
      }

      this.logger.info(
        `Fetched ${flatMeasures.length} historical measurements for project ${this.projectKey}`
      );

      return flatMeasures;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to fetch SonarQube historical measures: ${errorMsg}`);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('SonarQube authentication failed. Check token.');
        } else if (error.response?.status === 403) {
          throw new Error(
            `SonarQube access denied for project ${this.projectKey}. ` +
              'Ensure the token user has Browse permission for this project.'
          );
        } else if (error.code === 'ECONNABORTED') {
          throw new Error('SonarQube API request timeout (30s).');
        }
      }

      throw error;
    }
  }

  async fetchComponentTree(options?: {
    component?: string;
    depth?: number;
    metrics?: string[];
  }): Promise<SonarqubeComponentTreeMeasure[]> {
    try {
      const component = options?.component || this.projectKey;
      const depth = options?.depth ?? -1; // -1 means all depths
      const metrics = options?.metrics || [
        'complexity',
        'cognitive_complexity',
        'ncloc',
        'sqale_rating',
        'coverage',
      ];

      const treeParams: Record<string, string | number> = {
        component,
        metricKeys: metrics.join(','),
        ps: 500,
        ...(this.isSonarCloud ? { depth } : { strategy: 'all' }),
      };

      this.logger.info(
        `Fetching SonarQube component tree for component ${component} ` +
          `with depth ${depth}: ${metrics.join(', ')}`
      );

      const response = await this.axiosInstance.get('/api/measures/component_tree', {
        params: treeParams,
      });

      const { baseComponent, components } = response.data;

      if (!baseComponent) {
        throw new Error(`Component ${component} not found in SonarQube.`);
      }

      const allComponents = [baseComponent, ...(components || [])];

      this.logger.info(
        `Fetched component tree with ${allComponents.length} components for ${component}`
      );

      return allComponents;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to fetch SonarQube component tree: ${errorMsg}`);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('SonarQube authentication failed. Check token.');
        } else if (error.response?.status === 403) {
          throw new Error(
            `SonarQube access denied for component ${options?.component || this.projectKey}. ` +
              'Ensure the token user has Browse permission for this project/component.'
          );
        } else if (error.response?.status === 404) {
          throw new Error(
            `SonarQube component ${options?.component || this.projectKey} not found.`
          );
        } else if (error.code === 'ECONNABORTED') {
          throw new Error('SonarQube API request timeout (30s).');
        }
      }

      throw error;
    }
  }
}
