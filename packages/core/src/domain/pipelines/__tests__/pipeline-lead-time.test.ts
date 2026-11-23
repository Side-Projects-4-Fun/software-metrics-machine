import { describe, expect, it } from 'vitest';
import { PipelineImplementation } from '../services/pipeline-implementation';
import { TimeZoneProvider } from '../../../infrastructure';
import { PipelineJobBuilder, PipelineRunBuilder } from '../../../test/domain/domain-builders';
import { MockLoggerBuilder } from '../../../test/infrastructure/mock-logger-builder';
import { PipelinesRepositoryBuilder } from '../../../test/repositories/repository-builders';

const logger = new MockLoggerBuilder().build();

function buildImplementation(
  runs: ReturnType<PipelineRunBuilder['build']>[],
  targets: Array<{ pipeline: string; job: string }>
): PipelineImplementation {
  const repository = new PipelinesRepositoryBuilder().withPipelineRuns(runs).build();
  return new PipelineImplementation(repository, targets, logger, new TimeZoneProvider('UTC'));
}

describe('PipelineImplementation.getLeadTime', () => {
  it('computes commit-to-deploy minutes per configured deployment target', async () => {
    const implementation = buildImplementation(
      [
        new PipelineRunBuilder()
          .withId('deploy-run-1')
          .withPath('.github/workflows/deploy.yml')
          .withStatus('completed')
          .withConclusion('success')
          .withCommit('abc123')
          .withCommitTimestamp('2026-01-01T10:00:00Z')
          .withJobs([
            new PipelineJobBuilder()
              .withName('deploy')
              .withConclusion('success')
              .withStartedAt('2026-01-01T10:25:00Z')
              .withCompletedAt('2026-01-01T10:30:00Z')
              .build(),
          ])
          .build(),
        new PipelineRunBuilder()
          .withId('deploy-run-2')
          .withPath('.github/workflows/deploy.yml')
          .withStatus('completed')
          .withConclusion('success')
          .withCommit('def456')
          .withCommitTimestamp('2026-01-02T10:00:00Z')
          .withJobs([
            new PipelineJobBuilder()
              .withName('deploy')
              .withConclusion('success')
              .withStartedAt('2026-01-02T10:55:00Z')
              .withCompletedAt('2026-01-02T11:00:00Z')
              .build(),
          ])
          .build(),
      ],
      [{ pipeline: '.github/workflows/deploy.yml', job: 'deploy' }]
    );

    const result = await implementation.getLeadTime({});

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      pipeline: '.github/workflows/deploy.yml',
      job: 'deploy',
      value: 45,
      count: 2,
    });
  });

  it('skips deployments without a commit timestamp', async () => {
    const implementation = buildImplementation(
      [
        new PipelineRunBuilder()
          .withId('deploy-run-no-commit')
          .withPath('.github/workflows/deploy.yml')
          .withStatus('completed')
          .withConclusion('success')
          .withCommitTimestamp(undefined)
          .withJobs([
            new PipelineJobBuilder()
              .withName('deploy')
              .withConclusion('success')
              .withCompletedAt('2026-01-01T10:30:00Z')
              .build(),
          ])
          .build(),
        new PipelineRunBuilder()
          .withId('deploy-run-with-commit')
          .withPath('.github/workflows/deploy.yml')
          .withStatus('completed')
          .withConclusion('success')
          .withCommitTimestamp('2026-01-02T10:00:00Z')
          .withJobs([
            new PipelineJobBuilder()
              .withName('deploy')
              .withConclusion('success')
              .withCompletedAt('2026-01-02T10:20:00Z')
              .build(),
          ])
          .build(),
      ],
      [{ pipeline: '.github/workflows/deploy.yml', job: 'deploy' }]
    );

    const result = await implementation.getLeadTime({});

    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(1);
    expect(result[0].value).toBe(20);
  });

  it('reports one result per configured target when no scope is given', async () => {
    const implementation = buildImplementation(
      [
        new PipelineRunBuilder()
          .withId('prod-run')
          .withPath('.github/workflows/release.yml')
          .withStatus('completed')
          .withConclusion('success')
          .withCommitTimestamp('2026-01-01T10:00:00Z')
          .withJobs([
            new PipelineJobBuilder()
              .withName('deploy-production')
              .withConclusion('success')
              .withCompletedAt('2026-01-01T10:30:00Z')
              .build(),
          ])
          .build(),
        new PipelineRunBuilder()
          .withId('mobile-run')
          .withPath('.github/workflows/mobile.yml')
          .withStatus('completed')
          .withConclusion('success')
          .withCommitTimestamp('2026-01-01T10:00:00Z')
          .withJobs([
            new PipelineJobBuilder()
              .withName('deploy-mobile')
              .withConclusion('success')
              .withCompletedAt('2026-01-01T11:00:00Z')
              .build(),
          ])
          .build(),
      ],
      [
        { pipeline: '.github/workflows/release.yml', job: 'deploy-production' },
        { pipeline: '.github/workflows/mobile.yml', job: 'deploy-mobile' },
      ]
    );

    const result = await implementation.getLeadTime({});

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ job: 'deploy-production', value: 30 });
    expect(result[1]).toMatchObject({ job: 'deploy-mobile', value: 60 });
  });

  it('scopes to a single target when workflow and job filters are provided', async () => {
    const implementation = buildImplementation(
      [
        new PipelineRunBuilder()
          .withId('prod-run')
          .withPath('.github/workflows/release.yml')
          .withStatus('completed')
          .withConclusion('success')
          .withCommitTimestamp('2026-01-01T10:00:00Z')
          .withJobs([
            new PipelineJobBuilder()
              .withName('deploy-production')
              .withConclusion('success')
              .withCompletedAt('2026-01-01T10:30:00Z')
              .build(),
          ])
          .build(),
      ],
      [
        { pipeline: '.github/workflows/release.yml', job: 'deploy-production' },
        { pipeline: '.github/workflows/mobile.yml', job: 'deploy-mobile' },
      ]
    );

    const result = await implementation.getLeadTime({
      workflowPath: '.github/workflows/release.yml',
      jobName: 'deploy-production',
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      pipeline: '.github/workflows/release.yml',
      job: 'deploy-production',
      value: 30,
    });
  });
});
