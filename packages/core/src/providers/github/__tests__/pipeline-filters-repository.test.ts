import { describe, expect, it } from 'vitest';
import { PipelineFilterOptions } from '../../..';
import { PipelineGitHubJobBuilder, PipelineGitHubRunBuilder } from '../../../test/github-builders';
import { PipelineFiltersRepositoryJson } from '../../../domain/pipelines/infrastructure/pipeline-filters-repository-json';
import { InMemoryRepository } from '../../../test/in-memory-repository';
import { WorkflowJobJsonResponse, WorkflowJsonResponse } from '../github-response-types';

describe('PipelineFiltersRepository', () => {
  const createRepository = async (
    runs: WorkflowJsonResponse[],
    jobs: WorkflowJobJsonResponse[]
  ) => {
    const pipelineRunRepository = new InMemoryRepository<WorkflowJsonResponse>();
    const pipelineJobsRepository = new InMemoryRepository<WorkflowJobJsonResponse>();
    const pipelineFiltersRepository = new InMemoryRepository<PipelineFilterOptions>();

    await pipelineRunRepository.saveAll(runs);
    await pipelineJobsRepository.saveAll(jobs);

    return new PipelineFiltersRepositoryJson(
      pipelineRunRepository,
      pipelineJobsRepository,
      pipelineFiltersRepository
    );
  };

  it('loads distinct filter options from cached pipeline and job files', async () => {
    const repository = await createRepository(
      [
        {
          ...new PipelineGitHubRunBuilder()
            .id('run-1')
            .name('CI')
            .status('completed')
            .conclusion('success')
            .branch('main')
            .path('.github/workflows/ci.yml')
            .build(),
          event: 'push',
        },
        {
          ...new PipelineGitHubRunBuilder()
            .id('run-2')
            .name('Deploy')
            .status('queued')
            .conclusion('')
            .branch('release')
            .path('.github/workflows/deploy.yml')
            .build(),
          event: 'workflow_dispatch',
        },
        {
          ...new PipelineGitHubRunBuilder()
            .id('run-3')
            .name('CI')
            .status('completed')
            .conclusion('success')
            .branch('main')
            .path('.github/workflows/ci.yml')
            .build(),
          event: 'push',
        },
      ],
      [
        new PipelineGitHubJobBuilder().id('job-1').runId('run-1').name('build').build(),
        new PipelineGitHubJobBuilder().id('job-2').runId('run-1').name('test').build(),
        new PipelineGitHubJobBuilder().id('job-3').runId('run-2').name('deploy').build(),
      ]
    );

    const options = await repository.loadOptions();

    expect(options.workflows).toEqual([
      { name: 'CI', path: '.github/workflows/ci.yml' },
      { name: 'Deploy', path: '.github/workflows/deploy.yml' },
    ]);
    expect(options.statuses).toEqual(['completed', 'queued']);
    expect(options.conclusions).toEqual(['success']);
    expect(options.branches).toEqual(['main', 'release']);
    expect(options.events).toEqual(['push', 'workflow_dispatch']);
    expect(options.jobs).toEqual([
      { name: 'build', id: 'build' },
      { name: 'deploy', id: 'deploy' },
      { name: 'test', id: 'test' },
    ]);
    expect(options.jobsByWorkflowPath).toEqual({
      '.github/workflows/ci.yml': [
        { name: 'build', id: 'build' },
        { name: 'test', id: 'test' },
      ],
      '.github/workflows/deploy.yml': [{ name: 'deploy', id: 'deploy' }],
    });
  });

  it('filters job options by workflow path without loading hydrated pipelines', async () => {
    const repository = await createRepository(
      [
        new PipelineGitHubRunBuilder()
          .id('run-1')
          .name('CI')
          .path('.github/workflows/ci.yml')
          .build(),
        new PipelineGitHubRunBuilder()
          .id('run-2')
          .name('Deploy')
          .path('.github/workflows/deploy.yml')
          .build(),
      ],
      [
        new PipelineGitHubJobBuilder().id('job-1').runId('run-1').name('build').build(),
        new PipelineGitHubJobBuilder().id('job-2').runId('run-2').name('deploy').build(),
      ]
    );

    const options = await repository.loadOptions({
      workflowPath: '.github/workflows/deploy.yml',
    });

    expect(options.jobs).toEqual([{ name: 'deploy', id: 'deploy' }]);
  });
});
