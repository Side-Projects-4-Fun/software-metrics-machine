import { Controller, Get, Inject, Logger, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { CodeDashboardData, CodeEvaluation } from '@smmachine/core';
import {
  BigOService,
  CodeEvaluationService,
  ICodeMetricsRepository,
  SonarqubeMeasuresClient,
} from '@smmachine/core';
import { PairingService } from '@smmachine/core/domain/code/pairing/pairing-service';

function calculateCrapScore(complexity: number, coverage: number): number {
  const normalizedCoverage = Math.min(Math.max(coverage, 0), 100) / 100;
  const rawScore = complexity ** 2 * (1 - normalizedCoverage) ** 3 + complexity;
  return Math.round(rawScore * 10) / 10;
}

interface SonarqubeRawComponentMeasure {
  key: string;
  name: string;
  type?: string;
  qualifier?: string;
  measures: Array<{
    key: string;
    name: string;
    metric?: string;
    value: string | number;
    formatter: string;
  }>;
}

interface CrapMetricEntry {
  name: string;
  complexity: number;
  coverage: number;
  crap: number;
}

function metricValue(measures: SonarqubeRawComponentMeasure['measures'], metric: string): number {
  const measure = measures.find((item) => item.metric === metric || item.name === metric);
  const numeric = Number(measure?.value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function isFileComponent(component: SonarqubeRawComponentMeasure): boolean {
  const componentType = component.type || component.qualifier;
  return !componentType || componentType === 'FIL';
}

function toCrapEntries(components: SonarqubeRawComponentMeasure[]): CrapMetricEntry[] {
  return components
    .filter(isFileComponent)
    .map((component) => {
      const complexity = metricValue(component.measures, 'complexity');
      const coverage = metricValue(component.measures, 'coverage');
      return {
        name: component.name || component.key,
        complexity,
        coverage,
        crap: calculateCrapScore(complexity, coverage),
      };
    })
    .filter((entry) => entry.complexity > 0);
}

@ApiTags('Code Evaluation')
@Controller()
export class CodeEvaluationController {
  private readonly evaluationService = new CodeEvaluationService();
  private readonly logger = new Logger(CodeEvaluationController.name);

  constructor(
    private readonly pairingService: PairingService,
    @Inject('ICodeMetricsRepository')
    private readonly codemaat: ICodeMetricsRepository,
    private readonly bigOService: BigOService,
    private readonly sonarqubeClient: SonarqubeMeasuresClient
  ) {}

  @Get('/code/evaluate')
  async evaluate(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('ignore_files') ignoreFiles?: string,
    @Query('include_only') includeOnly?: string,
    @Query('top') top?: number,
    @Query('authors') authors?: string
  ): Promise<CodeEvaluation> {
    const filterOptions = {
      ignorePatterns: ignoreFiles,
      includePatterns: includeOnly,
      top,
    };

    const [
      entityChurn,
      coupling,
      entityEffort,
      churnResult,
      entityOwnership,
      pairing,
      bigOFiles,
      sonarqubeComponents,
    ] = await Promise.all([
      this.codemaat.getEntityChurn(filterOptions),
      this.codemaat.getFileCoupling({
        ...filterOptions,
        sortBy: 'degree' as const,
      }),
      this.codemaat.getEntityEffort(filterOptions),
      this.codemaat.getCodeChurn({ startDate, endDate }),
      this.codemaat.getEntityOwnership({
        ...filterOptions,
        authors,
      }),
      this.pairingService
        .getPairingIndex({
          startDate,
          endDate,
          includeAuthors: authors,
        })
        .catch((error: unknown) => {
          this.logger.warn(
            `Failed to get pairing index: ${error instanceof Error ? error.message : String(error)}`
          );
          return null;
        }),
      this.bigOService
        .listFiles({
          ignorePatterns: ignoreFiles,
          includePatterns: includeOnly,
          limit: top ? Number(top) : 200,
        })
        .catch((error: unknown) => {
          this.logger.warn(
            `Failed to list Big O files: ${error instanceof Error ? error.message : String(error)}`
          );
          return [];
        }),
      this.sonarqubeClient
        .fetchComponentTree({
          metrics: ['complexity', 'coverage'],
          depth: -1,
        })
        .catch((error: unknown) => {
          this.logger.warn(
            `Failed to fetch SonarQube component tree: ${error instanceof Error ? error.message : String(error)}`
          );
          return [];
        }),
    ]);

    const crapMetrics = toCrapEntries(sonarqubeComponents as SonarqubeRawComponentMeasure[]);

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
      crapMetrics,
    };

    return this.evaluationService.evaluate(dashboardData);
  }
}
