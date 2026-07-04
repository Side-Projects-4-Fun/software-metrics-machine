import { describe, expect, it, vi } from 'vitest';
import { PipelineGitHubRunBuilder } from '../../../src';
import { InMemoryRepository } from '../../../src/test/in-memory-repository';
import { IGithubWorkflowClient } from '../../../src';
import { WorkflowJsonResponse } from '../../../src/providers/github/github-response-types';
import { PipelinesFetchRepository } from '../../../src/providers/github/pipelines-fetch-repository-json';
import { MockLoggerBuilder } from '../../mock-logger-builder';

describe('PipelinesFetchRepository - Fetch workflows by day', () => {
  const configuration = {
    getPathFromGitProvider: () => '/tmp',
  } as any;

  const pipelineRunRepository = new InMemoryRepository<WorkflowJsonResponse>();
  const logger = new MockLoggerBuilder().build();

  const createRepository = async (githubWorkflowClient: IGithubWorkflowClient) => {
    const repository = new PipelinesFetchRepository(
      configuration,
      githubWorkflowClient,
      pipelineRunRepository,
      undefined,
      logger
    );

    return { repository };
  };

  const storeFetchedWorkflows = async (runs: WorkflowJsonResponse[]) => {
    await pipelineRunRepository.saveAll(runs);
  };

  it('should fetch workflows by day when byDay flag is true', async () => {
    const run1 = new PipelineGitHubRunBuilder()
      .id('run-1')
      .number('1')
      .name('CI Day 1')
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
      .name('CI Day 2')
      .status('completed')
      .createdAt('2026-05-11T10:00:00Z')
      .updatedAt('2026-05-11T10:05:00Z')
      .startedAt('2026-05-11T10:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const fetchWorkflowRunsPage = vi.fn().mockImplementation((page, perPage, options) => {
      // First call (day 1)
      if (options?.created?.includes('2026-05-10')) {
        return Promise.resolve({
          runs: page === 1 ? [run1] : [],
          hasNext: false,
        });
      }
      // Second call (day 2)
      if (options?.created?.includes('2026-05-11')) {
        return Promise.resolve({
          runs: page === 1 ? [run2] : [],
          hasNext: false,
        });
      }
      return Promise.resolve({ runs: [], hasNext: false });
    });

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows([]);

    const workflows = await repository.fetchPipelines({
      forceRefresh: true,
      startDate: '2026-05-10',
      endDate: '2026-05-11',
      byDay: true,
    });

    expect(workflows).toHaveLength(2);
    expect(workflows[0].id).toBe('run-1');
    expect(workflows[1].id).toBe('run-2');
    expect(fetchWorkflowRunsPage).toHaveBeenCalledTimes(2);
  });

  it('should fetch all pages within each day before moving to next day', async () => {
    const run1Page1 = new PipelineGitHubRunBuilder()
      .id('run-1-1')
      .number('1')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-10T10:00:00Z')
      .updatedAt('2026-05-10T10:05:00Z')
      .startedAt('2026-05-10T10:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const run1Page2 = new PipelineGitHubRunBuilder()
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

    const run2Page1 = new PipelineGitHubRunBuilder()
      .id('run-2-1')
      .number('3')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-11T10:00:00Z')
      .updatedAt('2026-05-11T10:05:00Z')
      .startedAt('2026-05-11T10:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const fetchWorkflowRunsPage = vi.fn().mockImplementation((page, perPage, options) => {
      // Day 1 pagination
      if (options?.created?.includes('2026-05-10')) {
        if (page === 1) {
          return Promise.resolve({
            runs: [run1Page1],
            hasNext: true,
          });
        } else if (page === 2) {
          return Promise.resolve({
            runs: [run1Page2],
            hasNext: false,
          });
        }
      }
      // Day 2
      if (options?.created?.includes('2026-05-11')) {
        if (page === 1) {
          return Promise.resolve({
            runs: [run2Page1],
            hasNext: false,
          });
        }
      }
      return Promise.resolve({ runs: [], hasNext: false });
    });

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows([]);

    const workflows = await repository.fetchPipelines({
      forceRefresh: true,
      startDate: '2026-05-10',
      endDate: '2026-05-11',
      byDay: true,
    });

    expect(workflows).toHaveLength(3);
    expect(workflows[0].id).toBe('run-1-1');
    expect(workflows[1].id).toBe('run-1-2');
    expect(workflows[2].id).toBe('run-2-1');
    expect(fetchWorkflowRunsPage).toHaveBeenCalledTimes(3);

    // Verify the order of calls
    const calls = fetchWorkflowRunsPage.mock.calls;
    expect(calls[0][2].created).toContain('2026-05-10');
    expect(calls[1][2].created).toContain('2026-05-10');
    expect(calls[2][2].created).toContain('2026-05-11');
  });

  it('should handle single day fetch with byDay flag', async () => {
    const run = new PipelineGitHubRunBuilder()
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

    const fetchWorkflowRunsPage = vi.fn().mockResolvedValueOnce({
      runs: [run],
      hasNext: false,
    });

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows([]);

    const workflows = await repository.fetchPipelines({
      forceRefresh: true,
      startDate: '2026-05-10',
      endDate: '2026-05-10',
      byDay: true,
    });

    expect(workflows).toHaveLength(1);
    expect(workflows[0].id).toBe('run-1');
    expect(fetchWorkflowRunsPage).toHaveBeenCalledTimes(1);
  });

  it('should fetch without byDay flag when it is false or not provided', async () => {
    const run = new PipelineGitHubRunBuilder()
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

    const fetchWorkflowRunsPage = vi.fn().mockResolvedValueOnce({
      runs: [run],
      hasNext: false,
    });

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows([]);

    const workflows = await repository.fetchPipelines({
      forceRefresh: true,
      startDate: '2026-05-10T00:00:00Z',
      endDate: '2026-05-11T23:59:59Z',
      byDay: false,
    });

    expect(workflows).toHaveLength(1);
    // When byDay is false, should use range filter (single call with date range)
    expect(fetchWorkflowRunsPage).toHaveBeenCalledTimes(1);
    const params = fetchWorkflowRunsPage.mock.calls[0][2];
    expect(params?.created).toContain('..');
  });

  it('should fetch with raw filters when using byDay', async () => {
    const run = new PipelineGitHubRunBuilder()
      .id('run-success')
      .number('1')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-10T10:00:00Z')
      .updatedAt('2026-05-10T10:05:00Z')
      .startedAt('2026-05-10T10:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const fetchWorkflowRunsPage = vi.fn().mockResolvedValueOnce({
      runs: [run],
      hasNext: false,
    });

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows([]);

    const workflows = await repository.fetchPipelines({
      forceRefresh: true,
      startDate: '2026-05-10',
      endDate: '2026-05-10',
      rawFilters: 'status=success',
      byDay: true,
    });

    expect(workflows).toHaveLength(1);
    expect(fetchWorkflowRunsPage).toHaveBeenCalledTimes(1);
    const params = fetchWorkflowRunsPage.mock.calls[0][2];
    expect(params?.rawFilters).toBe('status=success');
  });

  it('should handle empty days when fetching by day', async () => {
    const run = new PipelineGitHubRunBuilder()
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

    const fetchWorkflowRunsPage = vi.fn().mockImplementation((page, perPage, options) => {
      // Day 1 - empty
      if (options?.created?.includes('2026-05-10')) {
        return Promise.resolve({
          runs: [],
          hasNext: false,
        });
      }
      // Day 2 - has data
      if (options?.created?.includes('2026-05-11')) {
        return Promise.resolve({
          runs: page === 1 ? [run] : [],
          hasNext: false,
        });
      }
      return Promise.resolve({ runs: [], hasNext: false });
    });

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows([]);

    const workflows = await repository.fetchPipelines({
      forceRefresh: true,
      startDate: '2026-05-10',
      endDate: '2026-05-11',
      byDay: true,
    });

    expect(workflows).toHaveLength(1);
    expect(workflows[0].id).toBe('run-2');
    expect(fetchWorkflowRunsPage).toHaveBeenCalledTimes(2);
  });

  it('should handle 3-day range with byDay', async () => {
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

    const run3 = new PipelineGitHubRunBuilder()
      .id('run-3')
      .number('3')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-12T10:00:00Z')
      .updatedAt('2026-05-12T10:05:00Z')
      .startedAt('2026-05-12T10:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const fetchWorkflowRunsPage = vi.fn().mockImplementation((page, perPage, options) => {
      if (options?.created?.includes('2026-05-10')) {
        return Promise.resolve({ runs: [run1], hasNext: false });
      }
      if (options?.created?.includes('2026-05-11')) {
        return Promise.resolve({ runs: [run2], hasNext: false });
      }
      if (options?.created?.includes('2026-05-12')) {
        return Promise.resolve({ runs: [run3], hasNext: false });
      }
      return Promise.resolve({ runs: [], hasNext: false });
    });

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows([]);

    const workflows = await repository.fetchPipelines({
      forceRefresh: true,
      startDate: '2026-05-10',
      endDate: '2026-05-12',
      byDay: true,
    });

    expect(workflows).toHaveLength(3);
    expect(workflows[0].id).toBe('run-1');
    expect(workflows[1].id).toBe('run-2');
    expect(workflows[2].id).toBe('run-3');
    expect(fetchWorkflowRunsPage).toHaveBeenCalledTimes(3);
  });
});
