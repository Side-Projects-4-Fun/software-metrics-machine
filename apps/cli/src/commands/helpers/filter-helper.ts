import { FilterResolver } from '@smmachine/core/domain/filters/filter-resolver';
import type { SmmCommand } from '../commands/smm-command';
import type { DashboardFilters, DashboardSection, SavedFilterEntry } from '@smmachine/core';

const filterResolver = new FilterResolver();

export async function listFilters(
  command: SmmCommand,
  section?: DashboardSection
): Promise<SavedFilterEntry[]> {
  return filterResolver.listFilters(command.getConfiguration(), section);
}

export async function saveFilter(
  command: SmmCommand,
  section: DashboardSection,
  name: string,
  filters: DashboardFilters,
  repository?: string
): Promise<SavedFilterEntry> {
  return filterResolver.saveFilter(
    command.getConfiguration(),
    section,
    name,
    filters,
    repository ?? ''
  );
}

export async function showFilter(
  command: SmmCommand,
  nameOrId: string
): Promise<SavedFilterEntry | null> {
  return filterResolver.showFilter(command.getConfiguration(), nameOrId);
}

export async function deleteFilter(command: SmmCommand, nameOrId: string): Promise<boolean> {
  return filterResolver.deleteFilter(command.getConfiguration(), nameOrId);
}

export async function resolveSavedFilterOptions(
  command: SmmCommand,
  section: DashboardSection,
  explicitOptions: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return filterResolver.resolveSavedFilterOptions(
    command.getConfiguration(),
    section,
    explicitOptions
  );
}
