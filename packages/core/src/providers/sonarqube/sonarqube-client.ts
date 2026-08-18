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

      // Pagination applies to the number of measures for each metric: every page
      // returns one history entry per analysis for each requested metric, so we
      // loop over pages until the reported total of analyses is covered and merge
      // the per-metric history across pages.
      const historyByMetric = new Map<string, CodeMetric[]>();
      const metricOrder: string[] = [];
      let pageIndex = 1;
      let totalAnalyses = 0;
      let pageSize = 100;

      do {
        const response = await this.axiosInstance.get('/api/measures/search_history', {
          params: {
            component: this.projectKey,
            metrics: metrics.join(','),
            ...(options?.startDate && { from: options.startDate }),
            ...(options?.endDate && { to: options.endDate }),
            p: pageIndex,
            ps: 100, // Max 100 results per page
          },
        });

        const { measures, paging } = response.data;

        if (!measures || measures.length === 0) {
          break;
        }

        for (const measure of measures) {
          let historyEntries = historyByMetric.get(measure.metric);
          if (!historyEntries) {
            historyEntries = [];
            historyByMetric.set(measure.metric, historyEntries);
            metricOrder.push(measure.metric);
          }

          for (const history of measure.history || []) {
            historyEntries.push({
              key: `${measure.metric}_${history.date}`,
              name: `${measure.metric} on ${history.date}`,
              metric: measure.metric,
              value: history.value || 0,
              formatter: measure.metric === 'coverage' ? 'PERCENT' : 'NUMBER',
              timestamp: history.date,
            });
          }
        }

        // When the API does not return a paging object, treat the response as a single page.
        if (!paging) {
          break;
        }

        totalAnalyses = paging.total ?? 0;
        pageSize = paging.pageSize ?? 100;
        pageIndex += 1;
      } while (pageIndex <= Math.ceil(totalAnalyses / pageSize));

      // Flatten merged history keeping the original metric-first ordering.
      const flatMeasures = metricOrder.flatMap((metric) => historyByMetric.get(metric) ?? []);

      if (flatMeasures.length === 0) {
        this.logger.warn(`No historical measures found for project ${this.projectKey}`);
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

      const allComponents: SonarqubeComponentTreeMeasure[] = [];
      let baseComponent: SonarqubeComponentTreeMeasure | undefined;
      let pageIndex = 1;
      let total = 0;

      do {
        const response = await this.axiosInstance.get('/api/measures/component_tree', {
          params: { ...treeParams, p: pageIndex },
        });

        const { baseComponent: pageBase, components, paging } = response.data;

        if (!pageBase) {
          throw new Error(`Component ${component} not found in SonarQube.`);
        }

        // The base component is repeated on every page — keep only the first one.
        if (!baseComponent) {
          baseComponent = pageBase;
        }

        const pageComponents: SonarqubeComponentTreeMeasure[] = components || [];
        allComponents.push(...pageComponents);

        // When the API does not return a paging object, treat the response as a single page.
        total = paging?.total ?? allComponents.length;
        pageIndex += 1;

        // Guard against an inconsistent server that reports a total larger than
        // the sum of returned pages but stops returning components.
        if (pageComponents.length === 0) {
          break;
        }
      } while (allComponents.length < total);

      const result = baseComponent ? [baseComponent, ...allComponents] : allComponents;

      this.logger.info(`Fetched component tree with ${result.length} components for ${component}`);

      return result;
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
