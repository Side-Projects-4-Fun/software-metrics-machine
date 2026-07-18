import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { commands } from '../../src';

const mocks = vi.hoisted(() => ({
  build: vi.fn(),
  getDatasetLevel: vi.fn(),
}));

vi.mock('../../src/services/health-check-report', () => ({
  HealthCheckReportBuilder: class {
    build = mocks.build;

    static getDatasetLevel = mocks.getDatasetLevel;
  },
}));

describe('cli: Health Check Command', () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'smm-health-check-'));

    writeFileSync(
      join(tempDir, 'smm_config.json'),
      JSON.stringify({
        projects: [
          {
            github_repository: 'org/repo',
            git_provider: 'github',
            git_repository_location: '/tmp/repo',
          },
        ],
      }),
      'utf-8'
    );

    vi.stubEnv('SMM_STORE_DATA_AT', tempDir);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    mocks.build.mockResolvedValue({
      generatedAt: '2026-07-18T00:00:00.000Z',
      baseDirectory: '/tmp/base',
      summary: {
        totalDatasets: 1,
        healthyDatasets: 1,
        warningDatasets: 0,
        errorDatasets: 0,
      },
      datasets: [],
    });

    program = commands();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = '';
  });

  it('forwards the parsed provider and gap arguments to the report builder', async () => {
    await program.parseAsync(
      ['health-check', '--output', 'json', '--provider', 'jira', '--max-gap-days', '5'],
      { from: 'user' }
    );

    expect(mocks.build).toHaveBeenCalledWith(
      expect.objectContaining({
        gitProvider: 'github',
        githubRepository: 'org/repo',
        gitRepositoryLocation: '/tmp/repo',
        storeData: tempDir,
      }),
      'jira',
      5
    );
  });
});
