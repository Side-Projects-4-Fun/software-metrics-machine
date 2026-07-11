import { mkdtempSync, rmSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PipelineGitHubRunBuilder } from '../../../test/github/github-builders';
import { InMemoryRepository } from '../../../test/repositories/in-memory-repository';
import { IGithubWorkflowClient } from '../../..';
import { WorkflowJsonResponse } from '../github-response-types';
import { PipelinesFetchRepository } from '../pipelines-fetch-repository-json';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';

describe('PipelinesFetchRepository - pagination error handling and resume', () => {
  let tempDir: string;
  let configuration: { getPathFromGitProvider: () => string };
  let pipelineRunRepository: InMemoryRepository<WorkflowJsonResponse>;
  const logger = new MockLoggerBuilder().build();

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'smm-pipelines-resume-'));
    configuration = { getPathFromGitProvider: () => tempDir };
    pipelineRunRepository = new InMemoryRepository<WorkflowJsonResponse>();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const createRepository = (githubWorkflowClient: IGithubWorkflowClient) =>
    new PipelinesFetchRepository(
      configuration as never,
      githubWorkflowClient,
      pipelineRunRepository,
      undefined,
      logger
    );

  const buildRun = (id: string, createdAt: string) =>
    new PipelineGitHubRunBuilder()
      .id(id)
      .number('1')
      .name('CI')
      .status('completed')
      .createdAt(createdAt)
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

  it('should save partial progress and rethrow when fetchWorkflowRunsPage rejects with a non-422 status', async () => {
    const fetchWorkflowRunsPage = vi.fn().mockRejectedValueOnce({ status: 500 });
    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };
    const repository = createRepository(githubWorkflowClient);
    await pipelineRunRepository.saveAll([]);

    await expect(repository.fetchPipelines({ forceRefresh: true })).rejects.toEqual({
      status: 500,
    });
  });

  it('should save partial progress and rethrow when fetchWorkflowRunsPage rejects with a plain Error with no status', async () => {
    const fetchWorkflowRunsPage = vi.fn().mockRejectedValueOnce(new Error('boom'));
    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };
    const repository = createRepository(githubWorkflowClient);
    await pipelineRunRepository.saveAll([]);

    await expect(repository.fetchPipelines({ forceRefresh: true })).rejects.toThrow('boom');
  });

  it('should persist partial runs and the current page before rethrowing on a non-422 error', async () => {
    const run1 = buildRun('run-1', '2026-05-10T00:00:00Z');

    const fetchWorkflowRunsPage = vi
      .fn()
      .mockResolvedValueOnce({ runs: [run1], hasNext: true })
      .mockRejectedValueOnce({ status: 500 });

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };
    const repository = createRepository(githubWorkflowClient);
    await pipelineRunRepository.saveAll([]);

    await expect(repository.fetchPipelines({ forceRefresh: true })).rejects.toEqual({
      status: 500,
    });

    const incompletedRaw = await readFile(join(tempDir, 'workflows_incompleted.json'), 'utf-8');
    const incompleted = JSON.parse(incompletedRaw) as WorkflowJsonResponse[];
    expect(incompleted.map((r) => r.id)).toEqual(['run-1']);

    const progressRaw = await readFile(join(tempDir, 'workflows_progress.json'), 'utf-8');
    const progress = JSON.parse(progressRaw) as { page: number };
    expect(progress.page).toBe(2);
  });

  it('should stop pagination gracefully when the 422 status is on the error directly (not nested under response)', async () => {
    const run1 = buildRun('run-1', '2026-05-10T00:00:00Z');

    const fetchWorkflowRunsPage = vi
      .fn()
      .mockResolvedValueOnce({ runs: [run1], hasNext: true })
      .mockRejectedValueOnce({ status: 422 });

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };
    const repository = createRepository(githubWorkflowClient);
    await pipelineRunRepository.saveAll([]);

    const workflows = await repository.fetchPipelines({ forceRefresh: true });

    expect(workflows).toHaveLength(1);
    expect(workflows[0].id).toBe('run-1');
    expect(fetchWorkflowRunsPage).toHaveBeenCalledTimes(2);
  });

  it('should rethrow rather than treat as 422 when a non-object value is thrown', async () => {
    const fetchWorkflowRunsPage = vi.fn().mockRejectedValueOnce('plain string error');
    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };
    const repository = createRepository(githubWorkflowClient);
    await pipelineRunRepository.saveAll([]);

    await expect(repository.fetchPipelines({ forceRefresh: true })).rejects.toBe(
      'plain string error'
    );
  });

  it('should rethrow rather than treat as 422 when undefined is thrown', async () => {
    const fetchWorkflowRunsPage = vi.fn().mockRejectedValueOnce(undefined);
    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };
    const repository = createRepository(githubWorkflowClient);
    await pipelineRunRepository.saveAll([]);

    await expect(repository.fetchPipelines({ forceRefresh: true })).rejects.toBeUndefined();
  });
});

