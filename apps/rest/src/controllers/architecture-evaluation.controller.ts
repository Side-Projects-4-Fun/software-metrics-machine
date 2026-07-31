import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { ArchitectureDashboardData, ArchitectureEvaluation } from '@smmachine/core';
import {
  ArchitectureEvaluationService,
  ArchitectureService,
  ArchitectureViewLevel,
} from '@smmachine/core';

@ApiTags('Architecture Evaluation')
@Controller()
export class ArchitectureEvaluationController {
  private readonly evaluationService = new ArchitectureEvaluationService();

  constructor(private readonly architectureService: ArchitectureService) {}

  @Get('/architecture/evaluate')
  async evaluate(
    @Query('snapshot_id') snapshotId?: string,
    @Query('level') levelRaw?: string,
    @Query('ignore_files') ignoreFiles?: string,
    @Query('include_only') includeOnly?: string
  ): Promise<ArchitectureEvaluation> {
    const level: ArchitectureViewLevel =
      levelRaw === 'context' ||
      levelRaw === 'container' ||
      levelRaw === 'component' ||
      levelRaw === 'code'
        ? levelRaw
        : 'container';

    const snapshot = await this.architectureService.getSnapshot(snapshotId);
    let viewResult = snapshot?.views.find((v) => v.level === level) || null;

    if (snapshot && viewResult && (ignoreFiles || includeOnly)) {
      const filtered = await this.architectureService.getView(level, snapshot.snapshotId, {
        ignorePatterns: ignoreFiles,
        includePatterns: includeOnly,
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
              'Generate an architecture snapshot via `smm architecture generate` or the REST API before running evaluation.',
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

    return this.evaluationService.evaluate(dashboardData);
  }
}
