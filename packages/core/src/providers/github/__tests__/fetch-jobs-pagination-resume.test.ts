import { mkdtempSync, rmSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PipelineGitHubJobBuilder,
  PipelineGitHubRunBuilder,
} from '../../../test/github/github-builders';
import { InMemoryRepository } from '../../../test/repositories/in-memory-repository';
import { WorkflowJobJsonResponse, WorkflowJsonResponse } from '../github-response-types';
import { PipelinesJobFetchRepository } from '../pipelines-job-fetch-repository-json';
import { IGithubWorkflowJobClient } from '../workflow-types';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';

describe('Fetch jobs pipeline repository - pagination error handling and resume', () => {
  let tempDir: string;
  let configuration: { getPathFromGitProvider: () => string };
  let pipelineRunRepository: InMemoryRepository<WorkflowJsonResponse>;
  let pipelineJobsRepository: InMemoryRepository<WorkflowJobJsonResponse>;
  const logger = new MockLoggerBuilder().build();

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'smm-jobs-resume-'));
    configuration = { getPathFromGitProvider: () => tempDir };
    pipelineRunRepository = new InMemoryRepository<WorkflowJsonResponse>();
    pipelineJobsRepository = new InMemoryRepository<WorkflowJobJsonResponse>();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const createRepository = (githubWorkflowClient: IGithubWorkflowJobClient) => {
    return new PipelinesJobFetchRepository(
      configuration as never,
      githubWorkflowClient,
      pipelineRunRepository,
      pipelineJobsRepository,
      undefined,
      logger
    );
  };

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

  it('should mark the run as processed and continue when fetchJobsPage rejects with status 404', async () => {
    const run1 = buildRun('run-1', '2026-05-10T00:00:00Z');
    const run2 = buildRun('run-2', '2026-05-11T00:00:00Z');
    await pipelineRunRepository.saveAll([run1, run2]);

    const job2 = new PipelineGitHubJobBuilder().id('job-2').runId('run-2').name('build').build();

    const fetchJobsPage = vi.fn().mockImplementation((runId: string) => {
      if (runId === 'run-1') {
        return Promise.reject({ status: 404 });
      }
      return Promise.resolve({ jobs: [job2], hasNext: false });
    });

    const githubWorkflowClient: IGithubWorkflowJobClient = { fetchJobsPage };
    const repository = createRepository(githubWorkflowClient);

    const jobs = await repository.fetchJobsWithResume([run1, run2]);

    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe('job-2');
    expect(fetchJobsPage).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('run-1'));
  });

  it('should mark the run as processed and continue when fetchJobsPage rejects with response.status 404', async () => {
    const run1 = buildRun('run-1', '2026-05-10T00:00:00Z');
    await pipelineRunRepository.saveAll([run1]);

    const fetchJobsPage = vi.fn().mockRejectedValueOnce({ response: { status: 404 } });
    const githubWorkflowClient: IGithubWorkflowJobClient = { fetchJobsPage };
    const repository = createRepository(githubWorkflowClient);

    const jobs = await repository.fetchJobsWithResume([run1]);

    expect(jobs).toHaveLength(0);
    expect(fetchJobsPage).toHaveBeenCalledTimes(1);
  });

  it('should mark the run as processed and continue when fetchJobsPage rejects with status 502', async () => {
    const run1 = buildRun('run-1', '2026-05-10T00:00:00Z');
    const run2 = buildRun('run-2', '2026-05-11T00:00:00Z');
    await pipelineRunRepository.saveAll([run1, run2]);

    const job2 = new PipelineGitHubJobBuilder().id('job-2').runId('run-2').name('build').build();

    const fetchJobsPage = vi.fn().mockImplementation((runId: string) => {
      if (runId === 'run-1') {
        return Promise.reject({ status: 502 });
      }
      return Promise.resolve({ jobs: [job2], hasNext: false });
    });

    const githubWorkflowClient: IGithubWorkflowJobClient = { fetchJobsPage };
    const repository = createRepository(githubWorkflowClient);

    const jobs = await repository.fetchJobsWithResume([run1, run2]);

    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe('job-2');
    expect(fetchJobsPage).toHaveBeenCalledTimes(2);
  });

  it('should save partial progress and rethrow when fetchJobsPage rejects with a non-404/502 status', async () => {
    const run1 = buildRun('run-1', '2026-05-10T00:00:00Z');
    await pipelineRunRepository.saveAll([run1]);

    const fetchJobsPage = vi.fn().mockRejectedValueOnce({ status: 500 });
    const githubWorkflowClient: IGithubWorkflowJobClient = { fetchJobsPage };
    const repository = createRepository(githubWorkflowClient);

    await expect(repository.fetchJobsWithResume([run1])).rejects.toEqual({ status: 500 });
  });

  it('should save partial progress and rethrow when fetchJobsPage rejects with no status at all', async () => {
    const run1 = buildRun('run-1', '2026-05-10T00:00:00Z');
    await pipelineRunRepository.saveAll([run1]);

    const fetchJobsPage = vi.fn().mockRejectedValueOnce(new Error('boom'));
    const githubWorkflowClient: IGithubWorkflowJobClient = { fetchJobsPage };
    const repository = createRepository(githubWorkflowClient);

    await expect(repository.fetchJobsWithResume([run1])).rejects.toThrow('boom');
  });

  it('should persist partial jobs collected so far before rethrowing on a non-404/502 error', async () => {
    const run1 = buildRun('run-1', '2026-05-10T00:00:00Z');
    const run2 = buildRun('run-2', '2026-05-11T00:00:00Z');
    await pipelineRunRepository.saveAll([run1, run2]);

    const job1 = new PipelineGitHubJobBuilder().id('job-1').runId('run-1').name('build').build();

    const fetchJobsPage = vi.fn().mockImplementation((runId: string) => {
      if (runId === 'run-1') {
        return Promise.resolve({ jobs: [job1], hasNext: false });
      }
      return Promise.reject({ status: 500 });
    });

    const githubWorkflowClient: IGithubWorkflowJobClient = { fetchJobsPage };
    const repository = createRepository(githubWorkflowClient);

    await expect(repository.fetchJobsWithResume([run1, run2])).rejects.toEqual({ status: 500 });

    const incompletedPath = join(tempDir, 'jobs_incompleted.json');
    const raw = await readFile(incompletedPath, 'utf-8');
    const persisted = JSON.parse(raw) as WorkflowJobJsonResponse[];

    expect(persisted).toHaveLength(1);
    expect(persisted[0].id).toBe('job-1');
  });
});

