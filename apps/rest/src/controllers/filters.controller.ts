import { Controller, Get, Put, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Configuration, SavedFiltersStore, FileSystemSavedFiltersAdapter } from '@smmachine/core';
import type { SavedFiltersDocument } from '@smmachine/core';

@ApiTags('Filters')
@Controller()
export class FiltersController {
  constructor(private readonly config: Configuration) {}

  private getStore(): SavedFiltersStore {
    const baseDir = this.config.getBaseDirectory();
    const adapter = new FileSystemSavedFiltersAdapter(baseDir);
    return new SavedFiltersStore(adapter);
  }

  @Get('/filters')
  async getAllFilters(): Promise<SavedFiltersDocument> {
    const store = this.getStore();
    const filters = await store.getAll();
    const reports = await store.getReports();
    return { version: 1, filters, reports };
  }

  @Put('/filters')
  async putAllFilters(@Body() document: SavedFiltersDocument): Promise<SavedFiltersDocument> {
    const store = this.getStore();
    await store.replaceAll(document);
    const filters = await store.getAll();
    const reports = await store.getReports();
    return { version: 1, filters, reports };
  }
}
