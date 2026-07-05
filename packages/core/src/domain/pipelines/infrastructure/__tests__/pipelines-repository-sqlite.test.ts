import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { TimeZoneProvider, Configuration, SqliteRepository, RepositoryFactory } from '../../../..';
import { WorkflowJsonResponse, WorkflowJobJsonResponse } from '../../../../providers/github/github-response-types';
import { PipelineGitHubRunBuilder, PipelineGitHubJobBuilder } from '../../../../test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PipelineFactory } from '../../factories';
import { PipelinesService } from '../../services/pipelines-service';
import { PipelinesSqliteRepository } from '../pipelines-repository-sqlite';
import { MockLoggerBuilder } from '../../../../test/mock-logger-builder';

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

  it('filters workflow runs in SQLite before deserializing payload rows', async () => {
    const config = createConfiguration();
    const matchingRun = new PipelineGitHubRunBuilder()
      .id('run-1')
      .number('1')
      .name('CI')
      .status('completed')
      .conclusion('success')
      .event('push')
      .createdAt('2026-05-10T00:00:00Z')
      .updatedAt('2026-05-10T00:05:00Z')
      .startedAt('2026-05-10T00:00:00Z')
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

    await new SqliteRepository<WorkflowJsonResponse>(
      RepositoryFactory.getSqliteDatabasePath(config),
      RepositoryFactory.getPipelineRunsSqliteNamespace(config),
      logger
    ).saveAll([matchingRun]);

    const db = new DatabaseSync(RepositoryFactory.getSqliteDatabasePath(config));
    try {
      const insert = db.prepare(
        `INSERT INTO workflow_runs
          (
            namespace, id, run_number, name, path, event, status, conclusion,
            head_branch, created_at, updated_at, run_started_at, run_attempt,
            payload, position, stored_at
          )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const namespace = RepositoryFactory.getPipelineRunsSqliteNamespace(config);
      const insertPoisonRun = (id: string, overrides: Record<string, string | number>) => {
        const run = {
          run_number: 999,
          name: 'Poison',
          path: '.github/workflows/ci.yml',
          event: 'push',
          status: 'completed',
          conclusion: 'success',
          head_branch: 'main',
          created_at: '2026-05-10T00:00:00Z',
          updated_at: '2026-05-10T00:05:00Z',
          run_started_at: '2026-05-10T00:00:00Z',
          run_attempt: 1,
          ...overrides,
        };

        insert.run(
          namespace,
          id,
          run.run_number,
          run.name,
          run.path,
          run.event,
          run.status,
          run.conclusion,
          run.head_branch,
          run.created_at,
          run.updated_at,
          run.run_started_at,
          run.run_attempt,
          '{not-valid-json',
          1000,
          '2026-05-10T00:00:00Z'
        );
      };

      insertPoisonRun('wrong-path', { path: '.github/workflows/slow.yml' });
      insertPoisonRun('wrong-status', { status: 'queued' });
      insertPoisonRun('wrong-conclusion', { conclusion: 'failure' });
      insertPoisonRun('wrong-branch', { head_branch: 'develop' });
      insertPoisonRun('wrong-event', { event: 'schedule' });
      insertPoisonRun('too-early', { updated_at: '2026-05-09T23:59:59Z' });
      insertPoisonRun('too-late', { updated_at: '2026-05-11T00:00:00Z' });
    } finally {
      db.close();
    }

    const repository = new PipelinesSqliteRepository(config, logger, timeZoneProvider);
    const loadedRuns = await repository.loadPipelines({
      includeJobs: false,
      startDate: '2026-05-10',
      endDate: '2026-05-10',
      workflowPath: '.github/workflows/ci.yml',
      status: 'completed',
      conclusion: 'success',
      targetBranch: 'main',
      event: 'push',
    });

    expect(loadedRuns).toHaveLength(1);
    expect(loadedRuns[0].id).toBe('run-1');
  });

  it('loads deployment jobs for frequency calculations from SQLite', async () => {
    const config = createConfiguration();
    config.deploymentFrequencyTargets = [
      { pipeline: '.github/workflows/deploy.yml', job: 'deploy-production' },
    ];
    const runs = [
      new PipelineGitHubRunBuilder()
        .id('run-1')
        .number('1')
        .name('Deploy')
        .status('completed')
        .conclusion('success')
        .createdAt('2026-05-10T00:00:00Z')
        .updatedAt('2026-05-10T00:15:00Z')
        .startedAt('2026-05-10T00:00:00Z')
        .branch('main')
        .path('.github/workflows/deploy.yml')
        .build(),
    ];
    const jobs = [
      new PipelineGitHubJobBuilder()
        .id('job-1')
        .runId('run-1')
        .name('deploy-production')
        .status('completed')
        .conclusion('success')
        .startedAt('2026-05-10T00:05:00Z')
        .completedAt('2026-05-10T00:15:00Z')
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
    const service = new PipelinesService(repository, config, logger, timeZoneProvider);

    const frequency = await service.getDeploymentFrequencyWithAllIntervals();

    expect(frequency).toEqual([
      expect.objectContaining({
        pipeline: '.github/workflows/deploy.yml',
        job: 'deploy-production',
        days: '2026-05-10',
        daily_counts: 1,
        weekly_counts: 1,
        monthly_counts: 1,
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