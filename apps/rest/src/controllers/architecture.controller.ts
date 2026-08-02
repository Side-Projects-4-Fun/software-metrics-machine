import { Controller, Get, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  ArchitectureService,
  ArchitectureViewLevel,
  type ArchitectureSnapshotHeader,
  type ArchitectureView,
} from '@smmachine/core';

@ApiTags('Architecture')
@Controller()
export class ArchitectureController {
  constructor(private readonly architectureService: ArchitectureService) {}

  @Get('/architecture/snapshots')
  async snapshots(): Promise<{ result: ArchitectureSnapshotHeader[] }> {
    return {
      result: await this.architectureService.listSnapshots(),
    };
  }

  @Get('/architecture/summary')
  @ApiQuery({
    name: 'snapshot_id',
    required: false,
    type: String,
    description: 'Snapshot id. Defaults to latest snapshot when omitted.',
  })
  async summary(@Query('snapshot_id') snapshotId?: string): Promise<{ result: object | null }> {
    const snapshot = await this.architectureService.getSnapshot(snapshotId);
    if (!snapshot) {
      return {
        result: null,
      };
    }

    return {
      result: {
        snapshot_id: snapshot.snapshotId,
        generated_at: snapshot.generatedAt,
        project: snapshot.project,
        branch: snapshot.branch,
        commit_count: snapshot.commitCount,
        views: snapshot.views.map((view) => ({
          level: view.level,
          title: view.title,
          nodes: view.nodes.length,
          edges: view.edges.length,
        })),
      },
    };
  }

  @Get('/architecture/view')
  @ApiQuery({
    name: 'level',
    required: false,
    type: String,
    description: 'View level: context, container, component, or code',
  })
  @ApiQuery({
    name: 'snapshot_id',
    required: false,
    type: String,
    description: 'Snapshot id. Defaults to latest snapshot when omitted.',
  })
  @ApiQuery({
    name: 'ignore_files',
    required: false,
    type: String,
    description: 'Comma or newline separated file patterns to ignore',
  })
  @ApiQuery({
    name: 'include_only',
    required: false,
    type: String,
    description: 'Comma or newline separated file patterns to include',
  })
  async view(
    @Query('level') level: ArchitectureViewLevel = 'container',
    @Query('snapshot_id') snapshotId?: string,
    @Query('ignore_files') ignoreFiles?: string,
    @Query('include_only') includeOnly?: string
  ): Promise<{ result: ArchitectureView | null }> {
    const view = await this.architectureService.getView(level, snapshotId, {
      ignorePatterns: ignoreFiles,
      includePatterns: includeOnly,
    });
    return {
      result: view,
    };
  }
}
