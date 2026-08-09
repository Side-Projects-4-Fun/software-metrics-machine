import { Controller, Get, Put, Body, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  Configuration,
  ConfigurationRepository,
  SavedFiltersStore,
  FileSystemSavedFiltersAdapter,
} from '@smmachine/core';
import type { SavedFiltersDocument } from '@smmachine/core';

@ApiTags('Filters')
@Controller()
export class FiltersController {
  constructor(
    private readonly config: Configuration,
    private readonly configRepository: ConfigurationRepository
  ) {}

  private getStore(config: Configuration): SavedFiltersStore {
    const baseDir = config.getBaseDirectory();
    const adapter = new FileSystemSavedFiltersAdapter(baseDir);
    return new SavedFiltersStore(adapter);
  }

  @Get('/filters')
  async getAllFilters(@Query('project') project?: string): Promise<SavedFiltersDocument> {
    if (project) {
      const projectConfig = this.configRepository
        .getAllProjects()
        .find((entry) => entry.github_repository === project);
      if (projectConfig) {
        return this.readDocument(this.configRepository.fromProjectConfig(projectConfig));
      }
      // Unknown project — fall back to the request-scoped configuration
      return this.readDocument(this.config);
    }

    // No project given — aggregate saved views from every configured project
    const documents = await Promise.all(
      this.configRepository
        .getAllProjects()
        .map((projectConfig) =>
          this.readDocument(this.configRepository.fromProjectConfig(projectConfig))
        )
    );

    return {
      version: 1,
      filters: documents.flatMap((document) => document.filters),
      reports: documents.flatMap((document) => document.reports ?? []),
    };
  }

  @Put('/filters')
  async putAllFilters(@Body() document: SavedFiltersDocument): Promise<SavedFiltersDocument> {
    const store = this.getStore(this.config);
    await store.replaceAll(document);
    const filters = await store.getAll();
    const reports = await store.getReports();
    return { version: 1, filters, reports };
  }

  private async readDocument(config: Configuration): Promise<SavedFiltersDocument> {
    const store = this.getStore(config);
    const filters = await store.getAll();
    const reports = await store.getReports();
    return { version: 1, filters, reports };
  }
}
