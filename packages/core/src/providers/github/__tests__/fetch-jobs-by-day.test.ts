import { describe, expect, it, vi } from 'vitest';
import { PipelineGitHubJobBuilder, PipelineGitHubRunBuilder } from '../../../test/github-builders';
import { InMemoryRepository } from '../../../test/in-memory-repository';
import { IGithubWorkflowJobClient } from '../..';
import { WorkflowJobJsonResponse, WorkflowJsonResponse } from '../github-response-types';
import { PipelinesJobFetchRepository } from '../pipelines-job-fetch-repository-json';
import { MockLoggerBuilder } from '../../../test/mock-logger-builder';

describe('Fetch jobs pipeline repository - By day', () => {
  const configuration = {
    getPathFromGitProvider: () => '/tmp',
  } as any;

  const pipelineRunRepository = new InMemoryRepository<WorkflowJsonResponse>();
  const pipelineJobsRepository = new InMemoryRepository<WorkflowJobJsonResponse>();
  const logger = new MockLoggerBuilder().build();

  const createRepository = async (githubWorkflowClient: IGithubWorkflowJobClient) => {
    const repository = new PipelinesJobFetchRepository(
      configuration,
      githubWorkflowClient,
      pipelineRunRepository,
      pipelineJobsRepository,
      undefined,
      logger
    );

    return { repository };
  };

  const storeFetchedWorkflows = async (runs: WorkflowJsonResponse[]) => {
    await pipelineRunRepository.saveAll(runs);
  };

  it('should fetch jobs by day when byDay flag is true', async () => {
    const run1 = new PipelineGitHubRunBuilder()
      .id('run-1')
      .number('1')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-10T10:00:00Z')
      .updatedAt('2026-05-10T10:05:00Z')
      .startedAt('2026-05-10T10:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const run2 = new PipelineGitHubRunBuilder()
      .id('run-2')
      .number('2')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-11T10:00:00Z')
      .updatedAt('2026-05-11T10:05:00Z')
      .startedAt('2026-05-11T10:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const job1 = new PipelineGitHubJobBuilder()
      .id('job-1')
      .name('build')
      .startedAt('2026-05-10T10:01:00Z')
      .completedAt('2026-05-10T10:02:00Z')
      .status('completed')
      .conclusion('success')
      .build();

    const job2 = new PipelineGitHubJobBuilder()
      .id('job-2')
      .name('test')
      .startedAt('2026-05-11T10:01:00Z')
      .completedAt('2026-05-11T10:02:00Z')
      .status('completed')
      .conclusion('success')
      .build();

    const fetchJobsPage = vi.fn().mockImplementation((runId) => {
      if (runId === 'run-1') {
        return Promise.resolve({ jobs: [job1], hasNext: false });
      }
      if (runId === 'run-2') {
        return Promise.resolve({ jobs: [job2], hasNext: false });
      }
      return Promise.resolve({ jobs: [], hasNext: false });
    });

    const githubWorkflowClient: IGithubWorkflowJobClient = {
      fetchJobsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows([run1, run2]);

    await repository.fetchJobs({
      forceRefresh: true,
      startDate: '2026-05-10',
      endDate: '2026-05-11',
      byDay: true,
    });

    expect(fetchJobsPage).toHaveBeenCalledTimes(2);
    expect(fetchJobsPage).toHaveBeenNthCalledWith(1, 'run-1', 1, 100, { rawFilters: undefined });
    expect(fetchJobsPage).toHaveBeenNthCalledWith(2, 'run-2', 1, 100, { rawFilters: undefined });
  });

  it('should use exact datetime filters when byDay is requested with datetime values', async () => {
    const beforeRange = new PipelineGitHubRunBuilder()
      .id('run-before')
      .number('1')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-10T07:00:00Z')
      .updatedAt('2026-05-10T07:05:00Z')
      .startedAt('2026-05-10T07:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();
    const inRange = new PipelineGitHubRunBuilder()
      .id('run-in-range')
      .number('2')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-10T08:00:00Z')
      .updatedAt('2026-05-10T08:05:00Z')
      .startedAt('2026-05-10T08:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const fetchJobsPage = vi.fn().mockResolvedValue({
      jobs: [],
      hasNext: false,
    });

    const githubWorkflowClient: IGithubWorkflowJobClient = {
      fetchJobsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows([beforeRange, inRange]);

    await repository.fetchJobs({
      forceRefresh: true,
      startDate: '2026-05-10T08:30:00+01:00',
      endDate: '2026-05-10T17:45:00+01:00',
      byDay: true,
    });

    expect(fetchJobsPage).toHaveBeenCalledTimes(1);
    expect(fetchJobsPage).toHaveBeenCalledWith('run-in-range', 1, 100, { rawFilters: undefined });
  });

  it('should fetch all pages within each run on the same day before moving to next day', async () => {
    const run1 = new PipelineGitHubRunBuilder()
      .id('run-1')
      .number('1')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-10T10:00:00Z')
      .updatedAt('2026-05-10T10:05:00Z')
      .startedAt('2026-05-10T10:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const run2 = new PipelineGitHubRunBuilder()
      .id('run-1-2')
      .number('2')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-10T11:00:00Z')
      .updatedAt('2026-05-10T11:05:00Z')
      .startedAt('2026-05-10T11:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const run3 = new PipelineGitHubRunBuilder()
      .id('run-2')
      .number('3')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-11T10:00:00Z')
      .updatedAt('2026-05-11T10:05:00Z')
      .startedAt('2026-05-11T10:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const job1 = new PipelineGitHubJobBuilder()
      .id('job-1')
      .name('build')
      .startedAt('2026-05-10T10:01:00Z')
      .completedAt('2026-05-10T10:02:00Z')
      .status('completed')
      .conclusion('success')
      .build();

    const job2 = new PipelineGitHubJobBuilder()
      .id('job-2')
      .name('test')
      .startedAt('2026-05-10T11:01:00Z')
      .completedAt('2026-05-10T11:02:00Z')
      .status('completed')
      .conclusion('success')
      .build();

    const job3 = new PipelineGitHubJobBuilder()
      .id('job-3')
      .name('deploy')
      .startedAt('2026-05-11T10:01:00Z')
      .completedAt('2026-05-11T10:02:00Z')
      .status('completed')
      .conclusion('success')
      .build();

    const fetchJobsPage = vi.fn().mockImplementation((runId) => {
      if (runId === 'run-1') {
        return Promise.resolve({ jobs: [job1], hasNext: false });
      }
      if (runId === 'run-1-2') {
        return Promise.resolve({ jobs: [job2], hasNext: false });
      }
      if (runId === 'run-2') {
        return Promise.resolve({ jobs: [job3], hasNext: false });
      }
      return Promise.resolve({ jobs: [], hasNext: false });
    });

    const githubWorkflowClient: IGithubWorkflowJobClient = {
      fetchJobsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows([run1, run2, run3]);

    await repository.fetchJobs({
      forceRefresh: true,
      startDate: '2026-05-10',
      endDate: '2026-05-11',
      byDay: true,
    });

    expect(fetchJobsPage).toHaveBeenCalledTimes(3);
    // Day 1 - should process both runs
    expect(fetchJobsPage).toHaveBeenNthCalledWith(1, 'run-1', 1, 100, { rawFilters: undefined });
    expect(fetchJobsPage).toHaveBeenNthCalledWith(2, 'run-1-2', 1, 100, { rawFilters: undefined });
    // Day 2 - process next day's run
    expect(fetchJobsPage).toHaveBeenNthCalledWith(3, 'run-2', 1, 100, { rawFilters: undefined });
  });

  it('should handle pagination within each run while processing by day', async () => {
    const run1 = new PipelineGitHubRunBuilder()
      .id('run-1')
      .number('1')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-10T10:00:00Z')
      .updatedAt('2026-05-10T10:05:00Z')
      .startedAt('2026-05-10T10:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const job1Page1 = new PipelineGitHubJobBuilder()
      .id('job-1')
      .name('build')
      .startedAt('2026-05-10T10:01:00Z')
      .completedAt('2026-05-10T10:02:00Z')
      .status('completed')
      .conclusion('success')
      .build();

    const job1Page2 = new PipelineGitHubJobBuilder()
      .id('job-2')
      .name('test')
      .startedAt('2026-05-10T10:03:00Z')
      .completedAt('2026-05-10T10:04:00Z')
      .status('completed')
      .conclusion('success')
      .build();

    const fetchJobsPage = vi.fn().mockImplementation((runId, page) => {
      if (runId === 'run-1') {
        if (page === 1) {
          return Promise.resolve({ jobs: [job1Page1], hasNext: true });
        } else if (page === 2) {
          return Promise.resolve({ jobs: [job1Page2], hasNext: false });
        }
      }
      return Promise.resolve({ jobs: [], hasNext: false });
    });

    const githubWorkflowClient: IGithubWorkflowJobClient = {
      fetchJobsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows([run1]);

    await repository.fetchJobs({
      forceRefresh: true,
      startDate: '2026-05-10',
      endDate: '2026-05-10',
      byDay: true,
    });

    expect(fetchJobsPage).toHaveBeenCalledTimes(2);
    expect(fetchJobsPage).toHaveBeenNthCalledWith(1, 'run-1', 1, 100, { rawFilters: undefined });
    expect(fetchJobsPage).toHaveBeenNthCalledWith(2, 'run-1', 2, 100, { rawFilters: undefined });
  });

  it('should handle empty days when fetching by day', async () => {
    const run1 = new PipelineGitHubRunBuilder()
      .id('run-2')
      .number('1')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-11T10:00:00Z')
      .updatedAt('2026-05-11T10:05:00Z')
      .startedAt('2026-05-11T10:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const job1 = new PipelineGitHubJobBuilder()
      .id('job-1')
      .name('build')
      .startedAt('2026-05-11T10:01:00Z')
      .completedAt('2026-05-11T10:02:00Z')
      .status('completed')
      .conclusion('success')
      .build();

    const fetchJobsPage = vi.fn().mockImplementation((runId) => {
      if (runId === 'run-2') {
        return Promise.resolve({ jobs: [job1], hasNext: false });
      }
      return Promise.resolve({ jobs: [], hasNext: false });
    });

    const githubWorkflowClient: IGithubWorkflowJobClient = {
      fetchJobsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows([run1]);

    await repository.fetchJobs({
      forceRefresh: true,
      startDate: '2026-05-10',
      endDate: '2026-05-11',
      byDay: true,
    });

    // Should only fetch for run-2 on day 2 (day 1 has no runs)
    expect(fetchJobsPage).toHaveBeenCalledTimes(1);
    expect(fetchJobsPage).toHaveBeenNthCalledWith(1, 'run-2', 1, 100, { rawFilters: undefined });
  });

  it('should fetch without byDay flag when it is false', async () => {
    const run1 = new PipelineGitHubRunBuilder()
      .id('run-1')
      .number('1')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-10T10:00:00Z')
      .updatedAt('2026-05-10T10:05:00Z')
      .startedAt('2026-05-10T10:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const run2 = new PipelineGitHubRunBuilder()
      .id('run-2')
      .number('2')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-11T10:00:00Z')
      .updatedAt('2026-05-11T10:05:00Z')
      .startedAt('2026-05-11T10:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const job1 = new PipelineGitHubJobBuilder()
      .id('job-1')
      .name('build')
      .startedAt('2026-05-10T10:01:00Z')
      .completedAt('2026-05-10T10:02:00Z')
      .status('completed')
      .conclusion('success')
      .build();

    const job2 = new PipelineGitHubJobBuilder()
      .id('job-2')
      .name('test')
      .startedAt('2026-05-11T10:01:00Z')
      .completedAt('2026-05-11T10:02:00Z')
      .status('completed')
      .conclusion('success')
      .build();

    const fetchJobsPage = vi.fn().mockImplementation((runId) => {
      if (runId === 'run-1') {
        return Promise.resolve({ jobs: [job1], hasNext: false });
      }
      if (runId === 'run-2') {
        return Promise.resolve({ jobs: [job2], hasNext: false });
      }
      return Promise.resolve({ jobs: [], hasNext: false });
    });

    const githubWorkflowClient: IGithubWorkflowJobClient = {
      fetchJobsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows([run1, run2]);

    await repository.fetchJobs({
      forceRefresh: true,
      startDate: '2026-05-10T00:00:00Z',
      endDate: '2026-05-11T23:59:59Z',
      byDay: false,
    });

    // Should fetch both runs (not grouped by day)
    expect(fetchJobsPage).toHaveBeenCalledTimes(2);
  });

  it('should handle raw filters when using byDay', async () => {
    const run1 = new PipelineGitHubRunBuilder()
      .id('run-1')
      .number('1')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-10T10:00:00Z')
      .updatedAt('2026-05-10T10:05:00Z')
      .startedAt('2026-05-10T10:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const job1 = new PipelineGitHubJobBuilder()
      .id('job-1')
      .name('build')
      .startedAt('2026-05-10T10:01:00Z')
      .completedAt('2026-05-10T10:02:00Z')
      .status('completed')
      .conclusion('success')
      .build();

    const fetchJobsPage = vi.fn().mockResolvedValueOnce({
      jobs: [job1],
      hasNext: false,
    });

    const githubWorkflowClient: IGithubWorkflowJobClient = {
      fetchJobsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows([run1]);

    await repository.fetchJobs({
      forceRefresh: true,
      startDate: '2026-05-10',
      endDate: '2026-05-10',
      rawFilters: 'status=completed',
      byDay: true,
    });

    expect(fetchJobsPage).toHaveBeenCalledTimes(1);
    expect(fetchJobsPage).toHaveBeenNthCalledWith(1, 'run-1', 1, 100, {
      rawFilters: 'status=completed',
    });
  });

  it('should handle 3-day range with byDay and multiple runs per day', async () => {
    const run1Day1 = new PipelineGitHubRunBuilder()
      .id('run-1')
      .number('1')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-10T10:00:00Z')
      .updatedAt('2026-05-10T10:05:00Z')
      .startedAt('2026-05-10T10:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const run2Day1 = new PipelineGitHubRunBuilder()
      .id('run-2')
      .number('2')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-10T15:00:00Z')
      .updatedAt('2026-05-10T15:05:00Z')
      .startedAt('2026-05-10T15:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const run1Day2 = new PipelineGitHubRunBuilder()
      .id('run-3')
      .number('3')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-11T10:00:00Z')
      .updatedAt('2026-05-11T10:05:00Z')
      .startedAt('2026-05-11T10:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const run1Day3 = new PipelineGitHubRunBuilder()
      .id('run-4')
      .number('4')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-12T10:00:00Z')
      .updatedAt('2026-05-12T10:05:00Z')
      .startedAt('2026-05-12T10:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const job1 = new PipelineGitHubJobBuilder().id('job-1').name('build').build();
    const job2 = new PipelineGitHubJobBuilder().id('job-2').name('test').build();
    const job3 = new PipelineGitHubJobBuilder().id('job-3').name('deploy').build();
    const job4 = new PipelineGitHubJobBuilder().id('job-4').name('release').build();

    const fetchJobsPage = vi.fn().mockImplementation((runId) => {
      if (runId === 'run-1') return Promise.resolve({ jobs: [job1], hasNext: false });
      if (runId === 'run-2') return Promise.resolve({ jobs: [job2], hasNext: false });
      if (runId === 'run-3') return Promise.resolve({ jobs: [job3], hasNext: false });
      if (runId === 'run-4') return Promise.resolve({ jobs: [job4], hasNext: false });
      return Promise.resolve({ jobs: [], hasNext: false });
    });

    const githubWorkflowClient: IGithubWorkflowJobClient = {
      fetchJobsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows([run1Day1, run2Day1, run1Day2, run1Day3]);

    await repository.fetchJobs({
      forceRefresh: true,
      startDate: '2026-05-10',
      endDate: '2026-05-12',
      byDay: true,
    });

    expect(fetchJobsPage).toHaveBeenCalledTimes(4);
    // Day 1
    expect(fetchJobsPage).toHaveBeenNthCalledWith(1, 'run-1', 1, 100, { rawFilters: undefined });
    expect(fetchJobsPage).toHaveBeenNthCalledWith(2, 'run-2', 1, 100, { rawFilters: undefined });
    // Day 2
    expect(fetchJobsPage).toHaveBeenNthCalledWith(3, 'run-3', 1, 100, { rawFilters: undefined });
    // Day 3
    expect(fetchJobsPage).toHaveBeenNthCalledWith(4, 'run-4', 1, 100, { rawFilters: undefined });
  });

  it('should use exact latest cached job time when incrementalUpdate is combined with byDay', async () => {
    const oldRun = new PipelineGitHubRunBuilder()
      .id('run-old')
      .number('1')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-10T10:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const newRun = new PipelineGitHubRunBuilder()
      .id('run-new')
      .number('2')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-11T10:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const cachedJob = new PipelineGitHubJobBuilder()
      .id('job-old')
      .runId('run-old')
      .name('build')
      .completedAt('2026-05-10T10:02:00Z')
      .build();

    await pipelineJobsRepository.saveAll([cachedJob]);
    await storeFetchedWorkflows([oldRun, newRun]);

    const freshJob = new PipelineGitHubJobBuilder()
      .id('job-new')
      .runId('run-new')
      .name('build')
      .completedAt('2026-05-11T10:02:00Z')
      .build();

    const fetchJobsPage = vi.fn().mockImplementation((runId) => {
      if (runId === 'run-new') {
        return Promise.resolve({ jobs: [freshJob], hasNext: false });
      }
      return Promise.resolve({ jobs: [], hasNext: false });
    });

    const githubWorkflowClient: IGithubWorkflowJobClient = {
      fetchJobsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);

    const jobs = await repository.fetchJobs({
      incrementalUpdate: true,
      byDay: true,
      endDate: '2026-05-12',
    });

    expect(fetchJobsPage).toHaveBeenCalledTimes(1);
    expect(fetchJobsPage).toHaveBeenCalledWith('run-new', 1, 100, { rawFilters: undefined });
    expect(jobs.map((j) => j.id).sort()).toEqual(['job-new', 'job-old']);

    await pipelineJobsRepository.delete();
  });
});
