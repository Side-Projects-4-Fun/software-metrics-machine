import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Configuration,
  PipelineGitHubJobBuilder,
  PipelineGitHubRunBuilder,
  PipelinesSqliteRepository,
  RepositoryFactory,
  SqliteRepository,
} from '../../../src';
import { PipelinesRepository } from '../../../src';
import PipelineFactory from '../../../src/factories/pipeline-factory';
import { InMemoryRepository } from '../../../src/test/in-memory-repository';
import {
  WorkflowJobJsonResponse,
  WorkflowJsonResponse,
} from '../../../src/providers/github/github-response-types';
import { MockLoggerBuilder } from '../../mock-logger-builder';
import { TimeZoneProvider } from '../../../src/infrastructure/timezone-provider';

describe('PipelinesRepository loadPipelines', () => {
  const pipelineRunRepository = new InMemoryRepository<WorkflowJsonResponse>();
  const pipelineJobsRepository = new InMemoryRepository<WorkflowJobJsonResponse>();
  const logger = new MockLoggerBuilder().build();
  const timeZoneProvider = new TimeZoneProvider('UTC');

  const createRepository = () => {
    return new PipelinesRepository(
      pipelineRunRepository,
      pipelineJobsRepository,
      logger,
      timeZoneProvider
    );
  };

  it('should load pipelines with corresponding jobs attached', async () => {
    const runs = [
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
      new PipelineGitHubRunBuilder()
        .id('run-2')
        .number('2')
        .name('CD')
        .status('completed')
        .createdAt('2026-05-11T00:00:00Z')
        .updatedAt('2026-05-11T00:05:00Z')
        .startedAt('2026-05-11T00:00:00Z')
        .branch('main')
        .path('.github/workflows/cd.yml')
        .build(),
    ];

    const jobs = [
      new PipelineGitHubJobBuilder()
        .id('job-1')
        .runId('run-1')
        .name('build')
        .startedAt('2026-05-10T00:01:00Z')
        .completedAt('2026-05-10T00:02:00Z')
        .status('completed')
        .conclusion('success')
        .build(),
      new PipelineGitHubJobBuilder()
        .id('job-2')
        .runId('run-1')
        .name('test')
        .startedAt('2026-05-10T00:02:00Z')
        .completedAt('2026-05-10T00:04:00Z')
        .status('completed')
        .conclusion('success')
        .build(),
      new PipelineGitHubJobBuilder()
        .id('job-3')
        .runId('run-missing')
        .name('orphan')
        .startedAt('2026-05-10T00:02:00Z')
        .completedAt('2026-05-10T00:04:00Z')
        .status('completed')
        .conclusion('success')
        .build(),
    ];

    await pipelineRunRepository.saveAll(runs);
    await pipelineJobsRepository.saveAll(jobs);

    const repository = createRepository();

    const loadedRuns = await repository.loadPipelines();

    expect(loadedRuns).toHaveLength(2);
    expect(loadedRuns[0].jobs).toHaveLength(2);
    expect(loadedRuns[0].jobs?.[0].runId).toBe('run-1');
    expect(loadedRuns[1].jobs).toBeUndefined();
  });

  it('should apply raw filters to cached pipeline runs and jobs', async () => {
    const runs = [
      new PipelineGitHubRunBuilder()
        .id('run-1')
        .number('1')
        .name('CI')
        .status('completed')
        .conclusion('success')
        .createdAt('2026-05-10T00:00:00Z')
        .updatedAt('2026-05-10T00:05:00Z')
        .startedAt('2026-05-10T00:00:00Z')
        .branch('main')
        .path('.github/workflows/ci.yml')
        .build(),
      new PipelineGitHubRunBuilder()
        .id('run-2')
        .number('2')
        .name('CI')
        .status('completed')
        .conclusion('failure')
        .createdAt('2026-05-11T00:00:00Z')
        .updatedAt('2026-05-11T00:05:00Z')
        .startedAt('2026-05-11T00:00:00Z')
        .branch('feature')
        .path('.github/workflows/ci.yml')
        .build(),
    ];

    const jobs = [
      new PipelineGitHubJobBuilder()
        .id('job-1')
        .runId('run-1')
        .name('deploy')
        .status('completed')
        .conclusion('success')
        .build(),
      new PipelineGitHubJobBuilder()
        .id('job-2')
        .runId('run-2')
        .name('deploy')
        .status('completed')
        .conclusion('failure')
        .build(),
    ];

    await pipelineRunRepository.saveAll(runs);
    await pipelineJobsRepository.saveAll(jobs);

    const repository = createRepository();
    const loadedRuns = await repository.loadPipelines({
      rawFilters: 'branch=main|name=deploy|conclusion=success',
    });

    expect(loadedRuns).toHaveLength(1);
    expect(loadedRuns[0].id).toBe('run-1');
    expect(loadedRuns[0].jobs?.map((job) => job.id)).toEqual(['job-1']);
  });

  it('should load pipeline runs without reading jobs when jobs are excluded', async () => {
    const runs = [
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
    ];

    await pipelineRunRepository.saveAll(runs);
    const loadJobsSpy = vi.spyOn(pipelineJobsRepository, 'loadAll');

    const repository = createRepository();

    const loadedRuns = await repository.loadPipelines({ includeJobs: false });

    expect(loadedRuns).toHaveLength(1);
    expect(loadedRuns[0].jobs).toBeUndefined();
    expect(loadJobsSpy).not.toHaveBeenCalled();
    loadJobsSpy.mockRestore();
  });

  it('should use jobs for filtering without returning jobs when jobs are excluded', async () => {
    const runs = [
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
      new PipelineGitHubRunBuilder()
        .id('run-2')
        .number('2')
        .name('CD')
        .status('completed')
        .createdAt('2026-05-11T00:00:00Z')
        .updatedAt('2026-05-11T00:05:00Z')
        .startedAt('2026-05-11T00:00:00Z')
        .branch('main')
        .path('.github/workflows/cd.yml')
        .build(),
    ];
    const jobs = [
      new PipelineGitHubJobBuilder().id('job-1').runId('run-1').name('build').build(),
      new PipelineGitHubJobBuilder().id('job-2').runId('run-2').name('deploy').build(),
    ];

    await pipelineRunRepository.saveAll(runs);
    await pipelineJobsRepository.saveAll(jobs);

    const repository = createRepository();

    const loadedRuns = await repository.loadPipelines({
      includeJobs: false,
      jobNames: ['deploy'],
    });

    expect(loadedRuns).toHaveLength(1);
    expect(loadedRuns[0].id).toBe('run-2');
    expect(loadedRuns[0].jobs).toBeUndefined();
  });

  it('should filter returned jobs when jobs are included and job filters are provided', async () => {
    const runs = [
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
    ];
    const jobs = [
      new PipelineGitHubJobBuilder().id('job-1').runId('run-1').name('build').build(),
      new PipelineGitHubJobBuilder().id('job-2').runId('run-1').name('test').build(),
    ];

    await pipelineRunRepository.saveAll(runs);
    await pipelineJobsRepository.saveAll(jobs);

    const repository = createRepository();

    const loadedRuns = await repository.loadPipelines({
      includeJobs: true,
      jobNames: ['test'],
    });

    expect(loadedRuns).toHaveLength(1);
    expect(loadedRuns[0].jobs).toHaveLength(1);
    expect(loadedRuns[0].jobs?.[0].name).toBe('test');
  });

  it('should filter pipelines and events before narrowing jobs', async () => {
    const runs = [
      new PipelineGitHubRunBuilder()
        .id('run-1')
        .path('.github/workflows/ci.yml')
        .event('push')
        .build(),
      new PipelineGitHubRunBuilder()
        .id('run-2')
        .path('.github/workflows/deploy.yml')
        .event('push')
        .build(),
      new PipelineGitHubRunBuilder()
        .id('run-3')
        .path('.github/workflows/ci.yml')
        .event('schedule')
        .build(),
    ];
    const jobs = [
      new PipelineGitHubJobBuilder().id('job-1').runId('run-1').name('build').build(),
      new PipelineGitHubJobBuilder().id('job-2').runId('run-1').name('test').build(),
      new PipelineGitHubJobBuilder().id('job-3').runId('run-2').name('build').build(),
      new PipelineGitHubJobBuilder().id('job-4').runId('run-3').name('build').build(),
    ];

    await pipelineRunRepository.saveAll(runs);
    await pipelineJobsRepository.saveAll(jobs);

    const repository = createRepository();

    const loadedRuns = await repository.loadPipelines({
      includeJobs: true,
      workflowPath: '.github/workflows/ci.yml',
      event: 'push',
      jobNames: ['build'],
    });

    expect(loadedRuns).toHaveLength(1);
    expect(loadedRuns[0].id).toBe('run-1');
    expect(loadedRuns[0].jobs).toEqual([
      expect.objectContaining({
        id: 'job-1',
        name: 'build',
        runId: 'run-1',
      }),
    ]);
  });

  it('should support multiple selected events when filtering jobs', async () => {
    const runs = [
      new PipelineGitHubRunBuilder()
        .id('run-1')
        .path('.github/workflows/ci.yml')
        .event('push')
        .build(),
      new PipelineGitHubRunBuilder()
        .id('run-2')
        .path('.github/workflows/ci.yml')
        .event('workflow_dispatch')
        .build(),
      new PipelineGitHubRunBuilder()
        .id('run-3')
        .path('.github/workflows/ci.yml')
        .event('schedule')
        .build(),
    ];
    const jobs = [
      new PipelineGitHubJobBuilder().id('job-1').runId('run-1').name('build').build(),
      new PipelineGitHubJobBuilder().id('job-2').runId('run-2').name('build').build(),
      new PipelineGitHubJobBuilder().id('job-3').runId('run-3').name('build').build(),
    ];

    await pipelineRunRepository.saveAll(runs);
    await pipelineJobsRepository.saveAll(jobs);

    const repository = createRepository();

    const loadedRuns = await repository.loadPipelines({
      includeJobs: true,
      workflowPath: '.github/workflows/ci.yml',
      event: 'push,workflow_dispatch',
      jobNames: ['build'],
    });

    expect(loadedRuns.map((run) => run.id)).toEqual(['run-1', 'run-2']);
    expect(loadedRuns.flatMap((run) => run.jobs || []).map((job) => job.id)).toEqual([
      'job-1',
      'job-2',
    ]);
  });

  it('should filter runs by completed day', async () => {
    const runs = [
      new PipelineGitHubRunBuilder()
        .id('run-1')
        .path('.github/workflows/ci.yml')
        .createdAt('2026-05-09T23:55:00Z')
        .updatedAt('2026-05-10T00:05:00Z')
        .build(),
      new PipelineGitHubRunBuilder()
        .id('run-2')
        .path('.github/workflows/ci.yml')
        .createdAt('2026-05-10T10:00:00Z')
        .updatedAt('2026-05-10T10:30:00Z')
        .build(),
      new PipelineGitHubRunBuilder()
        .id('run-3')
        .path('.github/workflows/ci.yml')
        .createdAt('2026-05-10T23:55:00Z')
        .updatedAt('2026-05-11T00:05:00Z')
        .build(),
    ];

    await pipelineRunRepository.saveAll(runs);
    await pipelineJobsRepository.saveAll([]);

    const repository = createRepository();

    const loadedRuns = await repository.loadPipelines({
      includeJobs: false,
      startDate: '2026-05-10',
      endDate: '2026-05-10',
      sort_by: { created_at: 'asc' },
    });

    expect(loadedRuns.map((run) => run.id)).toEqual(['run-1', 'run-2']);
  });

  it('should filter runs by ISO week boundaries', async () => {
    const runs = [
      new PipelineGitHubRunBuilder()
        .id('run-w01')
        .path('.github/workflows/ci.yml')
        .createdAt('2026-01-04T10:00:00Z')
        .updatedAt('2026-01-04T10:30:00Z')
        .build(),
      new PipelineGitHubRunBuilder()
        .id('run-w02')
        .path('.github/workflows/ci.yml')
        .createdAt('2026-01-06T10:00:00Z')
        .updatedAt('2026-01-06T10:30:00Z')
        .build(),
      new PipelineGitHubRunBuilder()
        .id('run-w03')
        .path('.github/workflows/ci.yml')
        .createdAt('2026-01-13T10:00:00Z')
        .updatedAt('2026-01-13T10:30:00Z')
        .build(),
    ];

    await pipelineRunRepository.saveAll(runs);
    await pipelineJobsRepository.saveAll([]);

    const repository = createRepository();

    const loadedRuns = await repository.loadPipelines({
      includeJobs: false,
      startDate: '2026-W02',
      endDate: '2026-W02',
      sort_by: { created_at: 'asc' },
    });

    expect(loadedRuns.map((run) => run.id)).toEqual(['run-w02']);
  });

  it('should exclude weekend runs when weekends filter is set to exclude', async () => {
    const runs = [
      new PipelineGitHubRunBuilder()
        .id('run-weekend')
        .path('.github/workflows/ci.yml')
        .createdAt('2026-06-06T10:00:00Z')
        .updatedAt('2026-06-06T10:30:00Z')
        .build(),
      new PipelineGitHubRunBuilder()
        .id('run-weekday')
        .path('.github/workflows/ci.yml')
        .createdAt('2026-06-08T10:00:00Z')
        .updatedAt('2026-06-08T10:30:00Z')
        .build(),
    ];

    await pipelineRunRepository.saveAll(runs);
    await pipelineJobsRepository.saveAll([]);

    const repository = createRepository();

    const loadedRuns = await repository.loadPipelines({
      includeJobs: false,
      weekends: 'exclude',
      sort_by: { created_at: 'asc' },
    });

    expect(loadedRuns.map((run) => run.id)).toEqual(['run-weekday']);
  });

  it('should keep only weekend runs when weekends filter is set to weekends_only', async () => {
    const runs = [
      new PipelineGitHubRunBuilder()
        .id('run-weekend')
        .path('.github/workflows/ci.yml')
        .createdAt('2026-06-06T10:00:00Z')
        .updatedAt('2026-06-06T10:30:00Z')
        .build(),
      new PipelineGitHubRunBuilder()
        .id('run-weekday')
        .path('.github/workflows/ci.yml')
        .createdAt('2026-06-08T10:00:00Z')
        .updatedAt('2026-06-08T10:30:00Z')
        .build(),
    ];

    await pipelineRunRepository.saveAll(runs);
    await pipelineJobsRepository.saveAll([]);

    const repository = createRepository();

    const loadedRuns = await repository.loadPipelines({
      includeJobs: false,
      weekends: 'weekends_only',
      sort_by: { created_at: 'asc' },
    });

    expect(loadedRuns.map((run) => run.id)).toEqual(['run-weekend']);
  });
});

