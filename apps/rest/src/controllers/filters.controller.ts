import { Controller, Get, Put, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Configuration } from '@smmachine/core';
import { SavedFiltersStore, FileSystemSavedFiltersAdapter } from '@smmachine/core';
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
    return { version: 1, filters };
  }

  @Put('/filters')
  async putAllFilters(@Body() document: SavedFiltersDocument): Promise<SavedFiltersDocument> {
    const store = this.getStore();

    const existing = await store.getAll();
    for (const entry of existing) {
      await store.remove(entry.id);
    }

    for (const entry of document.filters) {
      await store.save(entry.section, entry.pathname, entry.name, entry.filters, entry.repository);
    }

    const updated = await store.getAll();
    return { version: 1, filters: updated };
  }
}
