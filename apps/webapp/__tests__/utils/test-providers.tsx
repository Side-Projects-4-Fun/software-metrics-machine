import React from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { FiltersProvider } from '@/components/filters/FiltersContext';
import { LinkBuilderProvider } from '@/components/providers/LinkBuilderContext';
import { ConfigurationProvider } from '@/components/providers/ConfigurationContext';
import { ProjectsProvider } from '@/components/providers/ProjectsContext';
import { DashboardConfigurationBuilder } from '../builders/builders';
import type { DashboardGlobalConfiguration, ProjectItem } from '@/server/api/configuration';
import type { DashboardFilters } from '@/components/filters/DashboardFilters';

interface RenderWithProvidersOptions {
  config?: DashboardGlobalConfiguration;
  initialFilters?: DashboardFilters;
  projects?: ProjectItem[];
  initialActiveProject?: string;
}

function createProviders(
  config: DashboardGlobalConfiguration,
  initialFilters?: DashboardFilters,
  projects?: ProjectItem[],
  initialActiveProject?: string,
) {
  return function Providers({ children }: { children: React.ReactNode }) {
    return (
      <ConfigurationProvider config={config}>
        <ProjectsProvider
          projects={projects ?? [{ github_repository: config.github_repository }]}
          initialActiveProject={initialActiveProject ?? config.github_repository}
        >
          <FiltersProvider initialFilters={initialFilters}>
            <LinkBuilderProvider config={config}>
              {children}
            </LinkBuilderProvider>
          </FiltersProvider>
        </ProjectsProvider>
      </ConfigurationProvider>
    );
  };
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: RenderWithProvidersOptions,
): RenderResult {
  const config = options?.config ?? new DashboardConfigurationBuilder().build();
  const Providers = createProviders(
    config,
    options?.initialFilters,
    options?.projects,
    options?.initialActiveProject,
  );
  return render(ui, { wrapper: Providers });
}

export function createTestProviders(
  config?: DashboardGlobalConfiguration,
  initialFilters?: DashboardFilters,
  projects?: ProjectItem[],
  initialActiveProject?: string,
) {
  const resolvedConfig = config ?? new DashboardConfigurationBuilder().build();
  return createProviders(resolvedConfig, initialFilters, projects, initialActiveProject);
}
