import { describe, expect, it, vi } from 'vitest';
import { PipelineGitHubRunBuilder } from '../../../test/github-builders';
import { InMemoryRepository } from '../../../test/in-memory-repository';
import { IGithubWorkflowClient } from '../../..';
import { WorkflowJsonResponse } from '../github-response-types';
import { PipelinesFetchRepository } from '../pipelines-fetch-repository-json';
import { MockLoggerBuilder } from '../../../test/mock-logger-builder';

describe('PipelinesRepository', () => {
  const configuration = {
    getPathFromGitProvider: () => '/tmp',
  } as any;

  const pipelineRunRepository = new InMemoryRepository<WorkflowJsonResponse>();
  const logger = new MockLoggerBuilder().build();

  const createRepository = async (
    githubWorkflowClient: IGithubWorkflowClient,
    pipelineFiltersRepository?: { refreshOptions: ReturnType<typeof vi.fn> }
  ) => {
    const repository = new PipelinesFetchRepository(
      configuration,
      githubWorkflowClient,
      pipelineRunRepository,
      pipelineFiltersRepository as never,
      logger
    );

    return { repository };
  };

  const storeFetchedWorkflows = async (runs: WorkflowJsonResponse[]) => {
    await pipelineRunRepository.saveAll(runs);
  };

  it('should fetch workflow runs without date filters', async () => {
    const fetchWorkflowRunsPage = vi.fn().mockResolvedValueOnce({
      runs: [
        new PipelineGitHubRunBuilder()
          .id('run-1')
          .number('1')
          .name('CI')
          .status('completed')
          .createdAt('2026-05-10T00:00:00Z')
          .updatedAt('2026-05-10T00:05:00Z')
          .startedAt('2026-05-10T00:00:00Z')
          .branch('main')
          .path('.github/workflows/ci.yml')
          .build(),
      ],
      hasNext: false,
    });

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows([]);

    const workflows = await repository.fetchPipelines({ forceRefresh: true });

    expect(workflows).toHaveLength(1);
    expect(workflows[0].id).toBe('run-1');
    expect(fetchWorkflowRunsPage).toHaveBeenCalledTimes(1);
    expect(fetchWorkflowRunsPage).toHaveBeenCalledWith(1, 100, {
      created: undefined,
      rawFilters: undefined,
    });
  });

  it('should refresh pipeline filter options after fetching workflow runs', async () => {
    const fetchWorkflowRunsPage = vi.fn().mockResolvedValueOnce({
      runs: [
        new PipelineGitHubRunBuilder()
          .id('run-1')
          .name('CI')
          .status('completed')
          .path('.github/workflows/ci.yml')
          .build(),
      ],
      hasNext: false,
    });
    const refreshOptions = vi.fn().mockResolvedValue({});
    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient, { refreshOptions });
    await storeFetchedWorkflows([]);

    await repository.fetchPipelines({ forceRefresh: true });

    expect(refreshOptions).toHaveBeenCalledTimes(1);
  });

  it('should return cached workflows when force refresh is disabled', async () => {
    const cachedRuns = [
      new PipelineGitHubRunBuilder()
        .id('cached-run')
        .number('10')
        .name('CI')
        .status('completed')
        .createdAt('2026-05-01T00:00:00Z')
        .updatedAt('2026-05-01T00:05:00Z')
        .startedAt('2026-05-01T00:00:00Z')
        .branch('main')
        .path('.github/workflows/ci.yml')
        .build(),
    ];

    const fetchWorkflowRunsPage = vi.fn();

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows(cachedRuns);

    const workflows = await repository.fetchPipelines({});

    expect(workflows).toHaveLength(1);
    expect(workflows[0].id).toBe('cached-run');
    expect(fetchWorkflowRunsPage).not.toHaveBeenCalled();
  });

  it('should forward created and raw filters when fetching workflows', async () => {
    const fetchWorkflowRunsPage = vi.fn().mockResolvedValueOnce({
      runs: [
        new PipelineGitHubRunBuilder()
          .id('filtered-run')
          .number('2')
          .name('CI')
          .status('completed')
          .createdAt('2026-05-10T00:00:00Z')
          .updatedAt('2026-05-10T00:05:00Z')
          .startedAt('2026-05-10T00:00:00Z')
          .branch('main')
          .path('.github/workflows/ci.yml')
          .build(),
      ],
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
      startDate: '2026-05-05T00:00:00Z',
      endDate: '2026-05-15T00:00:00Z',
      rawFilters: 'status=success,branch=main',
    });

    expect(workflows).toHaveLength(1);
    expect(workflows[0].id).toBe('filtered-run');
    expect(fetchWorkflowRunsPage).toHaveBeenCalledTimes(1);
    expect(fetchWorkflowRunsPage).toHaveBeenCalledWith(1, 100, {
      created: '2026-05-05T00:00:00Z..2026-05-15T00:00:00Z',
      rawFilters: 'status=success,branch=main',
    });
  });

  it('should not widen datetime filters when byDay is requested', async () => {
    const fetchWorkflowRunsPage = vi.fn().mockResolvedValueOnce({
      runs: [],
      hasNext: false,
    });

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows([]);

    await repository.fetchPipelines({
      forceRefresh: true,
      startDate: '2026-05-10T08:30:00+01:00',
      endDate: '2026-05-10T17:45:00+01:00',
      byDay: true,
    });

    expect(fetchWorkflowRunsPage).toHaveBeenCalledTimes(1);
    expect(fetchWorkflowRunsPage).toHaveBeenCalledWith(1, 100, {
      created: '2026-05-10T08:30:00+01:00..2026-05-10T17:45:00+01:00',
      rawFilters: undefined,
    });
  });

  it('should paginate workflows until hasNext is false', async () => {
    const fetchWorkflowRunsPage = vi
      .fn()
      .mockResolvedValueOnce({
        runs: [
          new PipelineGitHubRunBuilder()
            .id('run-1')
            .number('1')
            .name('CI')
            .status('completed')
            .createdAt('2026-05-10T00:00:00Z')
            .updatedAt('2026-05-10T00:05:00Z')
            .startedAt('2026-05-10T00:00:00Z')
            .branch('main')
            .path('.github/workflows/ci.yml')
            .build(),
        ],
        hasNext: true,
      })
      .mockResolvedValueOnce({
        runs: [
          new PipelineGitHubRunBuilder()
            .id('run-2')
            .number('2')
            .name('CI')
            .status('completed')
            .createdAt('2026-05-11T00:00:00Z')
            .updatedAt('2026-05-11T00:05:00Z')
            .startedAt('2026-05-11T00:00:00Z')
            .branch('main')
            .path('.github/workflows/ci.yml')
            .build(),
        ],
        hasNext: false,
      });

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows([]);

    const workflows = await repository.fetchPipelines({ forceRefresh: true });

    expect(workflows).toHaveLength(2);
    expect(workflows[0].id).toBe('run-1');
    expect(workflows[1].id).toBe('run-2');
    expect(fetchWorkflowRunsPage).toHaveBeenCalledTimes(2);
    expect(fetchWorkflowRunsPage).toHaveBeenNthCalledWith(1, 1, 100, {
      created: undefined,
      rawFilters: undefined,
    });
    expect(fetchWorkflowRunsPage).toHaveBeenNthCalledWith(2, 2, 100, {
      created: undefined,
      rawFilters: undefined,
    });
  });

  it('should stop pagination when GitHub returns 422 and keep fetched runs', async () => {
    const fetchWorkflowRunsPage = vi
      .fn()
      .mockResolvedValueOnce({
        runs: [
          new PipelineGitHubRunBuilder()
            .id('run-1')
            .number('1')
            .name('CI')
            .status('completed')
            .createdAt('2026-05-10T00:00:00Z')
            .updatedAt('2026-05-10T00:05:00Z')
            .startedAt('2026-05-10T00:00:00Z')
            .branch('main')
            .path('.github/workflows/ci.yml')
            .build(),
        ],
        hasNext: true,
      })
      .mockRejectedValueOnce({
        response: { status: 422 },
      });

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows([]);

    const workflows = await repository.fetchPipelines({ forceRefresh: true });

    expect(workflows).toHaveLength(1);
    expect(workflows[0].id).toBe('run-1');
    expect(fetchWorkflowRunsPage).toHaveBeenCalledTimes(2);
  });

  it('should fetch only runs created after the latest cached date on incremental update', async () => {
    const cachedRun = new PipelineGitHubRunBuilder()
      .id('cached-run')
      .number('1')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-10T00:00:00Z')
      .updatedAt('2026-05-10T00:05:00Z')
      .startedAt('2026-05-10T00:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const freshRun = new PipelineGitHubRunBuilder()
      .id('fresh-run')
      .number('2')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-12T00:00:00Z')
      .updatedAt('2026-05-12T00:05:00Z')
      .startedAt('2026-05-12T00:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const fetchWorkflowRunsPage = vi.fn().mockResolvedValueOnce({
      runs: [freshRun],
      hasNext: false,
    });

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows([cachedRun]);

    const workflows = await repository.fetchPipelines({ incrementalUpdate: true });

    expect(workflows.map((w) => w.id).sort()).toEqual(['cached-run', 'fresh-run']);
    expect(fetchWorkflowRunsPage).toHaveBeenCalledTimes(1);
    expect(fetchWorkflowRunsPage).toHaveBeenCalledWith(1, 100, {
      created: '>2026-05-10T00:00:00.000Z',
      rawFilters: undefined,
    });
  });

  it('should let the freshly fetched run win when it shares an id with a cached run on incremental update', async () => {
    const cachedRun = new PipelineGitHubRunBuilder()
      .id('shared-id')
      .number('1')
      .name('CI')
      .status('in_progress')
      .createdAt('2026-05-10T00:00:00Z')
      .updatedAt('2026-05-10T00:05:00Z')
      .startedAt('2026-05-10T00:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const updatedRun = new PipelineGitHubRunBuilder()
      .id('shared-id')
      .number('1')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-10T00:00:00Z')
      .updatedAt('2026-05-12T00:05:00Z')
      .startedAt('2026-05-10T00:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const fetchWorkflowRunsPage = vi.fn().mockResolvedValueOnce({
      runs: [updatedRun],
      hasNext: false,
    });

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows([cachedRun]);

    const workflows = await repository.fetchPipelines({ incrementalUpdate: true });

    expect(workflows).toHaveLength(1);
    expect(workflows[0].status).toBe('completed');
  });

  it('should keep exact incremental timestamp when byDay and datetime endDate are set', async () => {
    const cachedRun = new PipelineGitHubRunBuilder()
      .id('cached-run')
      .number('1')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-10T00:00:00Z')
      .updatedAt('2026-05-10T00:05:00Z')
      .startedAt('2026-05-10T00:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const freshRun = new PipelineGitHubRunBuilder()
      .id('fresh-run')
      .number('2')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-12T00:00:00Z')
      .updatedAt('2026-05-12T00:05:00Z')
      .startedAt('2026-05-12T00:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const fetchWorkflowRunsPage = vi.fn().mockResolvedValue({
      runs: [freshRun],
      hasNext: false,
    });

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows([cachedRun]);

    const workflows = await repository.fetchPipelines({
      incrementalUpdate: true,
      byDay: true,
      endDate: '2026-05-12T23:59:59Z',
    });

    expect(workflows.map((w) => w.id).sort()).toEqual(['cached-run', 'fresh-run']);
    expect(fetchWorkflowRunsPage).toHaveBeenCalledTimes(1);
    expect(fetchWorkflowRunsPage).toHaveBeenCalledWith(1, 100, {
      created: '2026-05-10T00:00:00.000Z..2026-05-12T23:59:59Z',
      rawFilters: undefined,
    });
  });

  it('should bypass the incremental-update guard when forceRefresh is also set on a non-empty cache', async () => {
    const cachedRun = new PipelineGitHubRunBuilder()
      .id('cached-run')
      .number('1')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-10T00:00:00Z')
      .updatedAt('2026-05-10T00:05:00Z')
      .startedAt('2026-05-10T00:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const refetchedRun = new PipelineGitHubRunBuilder()
      .id('refetched-run')
      .number('2')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-01T00:00:00Z')
      .updatedAt('2026-05-01T00:05:00Z')
      .startedAt('2026-05-01T00:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    const fetchWorkflowRunsPage = vi.fn().mockResolvedValueOnce({
      runs: [refetchedRun],
      hasNext: false,
    });

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };

    const { repository } = await createRepository(githubWorkflowClient);
    await storeFetchedWorkflows([cachedRun]);

    await repository.fetchPipelines({ incrementalUpdate: true, forceRefresh: true });

    // The incremental guard only checks `incrementalUpdate && fromCache.length > 0` —
    // it does not special-case `forceRefresh`, so the call is still filtered by the
    // latest cached date (`>2026-05-10...`), not re-fetched from scratch.
    expect(fetchWorkflowRunsPage).toHaveBeenCalledWith(1, 100, {
      created: '>2026-05-10T00:00:00.000Z',
      rawFilters: undefined,
    });
  });
});
