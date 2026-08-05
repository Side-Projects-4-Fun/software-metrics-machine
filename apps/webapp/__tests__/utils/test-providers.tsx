import React from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { FiltersProvider } from '@/components/filters/FiltersContext';
import { LinkBuilderProvider } from '@/components/providers/LinkBuilderContext';
import { ConfigurationProvider } from '@/components/providers/ConfigurationContext';
import { DashboardConfigurationBuilder } from '../builders/builders';
import type { DashboardGlobalConfiguration } from '@/server/api/configuration';
import type { DashboardFilters } from '@/components/filters/DashboardFilters';

interface RenderWithProvidersOptions {
  config?: DashboardGlobalConfiguration;
  initialFilters?: DashboardFilters;
}

function createProviders(config: DashboardGlobalConfiguration, initialFilters?: DashboardFilters) {
  return function Providers({ children }: { children: React.ReactNode }) {
    return (
      <ConfigurationProvider config={config}>
        <FiltersProvider initialFilters={initialFilters}>
          <LinkBuilderProvider config={config}>
            {children}
          </LinkBuilderProvider>
        </FiltersProvider>
      </ConfigurationProvider>
    );
  };
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: RenderWithProvidersOptions,
): RenderResult {
  const config = options?.config ?? new DashboardConfigurationBuilder().build();
  const Providers = createProviders(config, options?.initialFilters);
  return render(ui, { wrapper: Providers });
}

export function createTestProviders(
  config?: DashboardGlobalConfiguration,
  initialFilters?: DashboardFilters,
) {
  const resolvedConfig = config ?? new DashboardConfigurationBuilder().build();
  return createProviders(resolvedConfig, initialFilters);
}