describe('PipelinesFetchRepository - resume from existing partial progress', () => {
  let tempDir: string;
  let configuration: { getPathFromGitProvider: () => string };
  let pipelineRunRepository: InMemoryRepository<WorkflowJsonResponse>;
  const logger = new MockLoggerBuilder().build();

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'smm-pipelines-resume-progress-'));
    configuration = { getPathFromGitProvider: () => tempDir };
    pipelineRunRepository = new InMemoryRepository<WorkflowJsonResponse>();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const createRepository = (githubWorkflowClient: IGithubWorkflowClient) =>
    new PipelinesFetchRepository(
      configuration as never,
      githubWorkflowClient,
      pipelineRunRepository,
      undefined,
      logger
    );

  const buildRun = (id: string, createdAt: string) =>
    new PipelineGitHubRunBuilder()
      .id(id)
      .number('1')
      .name('CI')
      .status('completed')
      .createdAt(createdAt)
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

  const writeProgress = (progress: { page: number }) =>
    writeFile(join(tempDir, 'workflows_progress.json'), JSON.stringify(progress), 'utf-8');

  const writeIncompleted = (runs: WorkflowJsonResponse[]) =>
    writeFile(join(tempDir, 'workflows_incompleted.json'), JSON.stringify(runs), 'utf-8');

  it('should resume pagination from the saved page rather than starting at page 1', async () => {
    await writeProgress({ page: 3 });

    const runPage3 = buildRun('run-page-3', '2026-05-10T00:00:00Z');
    const fetchWorkflowRunsPage = vi.fn().mockResolvedValueOnce({
      runs: [runPage3],
      hasNext: false,
    });

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };
    const repository = createRepository(githubWorkflowClient);
    await pipelineRunRepository.saveAll([]);

    const workflows = await repository.fetchPipelines({ forceRefresh: true });

    expect(fetchWorkflowRunsPage).toHaveBeenCalledTimes(1);
    expect(fetchWorkflowRunsPage).toHaveBeenCalledWith(3, 100, {
      created: undefined,
      rawFilters: undefined,
    });
    expect(workflows.map((r) => r.id)).toEqual(['run-page-3']);
  });

  it('should include runs already in workflows_incompleted.json in the final result alongside newly fetched ones', async () => {
    const priorRun = buildRun('prior-run', '2026-05-09T00:00:00Z');
    await writeProgress({ page: 2 });
    await writeIncompleted([priorRun]);

    const newRun = buildRun('new-run', '2026-05-10T00:00:00Z');
    const fetchWorkflowRunsPage = vi.fn().mockResolvedValueOnce({
      runs: [newRun],
      hasNext: false,
    });

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };
    const repository = createRepository(githubWorkflowClient);
    await pipelineRunRepository.saveAll([]);

    const workflows = await repository.fetchPipelines({ forceRefresh: true });

    expect(workflows.map((r) => r.id).sort()).toEqual(['new-run', 'prior-run']);
  });
});

describe('PipelinesFetchRepository - empty and missing runs branches', () => {
  let tempDir: string;
  let configuration: { getPathFromGitProvider: () => string };
  let pipelineRunRepository: InMemoryRepository<WorkflowJsonResponse>;
  const logger = new MockLoggerBuilder().build();

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'smm-pipelines-empty-runs-'));
    configuration = { getPathFromGitProvider: () => tempDir };
    pipelineRunRepository = new InMemoryRepository<WorkflowJsonResponse>();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const createRepository = (githubWorkflowClient: IGithubWorkflowClient) =>
    new PipelinesFetchRepository(
      configuration as never,
      githubWorkflowClient,
      pipelineRunRepository,
      undefined,
      logger
    );

  it('should stop pagination when runs is an empty array even though hasNext is true', async () => {
    const fetchWorkflowRunsPage = vi.fn().mockResolvedValueOnce({
      runs: [],
      hasNext: true,
    });

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };
    const repository = createRepository(githubWorkflowClient);
    await pipelineRunRepository.saveAll([]);

    const workflows = await repository.fetchPipelines({ forceRefresh: true });

    expect(workflows).toHaveLength(0);
    expect(fetchWorkflowRunsPage).toHaveBeenCalledTimes(1);
  });

  it('should treat a response with no runs key as an empty page and stop pagination', async () => {
    const fetchWorkflowRunsPage = vi.fn().mockResolvedValueOnce({
      hasNext: false,
    });

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage,
    };
    const repository = createRepository(githubWorkflowClient);
    await pipelineRunRepository.saveAll([]);

    const workflows = await repository.fetchPipelines({ forceRefresh: true });

    expect(workflows).toHaveLength(0);
    expect(fetchWorkflowRunsPage).toHaveBeenCalledTimes(1);
  });
});

describe('PipelinesFetchRepository - readJson malformed content', () => {
  let tempDir: string;
  let configuration: { getPathFromGitProvider: () => string };
  let pipelineRunRepository: InMemoryRepository<WorkflowJsonResponse>;
  const logger = new MockLoggerBuilder().build();

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'smm-pipelines-malformed-'));
    configuration = { getPathFromGitProvider: () => tempDir };
    pipelineRunRepository = new InMemoryRepository<WorkflowJsonResponse>();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should reject with a parse error rather than falling back to the default when progress JSON is malformed', async () => {
    await writeFile(join(tempDir, 'workflows_progress.json'), '{not valid json', 'utf-8');

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage: vi.fn(),
    };
    const repository = new PipelinesFetchRepository(
      configuration as never,
      githubWorkflowClient,
      pipelineRunRepository,
      undefined,
      logger
    );
    await pipelineRunRepository.saveAll([]);

    await expect(repository.fetchPipelines({ forceRefresh: true })).rejects.toBeInstanceOf(
      SyntaxError
    );
  });

  it('should reject with a parse error rather than falling back to the default when incompleted JSON is malformed', async () => {
    await writeFile(join(tempDir, 'workflows_incompleted.json'), '{not valid json', 'utf-8');

    const githubWorkflowClient: IGithubWorkflowClient = {
      fetchWorkflows: vi.fn(),
      fetchWorkflowRunsPage: vi.fn(),
    };
    const repository = new PipelinesFetchRepository(
      configuration as never,
      githubWorkflowClient,
      pipelineRunRepository,
      undefined,
      logger
    );
    await pipelineRunRepository.saveAll([]);

    await expect(repository.fetchPipelines({ forceRefresh: true })).rejects.toBeInstanceOf(
      SyntaxError
    );
  });
});
