import React from 'react';
import { render, screen } from '@testing-library/react';
import PipelineRunsDurationCard from '@/components/charts/pipeline/PipelineRunsDurationCard';
import { LinkBuilderProvider } from '@/components/providers/LinkBuilderContext';
import { FiltersProvider } from '@/components/filters/FiltersContext';
import { defaultFilters } from '@/components/filters/DashboardFilters';
import { DashboardConfigurationBuilder } from '../builders/builders';

const configuration = new DashboardConfigurationBuilder()
  .withGithubRepository('acme/widgets')
  .withGitRepositoryLocation('')
  .withDashboardColor('')
  .build();

describe('PipelineRunsDurationCard', () => {
  it('keeps the workflow link and links the average duration to workflow metrics', () => {
    render(
      <FiltersProvider initialFilters={{ ...defaultFilters, startDate: '2026-01-01', endDate: '2026-01-31' }}>
        <LinkBuilderProvider config={configuration}>
          <PipelineRunsDurationCard
            dataByAggregation={{
              avg: [
                {
                  workflow: '.github/workflows/ci.yml',
                  avg_duration: 5,
                  avg_duration_formatted: '5 min',
                  min_duration: 3,
                  min_duration_formatted: '3 min',
                  max_duration: 8,
                  max_duration_formatted: '8 min',
                  total_runs: 10,
                },
              ],
              min: [],
              max: [],
            }}
            runsByDay={[]}
            jobsDurationByWorkflow={[]}
          />
        </LinkBuilderProvider>
      </FiltersProvider>
    );

    expect(screen.getByRole('link', { name: '.github/workflows/ci.yml' })).toHaveAttribute(
      'href',
      'https://github.com/acme/widgets/actions/workflows/.github/workflows/ci.yml'
    );
    expect(screen.getByRole('link', { name: '5 min' })).toHaveAttribute(
      'href',
      'https://github.com/acme/widgets/actions/metrics/performance?dateRangeType=DATE_RANGE_TYPE_CUSTOM&tab=jobs&filters=workflow_file_name%3A%22ci.yml%22&range=1767225600000-1769903999999'
    );
  });
});