describe('Fetch jobs pipeline repository - resume from existing partial progress', () => {
  let tempDir: string;
  let configuration: { getPathFromGitProvider: () => string };
  let pipelineRunRepository: InMemoryRepository<WorkflowJsonResponse>;
  let pipelineJobsRepository: InMemoryRepository<WorkflowJobJsonResponse>;
  const logger = new MockLoggerBuilder().build();

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'smm-jobs-resume-progress-'));
    configuration = { getPathFromGitProvider: () => tempDir };
    pipelineRunRepository = new InMemoryRepository<WorkflowJsonResponse>();
    pipelineJobsRepository = new InMemoryRepository<WorkflowJobJsonResponse>();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const createRepository = (githubWorkflowClient: IGithubWorkflowJobClient) => {
    return new PipelinesJobFetchRepository(
      configuration as never,
      githubWorkflowClient,
      pipelineRunRepository,
      pipelineJobsRepository,
      undefined,
      logger
    );
  };

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

  const writeProgress = (progress: {
    processedRunIds: string[];
    partial?: { runId: string; page: number } | null;
  }) => writeFile(join(tempDir, 'jobs_progress.json'), JSON.stringify(progress), 'utf-8');

  const writeIncompleted = (jobs: WorkflowJobJsonResponse[]) =>
    writeFile(join(tempDir, 'jobs_incompleted.json'), JSON.stringify(jobs), 'utf-8');

  it('should skip a run already listed in processedRunIds without calling fetchJobsPage for it', async () => {
    const run1 = buildRun('run-1', '2026-05-10T00:00:00Z');
    const run2 = buildRun('run-2', '2026-05-11T00:00:00Z');
    await pipelineRunRepository.saveAll([run1, run2]);

    await writeProgress({ processedRunIds: ['run-1'], partial: null });

    const job2 = new PipelineGitHubJobBuilder().id('job-2').runId('run-2').name('build').build();
    const fetchJobsPage = vi.fn().mockResolvedValueOnce({ jobs: [job2], hasNext: false });
    const githubWorkflowClient: IGithubWorkflowJobClient = { fetchJobsPage };
    const repository = createRepository(githubWorkflowClient);

    const jobs = await repository.fetchJobsWithResume([run1, run2]);

    expect(fetchJobsPage).toHaveBeenCalledTimes(1);
    expect(fetchJobsPage).toHaveBeenCalledWith('run-2', 1, 100, { rawFilters: undefined });
    expect(jobs.map((j) => j.id)).toEqual(['job-2']);
  });

  it('should resume a run from partial.page rather than starting at page 1', async () => {
    const run1 = buildRun('run-1', '2026-05-10T00:00:00Z');
    await pipelineRunRepository.saveAll([run1]);

    await writeProgress({ processedRunIds: [], partial: { runId: 'run-1', page: 3 } });

    const job = new PipelineGitHubJobBuilder()
      .id('job-page-3')
      .runId('run-1')
      .name('build')
      .build();
    const fetchJobsPage = vi.fn().mockResolvedValueOnce({ jobs: [job], hasNext: false });
    const githubWorkflowClient: IGithubWorkflowJobClient = { fetchJobsPage };
    const repository = createRepository(githubWorkflowClient);

    const jobs = await repository.fetchJobsWithResume([run1]);

    expect(fetchJobsPage).toHaveBeenCalledTimes(1);
    expect(fetchJobsPage).toHaveBeenCalledWith('run-1', 3, 100, { rawFilters: undefined });
    expect(jobs.map((j) => j.id)).toEqual(['job-page-3']);
  });

  it('should include jobs already in jobs_incompleted.json in the final merged result', async () => {
    const run1 = buildRun('run-1', '2026-05-10T00:00:00Z');
    const run2 = buildRun('run-2', '2026-05-11T00:00:00Z');
    await pipelineRunRepository.saveAll([run1, run2]);

    const priorJob = new PipelineGitHubJobBuilder()
      .id('job-prior')
      .runId('run-1')
      .name('build')
      .build();

    await writeProgress({ processedRunIds: ['run-1'], partial: null });
    await writeIncompleted([priorJob]);

    const job2 = new PipelineGitHubJobBuilder().id('job-2').runId('run-2').name('build').build();
    const fetchJobsPage = vi.fn().mockResolvedValueOnce({ jobs: [job2], hasNext: false });
    const githubWorkflowClient: IGithubWorkflowJobClient = { fetchJobsPage };
    const repository = createRepository(githubWorkflowClient);

    const jobs = await repository.fetchJobsWithResume([run1, run2]);

    expect(jobs.map((j) => j.id).sort()).toEqual(['job-2', 'job-prior']);
  });
});