describe('PipelinesSqliteRepository loadPipelines', () => {
  const logger = new MockLoggerBuilder().build();
  const timeZoneProvider = new TimeZoneProvider('UTC');
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  function createConfiguration(): Configuration {
    tempDir = mkdtempSync(join(tmpdir(), 'smm-pipelines-sqlite-'));

    return new Configuration({
      storeData: tempDir,
      gitProvider: 'github',
      githubRepository: 'owner/repo',
      internal: { storageType: 'sqlite' },
    });
  }

  it('loads filtered pipeline runs with jobs from normalized SQLite tables', async () => {
    const config = createConfiguration();
    const runs = [
      new PipelineGitHubRunBuilder()
        .id('run-1')
        .number('1')
        .name('CI')
        .status('completed')
        .conclusion('success')
        .createdAt('2026-05-10T00:00:00Z')
        .updatedAt('2026-05-10T00:05:00Z')
        .startedAt('2026-05-10T00:00:00Z')
        .branch('main')
        .path('.github/workflows/ci.yml')
        .build(),
      new PipelineGitHubRunBuilder()
        .id('run-2')
        .number('2')
        .name('CD')
        .status('completed')
        .conclusion('failure')
        .createdAt('2026-05-11T00:00:00Z')
        .updatedAt('2026-05-11T00:05:00Z')
        .startedAt('2026-05-11T00:00:00Z')
        .branch('main')
        .path('.github/workflows/cd.yml')
        .build(),
    ];
    const jobs = [
      new PipelineGitHubJobBuilder()
        .id('job-1')
        .runId('run-1')
        .name('build')
        .status('completed')
        .conclusion('success')
        .startedAt('2026-05-10T00:01:00Z')
        .completedAt('2026-05-10T00:03:00Z')
        .build(),
      new PipelineGitHubJobBuilder()
        .id('job-2')
        .runId('run-2')
        .name('deploy')
        .status('completed')
        .conclusion('failure')
        .startedAt('2026-05-11T00:01:00Z')
        .completedAt('2026-05-11T00:04:00Z')
        .build(),
    ];

    await new SqliteRepository<WorkflowJsonResponse>(
      RepositoryFactory.getSqliteDatabasePath(config),
      RepositoryFactory.getPipelineRunsSqliteNamespace(config),
      logger
    ).saveAll(runs);
    await new SqliteRepository<WorkflowJobJsonResponse>(
      RepositoryFactory.getSqliteDatabasePath(config),
      RepositoryFactory.getPipelineJobsSqliteNamespace(config),
      logger
    ).saveAll(jobs);

    const repository = new PipelinesSqliteRepository(config, logger, timeZoneProvider);
    const loadedRuns = await repository.loadPipelines({
      includeJobs: true,
      workflowPath: '.github/workflows/ci.yml',
      jobName: 'build',
    });

    expect(loadedRuns).toHaveLength(1);
    expect(loadedRuns[0].id).toBe('run-1');
    expect(loadedRuns[0].jobs).toEqual([
      expect.objectContaining({
        id: 'job-1',
        name: 'build',
        runId: 'run-1',
        durationSeconds: 120,
      }),
    ]);
  });

  it('creates the SQLite pipeline repository when storage type is sqlite', () => {
    const config = createConfiguration();
    config.githubToken = 'token';

    const factory = PipelineFactory.create(config, logger, timeZoneProvider);

    expect(factory.pipelineRepository).toBeInstanceOf(PipelinesSqliteRepository);
  });
});
