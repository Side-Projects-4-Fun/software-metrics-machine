import React from 'react';
import { render, screen } from '@testing-library/react';
import JobsRerunCard from '@/components/charts/pipeline/JobsRerunCard';
import { LinkBuilderProvider } from '@/components/providers/LinkBuilderContext';
import { FiltersProvider } from '@/components/filters/FiltersContext';
import { defaultFilters } from '@/components/filters/DashboardFilters';
import { DashboardConfigurationBuilder } from '../builders/builders';

const configuration = new DashboardConfigurationBuilder()
  .withGithubRepository('acme/widgets')
  .withGitRepositoryLocation('')
  .withDashboardColor('')
  .build();

describe('JobsRerunCard', () => {
  it('renders job names as external links to provider job metrics', () => {
    render(
      <FiltersProvider initialFilters={{ ...defaultFilters, startDate: '2026-01-01', endDate: '2026-01-31' }}>
        <LinkBuilderProvider config={configuration}>
          <JobsRerunCard
            data={[
              {
                workflow_name: '.github/workflows/ci.yml',
                job_name: 'Build and Test',
                total_runs: 12,
                value: 4,
                value_formatted: '4 min',
                method: 'average',
                success_count: 10,
                failure_count: 2,
                success_rate: 83.3,
                failure_rate: 16.7,
                rerun_count: 3,
              },
            ]}
            dataByDay={[]}
          />
        </LinkBuilderProvider>
      </FiltersProvider>
    );

    const link = screen.getByRole('link', { name: 'Build and Test' });

    expect(link).toHaveAttribute(
      'href',
      'https://github.com/acme/widgets/actions/metrics/performance?dateRangeType=DATE_RANGE_TYPE_CUSTOM&tab=jobs&filters=workflow_file_name%3A%22ci.yml%22+job_name%3A%22Build%20and%20Test%22&range=1767225600000-1769903999999'
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
