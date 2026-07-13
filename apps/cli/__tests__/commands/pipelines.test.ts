import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { commands } from '../../src';
import { PipelineFactory, PipelineImplementation } from '@smmachine/core';

describe('cli: Pipelines Commands', () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv('SMM_STORE_DATA_AT', '/tmp');
    vi.stubEnv('OWNER_REPO_GIT_PROVIDER', 'github');
    vi.stubEnv('OWNER_REPO_GITHUB_TOKEN', 'fake-token');
    vi.stubEnv('OWNER_REPO_GIT_REPOSITORY_PATH', '/tmp/repo');

    vi.spyOn(PipelineFactory, 'create').mockReturnValue({
      pipelineRepository: {} as never,
      pipelineFiltersRepository: {} as never,
      workflowRepository: {
        fetchPipelines: vi.fn(),
      } as never,
      workflowJobRepository: {
        fetchJobs: vi.fn(),
      } as never,
    });

    vi.spyOn(PipelineImplementation.prototype, 'dashboard').mockResolvedValue({
      runs_by: [
        { period: '2026-07-01', workflow: 'ci.yml', runs: 2 },
        { period: '2026-07-02', workflow: 'ci.yml', runs: 1 },
        { period: '2026-07-02', workflow: 'release.yml', runs: 5 },
        { period: '2026-08-01', workflow: 'ci.yml', runs: 4 },
      ],
    } as never);

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    program = commands();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('aggregates runs by month and pipeline when --period month is provided', async () => {
    await program.parseAsync(['pipelines', 'runs-by', '--period', 'month'], { from: 'user' });

    const output = consoleSpy.mock.calls
      .flat()
      .filter((value: unknown): value is string => typeof value === 'string')
      .join('\n');

    expect(output).toContain('Period: month');
    expect(output).toContain('Period: 2026-07 | Total Runs: 3 | Pipeline: ci.yml');
    expect(output).toContain('Period: 2026-07 | Total Runs: 5 | Pipeline: release.yml');
    expect(output).toContain('Period: 2026-08 | Total Runs: 4 | Pipeline: ci.yml');

    expect(output).not.toContain('Period: 2026-07-01 | Total Runs: 2 | Pipeline: ci.yml');
    expect(output).not.toContain('Period: 2026-07-02 | Total Runs: 1 | Pipeline: ci.yml');
  });

  it('aggregates runs by week and pipeline when --period week is provided', async () => {
    await program.parseAsync(['pipelines', 'runs-by', '--period', 'week'], { from: 'user' });

    const output = consoleSpy.mock.calls
      .flat()
      .filter((value: unknown): value is string => typeof value === 'string')
      .join('\n');

    expect(output).toContain('Period: week');
    expect(output).toMatch(/Period: \d{4}-W\d{2} \| Total Runs: 3 \| Pipeline: ci\.yml/);
    expect(output).toMatch(/Period: \d{4}-W\d{2} \| Total Runs: 5 \| Pipeline: release\.yml/);
    expect(output).toMatch(/Period: \d{4}-W\d{2} \| Total Runs: 4 \| Pipeline: ci\.yml/);

    expect(output).not.toContain('Period: 2026-07-01 | Total Runs: 2 | Pipeline: ci.yml');
    expect(output).not.toContain('Period: 2026-07-02 | Total Runs: 1 | Pipeline: ci.yml');
  });

  it('keeps day granularity when --period day is provided', async () => {
    await program.parseAsync(['pipelines', 'runs-by', '--period', 'day'], { from: 'user' });

    const output = consoleSpy.mock.calls
      .flat()
      .filter((value: unknown): value is string => typeof value === 'string')
      .join('\n');

    expect(output).toContain('Period: day');
    expect(output).toContain('Period: 2026-07-01 | Total Runs: 2 | Pipeline: ci.yml');
    expect(output).toContain('Period: 2026-07-02 | Total Runs: 1 | Pipeline: ci.yml');
    expect(output).toContain('Period: 2026-07-02 | Total Runs: 5 | Pipeline: release.yml');
    expect(output).toContain('Period: 2026-08-01 | Total Runs: 4 | Pipeline: ci.yml');

    expect(output).not.toContain('Period: 2026-07 | Total Runs: 3 | Pipeline: ci.yml');
  });
});
