import { describe, expect, it, vi } from 'vitest';
import { PipelineGitHubRunBuilder } from '../../../test/github-builders';
import { GithubWorkflowClient } from '../github-workflow-client';
import { GitHubRateLimitManager } from '../github-rate-limit-manager';
import { MockLoggerBuilder } from '../../../test/mock-logger-builder';

describe('GithubWorkflowClient - Fetch workflows by day', () => {
  const token = 'test-token';
  const owner = 'test-owner';
  const repo = 'test-repo';
  const logger = new MockLoggerBuilder().build();
  const buildRun = ({
    id,
    number,
    createdAt,
    updatedAt,
    startedAt,
    commit,
  }: {
    id: string;
    number: string;
    createdAt: string;
    updatedAt: string;
    startedAt: string;
    commit: string;
  }) =>
    new PipelineGitHubRunBuilder()
      .id(id)
      .number(number)
      .name('CI')
      .status('completed')
      .conclusion('success')
      .createdAt(createdAt)
      .updatedAt(updatedAt)
      .startedAt(startedAt)
      .commit(commit)
      .branch('main')
      .path('.github/workflows/ci.yml')
      .build();

  it('should fetch workflows by day when byDay is true', async () => {
    const client = new GithubWorkflowClient(
      token,
      owner,
      repo,
      new GitHubRateLimitManager(logger),
      logger
    );

    const mockRuns1 = [
      buildRun({
        id: '1',
        number: '1',
        createdAt: '2026-05-10T10:00:00Z',
        updatedAt: '2026-05-10T10:05:00Z',
        startedAt: '2026-05-10T10:00:00Z',
        commit: 'abc123',
      }),
    ];

    const mockRuns2 = [
      buildRun({
        id: '2',
        number: '2',
        createdAt: '2026-05-11T10:00:00Z',
        updatedAt: '2026-05-11T10:05:00Z',
        startedAt: '2026-05-11T10:00:00Z',
        commit: 'def456',
      }),
    ];

    const fetchWorkflowRunsPageSpy = vi
      .spyOn(client, 'fetchWorkflowRunsPage')
      .mockImplementationOnce(() =>
        Promise.resolve({
          runs: mockRuns1,
          hasNext: false,
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          runs: mockRuns2,
          hasNext: false,
        })
      );

    const result = await client.fetchWorkflows({
      startDate: '2026-05-10',
      endDate: '2026-05-11',
      byDay: true,
    });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('2');
    expect(fetchWorkflowRunsPageSpy).toHaveBeenCalledTimes(2);
  });

  it('should fetch all pages for each day before moving to next day', async () => {
    const client = new GithubWorkflowClient(
      token,
      owner,
      repo,
      new GitHubRateLimitManager(logger),
      logger
    );

    const mockPage1Day1 = [
      buildRun({
        id: '1',
        number: '1',
        createdAt: '2026-05-10T10:00:00Z',
        updatedAt: '2026-05-10T10:05:00Z',
        startedAt: '2026-05-10T10:00:00Z',
        commit: 'abc123',
      }),
    ];

    const mockPage2Day1 = [
      buildRun({
        id: '2',
        number: '2',
        createdAt: '2026-05-10T11:00:00Z',
        updatedAt: '2026-05-10T11:05:00Z',
        startedAt: '2026-05-10T11:00:00Z',
        commit: 'def456',
      }),
    ];

    const mockDay2 = [
      buildRun({
        id: '3',
        number: '3',
        createdAt: '2026-05-11T10:00:00Z',
        updatedAt: '2026-05-11T10:05:00Z',
        startedAt: '2026-05-11T10:00:00Z',
        commit: 'ghi789',
      }),
    ];

    const fetchWorkflowRunsPageSpy = vi
      .spyOn(client, 'fetchWorkflowRunsPage')
      .mockImplementationOnce(() =>
        Promise.resolve({
          runs: mockPage1Day1,
          hasNext: true,
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          runs: mockPage2Day1,
          hasNext: false,
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          runs: mockDay2,
          hasNext: false,
        })
      );

    const result = await client.fetchWorkflows({
      startDate: '2026-05-10',
      endDate: '2026-05-11',
      byDay: true,
    });

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('2');
    expect(result[2].id).toBe('3');
    expect(fetchWorkflowRunsPageSpy).toHaveBeenCalledTimes(3);

    // Verify day separation
    const calls = fetchWorkflowRunsPageSpy.mock.calls;
    expect(calls[0][2]?.created).toContain('2026-05-10');
    expect(calls[1][2]?.created).toContain('2026-05-10');
    expect(calls[2][2]?.created).toContain('2026-05-11');
  });

  it('should use original behavior when byDay is false', async () => {
    const client = new GithubWorkflowClient(
      token,
      owner,
      repo,
      new GitHubRateLimitManager(logger),
      logger
    );

    const mockRuns = [
      buildRun({
        id: '1',
        number: '1',
        createdAt: '2026-05-10T10:00:00Z',
        updatedAt: '2026-05-10T10:05:00Z',
        startedAt: '2026-05-10T10:00:00Z',
        commit: 'abc123',
      }),
    ];

    const fetchWorkflowRunsPageSpy = vi
      .spyOn(client, 'fetchWorkflowRunsPage')
      .mockResolvedValueOnce({
        runs: mockRuns,
        hasNext: false,
      });

    const result = await client.fetchWorkflows({
      startDate: '2026-05-10T00:00:00Z',
      endDate: '2026-05-11T23:59:59Z',
      byDay: false,
    });

    expect(result).toHaveLength(1);
    // With byDay false, should make single request with range
    expect(fetchWorkflowRunsPageSpy).toHaveBeenCalledTimes(1);
    const params = fetchWorkflowRunsPageSpy.mock.calls[0][2];
    expect(params?.created).toContain('..');
  });

  it('should use exact datetime range when byDay is true with datetime filters', async () => {
    const client = new GithubWorkflowClient(
      token,
      owner,
      repo,
      new GitHubRateLimitManager(logger),
      logger
    );

    const fetchWorkflowRunsPageSpy = vi
      .spyOn(client, 'fetchWorkflowRunsPage')
      .mockResolvedValueOnce({
        runs: [],
        hasNext: false,
      });

    await client.fetchWorkflows({
      startDate: '2026-05-10T08:30:00+01:00',
      endDate: '2026-05-10T17:45:00+01:00',
      byDay: true,
    });

    expect(fetchWorkflowRunsPageSpy).toHaveBeenCalledTimes(1);
    expect(fetchWorkflowRunsPageSpy).toHaveBeenCalledWith(1, 100, {
      created: '2026-05-10T08:30:00+01:00..2026-05-10T17:45:00+01:00',
      rawFilters: undefined,
    });
  });

  it('should use original behavior when byDay is not provided', async () => {
    const client = new GithubWorkflowClient(
      token,
      owner,
      repo,
      new GitHubRateLimitManager(logger),
      logger
    );

    const mockRuns = [
      buildRun({
        id: '1',
        number: '1',
        createdAt: '2026-05-10T10:00:00Z',
        updatedAt: '2026-05-10T10:05:00Z',
        startedAt: '2026-05-10T10:00:00Z',
        commit: 'abc123',
      }),
    ];

    const fetchWorkflowRunsPageSpy = vi
      .spyOn(client, 'fetchWorkflowRunsPage')
      .mockResolvedValueOnce({
        runs: mockRuns,
        hasNext: false,
      });

    const result = await client.fetchWorkflows({
      startDate: '2026-05-10T00:00:00Z',
      endDate: '2026-05-11T23:59:59Z',
    });

    expect(result).toHaveLength(1);
    expect(fetchWorkflowRunsPageSpy).toHaveBeenCalledTimes(1);
  });

  it('should handle single day with byDay flag', async () => {
    const client = new GithubWorkflowClient(
      token,
      owner,
      repo,
      new GitHubRateLimitManager(logger),
      logger
    );

    const mockRuns = [
      buildRun({
        id: '1',
        number: '1',
        createdAt: '2026-05-10T10:00:00Z',
        updatedAt: '2026-05-10T10:05:00Z',
        startedAt: '2026-05-10T10:00:00Z',
        commit: 'abc123',
      }),
    ];

    const fetchWorkflowRunsPageSpy = vi
      .spyOn(client, 'fetchWorkflowRunsPage')
      .mockResolvedValueOnce({
        runs: mockRuns,
        hasNext: false,
      });

    const result = await client.fetchWorkflows({
      startDate: '2026-05-10',
      endDate: '2026-05-10',
      byDay: true,
    });

    expect(result).toHaveLength(1);
    expect(fetchWorkflowRunsPageSpy).toHaveBeenCalledTimes(1);
  });

  it('should handle raw filters with byDay', async () => {
    const client = new GithubWorkflowClient(
      token,
      owner,
      repo,
      new GitHubRateLimitManager(logger),
      logger
    );

    const mockRuns = [
      buildRun({
        id: '1',
        number: '1',
        createdAt: '2026-05-10T10:00:00Z',
        updatedAt: '2026-05-10T10:05:00Z',
        startedAt: '2026-05-10T10:00:00Z',
        commit: 'abc123',
      }),
    ];

    const fetchWorkflowRunsPageSpy = vi
      .spyOn(client, 'fetchWorkflowRunsPage')
      .mockResolvedValueOnce({
        runs: mockRuns,
        hasNext: false,
      })
      .mockResolvedValueOnce({
        runs: [],
        hasNext: false,
      });

    const result = await client.fetchWorkflows({
      startDate: '2026-05-10',
      endDate: '2026-05-11',
      rawFilters: 'status=success,branch=main',
      byDay: true,
    });

    expect(result).toHaveLength(1);
    expect(fetchWorkflowRunsPageSpy).toHaveBeenCalledTimes(2);

    const call1 = fetchWorkflowRunsPageSpy.mock.calls[0];
    expect(call1[2]?.rawFilters).toBe('status=success,branch=main');
    expect(call1[2]?.created).toContain('2026-05-10');

    const call2 = fetchWorkflowRunsPageSpy.mock.calls[1];
    expect(call2[2]?.rawFilters).toBe('status=success,branch=main');
    expect(call2[2]?.created).toContain('2026-05-11');
  });
});
