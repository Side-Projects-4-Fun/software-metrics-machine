import { Controller, Get, Logger, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { SonarqubeDashboardData, SonarqubeEvaluation } from '@smmachine/core';
import { SonarqubeEvaluationService, SonarqubeRepository } from '@smmachine/core';

function metricNumber(
  measures: Array<{ metric?: string; name?: string; key?: string; value?: string | number }>,
  metric: string
): number {
  const measure = measures.find(
    (item) => item.metric === metric || item.name === metric || item.key === metric
  );
  const numeric = Number(measure?.value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

@ApiTags('SonarQube Evaluation')
@Controller()
export class SonarqubeEvaluationController {
  private readonly evaluationService = new SonarqubeEvaluationService();
  private readonly logger = new Logger(SonarqubeEvaluationController.name);

  constructor(private readonly sonarqubeRepository: SonarqubeRepository) {}

  @Get('/sonarqube/evaluate')
  async evaluate(
    @Query('ignore_files') ignoreFiles?: string,
    @Query('include_files') includeFiles?: string,
    @Query('remove_folders') removeFoldersRaw?: string
  ): Promise<SonarqubeEvaluation> {
    const removeFolders = removeFoldersRaw === 'true' || removeFoldersRaw === '1';

    const [quality, componentTree] = await Promise.all([
      this.sonarqubeRepository.loadAll().catch((error: unknown) => {
        this.logger.warn(
          `Failed to load SonarQube quality data: ${error instanceof Error ? error.message : String(error)}`
        );
        return null;
      }),
      this.sonarqubeRepository
        .loadComponentTree({
          ignore_files: ignoreFiles,
          include_files: includeFiles,
          remove_folders: removeFolders,
          metrics: ['complexity', 'cognitive_complexity', 'ncloc', 'coverage', 'sqale_rating'],
        })
        .catch((error: unknown) => {
          this.logger.warn(
            `Failed to load SonarQube component tree: ${error instanceof Error ? error.message : String(error)}`
          );
          return [];
        }),
    ]);

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

    return this.evaluationService.evaluate(dashboardData);
  }
}