describe('Fetch jobs pipeline repository - readJson malformed content', () => {
  let tempDir: string;
  let configuration: { getPathFromGitProvider: () => string };
  let pipelineRunRepository: InMemoryRepository<WorkflowJsonResponse>;
  let pipelineJobsRepository: InMemoryRepository<WorkflowJobJsonResponse>;
  const logger = new MockLoggerBuilder().build();

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'smm-jobs-malformed-'));
    configuration = { getPathFromGitProvider: () => tempDir };
    pipelineRunRepository = new InMemoryRepository<WorkflowJsonResponse>();
    pipelineJobsRepository = new InMemoryRepository<WorkflowJobJsonResponse>();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should reject with a parse error rather than falling back to the default when progress JSON is malformed', async () => {
    const run1 = new PipelineGitHubRunBuilder()
      .id('run-1')
      .number('1')
      .name('CI')
      .status('completed')
      .createdAt('2026-05-10T00:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();
    await pipelineRunRepository.saveAll([run1]);

    await writeFile(join(tempDir, 'jobs_progress.json'), '{not valid json', 'utf-8');

    const githubWorkflowClient: IGithubWorkflowJobClient = { fetchJobsPage: vi.fn() };
    const repository = new PipelinesJobFetchRepository(
      configuration as never,
      githubWorkflowClient,
      pipelineRunRepository,
      pipelineJobsRepository,
      undefined,
      logger
    );

    await expect(repository.fetchJobsWithResume([run1])).rejects.toBeInstanceOf(SyntaxError);
  });
});
